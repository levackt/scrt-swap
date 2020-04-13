require('dotenv').config();
const {Leader} = require("../leader");
const {Operator} = require("../operator");
const {Db, SWAP_COLLECTION, SIGNATURE_COLLECTION} = require("../common/db");
const {MockTokenSwapClient} = require("./mock_file_swap_client");

const Web3 = require('web3');
const EngSwap = require("../client/src/contracts/EngSwap.json");
const EngToken = require("../client/src/contracts/EngToken.json");
const {expect} = require('chai');
const {mineBlock} = require('../common/ganache');

async function sleep(ms) {
    await new Promise(resolve => {
        setTimeout(() => resolve(true), ms);
    });
}

describe("EngSwap", () => {
    const multisigAddress = process.env.MULTISIG_ADDRESS || 'enigma12345';
    const nbConfirmations = process.env.NB_CONFIRMATIONS || '12';
    const ethHost = process.env.ETH_HOST || 'localhost';
    const ethPort = process.env.ETH_PORT || '8545';
    const networkId = process.env.NETWORK_ID || '50';
    const pollingInterval = 1000;
    const multisigThreshold = 2;
    const broadcastInterval = 500;
    const provider = new Web3.providers.HttpProvider('http://' + ethHost + ':' + ethPort);
    const web3 = new Web3(provider);
    const deployedSwap = EngSwap.networks[networkId];
    const deployedToken = EngToken.networks[networkId];
    const db = new Db('mongodb://localhost:27017', 'enigma-swap');

    let swapContract;
    let tokenContract;
    let accounts;
    let leader;
    let operators = [];
    const recipient1 = 'enigma1um27s6ee62r8evnv7mz85fe4mz7yx6rkvzut0e'
    
    const tokenAmountToBurn = web3.utils.toBN(10);
    before(async () => {
        if (!deployedSwap || !deployedToken) {
            throw new Error('Deployed contract not found');
        }
        await db.init();
        await db.clear(SWAP_COLLECTION);
        await db.clear(SIGNATURE_COLLECTION);
        const fromBlock = await web3.eth.getBlockNumber();
        leader = new Leader(new MockTokenSwapClient(), multisigAddress, db, provider, networkId, fromBlock, 
            pollingInterval, multisigThreshold, broadcastInterval);
        swapContract = new web3.eth.Contract(
            EngSwap.abi,
            deployedSwap.address,
        );
        tokenContract = new web3.eth.Contract(
            EngToken.abi,
            deployedToken.address,
        );
        accounts = await web3.eth.getAccounts();
        const balance = await tokenContract.methods.balanceOf(accounts[0]).call();
        console.log('The deployment balance', balance);
        for (let i = 1; i < 5; i++) {
            const tokenDecimals = web3.utils.toBN(18);
            const tokenAmountToTransfer = web3.utils.toBN(100);
            const amount = tokenAmountToTransfer.mul(web3.utils.toBN(10).pow(tokenDecimals));
            await tokenContract.methods.transfer(accounts[i], amount).send({from: accounts[0]});
            const balance = await tokenContract.methods.balanceOf(accounts[i]).call();
            console.log('Account', accounts[i], ':', balance);
        }
        for (let i = 0; i < 3; i++) {
            const user = `operator${i}`;
            const operator = new Operator(new MockTokenSwapClient(), user, multisigAddress, db, provider, networkId, parseInt(nbConfirmations), fromBlock);
            operators.push(operator);
        }
    });

    const receipts = [];
    it("...should burn funds.", async () => {
        for (let i = 1; i < 5; i++) {
            const recipient = 'enigma1um27s6ee62r8evnv7mz85fe4mz7yx6rkvzut0e';
            const tokenDecimals = web3.utils.toBN(18);
            const amount = tokenAmountToBurn.mul(web3.utils.toBN(10).pow(tokenDecimals));
            console.log('Burning funds from', accounts[i], 'to', recipient);
            const approveTx = await tokenContract.methods.approve(deployedSwap.address, amount).send({from: accounts[i]});
            expect(web3.utils.toChecksumAddress(approveTx.from)).to.equal(accounts[i]);
            expect(approveTx.status).to.equal(true);
            const burnTx = await swapContract.methods.burnFunds(web3.utils.fromAscii(recipient), amount).send({
                from: accounts[i],
                gas: 1000000,
            });
            expect(web3.utils.toChecksumAddress(burnTx.from)).to.equal(accounts[i]);
            expect(burnTx.status).to.equal(true);
            receipts.push(burnTx);
        }
        // Don't block the thread with the generator, this will go in one loop
        (async () => {
            await leader.run();
        })();
        // Let the leader populate the db
        await sleep(300);
        leader.burnWatcher.stop();
    });

    let nbSwaps;
    it("...should have one unsigned swap record in the database per LogBurn receipt emitted.", async () => {
        const unsignedSwaps = await db.findAllUnsignedSwaps();
        // Check that all events emitted match the receipts
        for (let swap of unsignedSwaps) {
            console.log('The unsigned swap', swap);
            for (let i = 0; i < receipts.length; i++) {
                if (receipts[i].transactionHash === swap.transactionHash) {
                    receipts.splice(i, 1);
                }
            }
        }
        expect(receipts.length).to.equal(0);
        nbSwaps = unsignedSwaps.length;
    });

    it("...should mine some dummy blocks to let all operators pick up and sign LogBurn events", async () => {
        let currentBlockNumber = await web3.eth.getBlockNumber();
        const targetBlockNumber = currentBlockNumber + parseInt(nbConfirmations);
        do {
            await mineBlock(web3);
            currentBlockNumber = await web3.eth.getBlockNumber();
            console.log('current/target block numbers', currentBlockNumber, targetBlockNumber);
        } while (currentBlockNumber < targetBlockNumber);
        // Don't block the thread with the generator, this will go in one loop per operator
        (async () => {
            for (const operator of operators) {
                (async () => {
                    await operator.run();
                })();
            }
        })();
        // Let each operator post their signature
        await sleep(300);
        for (const operator of operators) {
            operator.burnWatcher.stop();
        }
    });

    it("...should verify the operator signatures.", async () => {
        // Using threshold of 2 for 3 operators should return a positive
        const unsignedSwaps = await db.findAboveThresholdUnsignedSwaps(2);
        expect(unsignedSwaps.length).to.equal(nbSwaps);
    });

    it("...should mint one to one.", async () => {
        const unsignedSwaps = await db.findAboveThresholdUnsignedSwaps(2);
        const tokenDecimals = web3.utils.toBN(8);
        const amount = tokenAmountToBurn.mul(web3.utils.toBN(10).pow(tokenDecimals));
        for (const i in unsignedSwaps) {
            const swap = unsignedSwaps[i].unsignedTx.value.msg[0].value;

            expect(swap.AmountENG).to.equal(amount.toString());
        }
    });

    it("...should broadcast successfully.", async () => {
        
        (async () => {
            await leader.broadcastSignedSwaps();
        })();
        
        await sleep(1000);
        await leader.stopBroadcasting();
        const unsignedSwaps = await db.findAboveThresholdUnsignedSwaps(2);
        expect(unsignedSwaps.length).to.equal(0);
    });
});
