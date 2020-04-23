/* eslint-disable no-await-in-loop,no-undef,no-console */


require('dotenv').config();
const Web3 = require('web3');
const { expect } = require('chai');
const { Leader } = require('../leader');
const { Operator } = require('../operator');
const { Db, SWAP_COLLECTION, SIGNATURE_COLLECTION } = require('../common/db');
const { CliSwapClient } = require('../common/cli_swap_client');
const EngSwap = require('../client/src/contracts/EngSwap.json');
const EngToken = require('../client/src/contracts/EngToken.json');
const { mineBlock } = require('../common/ganache');
const { SWAP_STATUS_UNSIGNED, SWAP_STATUS_CONFIRMED } = require('../common/constants');

async function sleep (ms) {
    await new Promise((resolve) => {
        setTimeout(() => resolve(true), ms);
    });
}

describe('EngSwap', () => {
    const multisigAddress = process.env.MULTISIG_ADDRESS || 'enigma1n4pc2w3us9n4axa0ppadd3kv3c0sar8c4ju6k7';
    const ethHost = process.env.ETH_HOST || 'localhost';
    const ethPort = process.env.ETH_PORT || '8545';
    const networkId = process.env.NETWORK_ID || '50';
    const leaderAccount = 'smt1';
    const chainClient = 'docker exec -i swaptest4 bash -c "enigmacli';
    const pollingInterval = 1000;
    const multisigThreshold = 2;
    const broadcastInterval = 7000;
    const provider = new Web3.providers.HttpProvider(`http://${ethHost}:${ethPort}`);
    const web3 = new Web3(provider);
    const deployedSwap = EngSwap.networks[networkId];
    const deployedToken = EngToken.networks[networkId];
    const db = new Db('mongodb://root:rootpassword@localhost:27017/', 'enigma-swap');

    let swapContract;
    let tokenContract;
    let accounts;
    let leader;
    let leaderSwapClient;
    let operatorSwapClients;
    const operators = [];
    const testConfig = {
        numOfSwaps: 2,
        burnWatcherDelay: 1000,
        stopWaitTime: 100,
        leaderSwapDelay: 3000,
        signingDelay: 2000,
        broadcastInterval: 7000,
        pollingInterval: 1000,
        multisigThreshold: 2,
        numOfOperators: 2,
        confirmations: 2,
        operatorAccounts: ['t2', 't3'],
        leaderAccount: 'smt1',
        chainClient: 'docker exec -i swaptest4 bash -c "enigmacli',
        password: '',
        recipient: 'enigma1um27s6ee62r8evnv7mz85fe4mz7yx6rkvzut0e'
    };

    const tokenAmountToBurn = web3.utils.toBN(10);
    before(async () => {
        if (!deployedSwap || !deployedToken) {
            throw new Error('Deployed contract not found');
        }

        // ****** Initialize database  ******

        await db.init().catch(
            (_) => {
                console.log('Error connecting to database');
                fail();
            }
        );
        await db.clear(SWAP_COLLECTION);
        await db.clear(SIGNATURE_COLLECTION);

        // eslint-disable-next-line max-len
        // await executeCommand(`${chainClient} tx send enigma1srk8yx8y0q3u4jamdzvz2qenpehay66j3dj0tg enigma1n4pc2w3us9n4axa0ppadd3kv3c0sar8c4ju6k7 10000000uscrt --keyring-backend test --yes"`);

        // ****** Initialize leader + operators  ******
        const fromBlock = await web3.eth.getBlockNumber();
        leaderSwapClient = new CliSwapClient(chainClient, leaderAccount, multisigAddress, testConfig.password);
        operatorSwapClients = testConfig.operatorAccounts.flatMap(
            acc => new CliSwapClient(chainClient, acc, multisigAddress, testConfig.password)
        );

        leader = new Leader(leaderSwapClient, multisigAddress, db, provider, networkId,
            fromBlock, pollingInterval, multisigThreshold, broadcastInterval);

        //  ****** Initialize contracts ******

        swapContract = new web3.eth.Contract(
            EngSwap.abi,
            deployedSwap.address
        );
        tokenContract = new web3.eth.Contract(
            EngToken.abi,
            deployedToken.address
        );

        accounts = await web3.eth.getAccounts();

        for (let i = 1; i < testConfig.numOfSwaps + 1; i++) {
            const tokenDecimals = web3.utils.toBN(18);
            const tokenAmountToTransfer = web3.utils.toBN(100);
            const amount = tokenAmountToTransfer.mul(web3.utils.toBN(10).pow(tokenDecimals));
            await tokenContract.methods.transfer(accounts[i], amount).send({ from: accounts[0] });
            const balance = await tokenContract.methods.balanceOf(accounts[i]).call();
            console.log('Account', accounts[i], ':', balance);
        }
        for (let i = 0; i < testConfig.numOfOperators; i++) {
            const user = `operator${i}`;
            const operator = new Operator(operatorSwapClients[i], user, multisigAddress, db, provider, networkId,
                parseInt(testConfig.confirmations), fromBlock);
            operators.push(operator);
        }
    });

    const receipts = [];
    it('...should burn funds.', async () => {
        for (let i = 1; i < testConfig.numOfSwaps + 1; i++) {
            const tokenDecimals = web3.utils.toBN(18);
            const amount = tokenAmountToBurn.mul(web3.utils.toBN(10).pow(tokenDecimals));
            console.log('Burning funds from', accounts[i], 'to', testConfig.recipient);
            const approveTx = await tokenContract.methods.approve(deployedSwap.address, amount).send({ from: accounts[i] });
            expect(web3.utils.toChecksumAddress(approveTx.from)).to.equal(accounts[i]);
            expect(approveTx.status).to.equal(true);
            const burnTx = await swapContract.methods.burnFunds(web3.utils.fromAscii(testConfig.recipient), amount).send({
                from: accounts[i],
                gas: 1000000
            });
            expect(web3.utils.toChecksumAddress(burnTx.from)).to.equal(accounts[i]);
            expect(burnTx.status).to.equal(true);
            receipts.push(burnTx);
        }
        // Don't block the thread with the generator, this will go in one loop
        leader.run();

        // Let the leader populate the db
        await sleep(testConfig.numOfSwaps * testConfig.burnWatcherDelay);
        leader.stop();
    }).timeout(5000);

    it('...should have one unsigned swap record in the database per LogBurn receipt emitted.', async () => {
        const unsignedSwaps = await db.findAllByStatus(SWAP_STATUS_UNSIGNED);
        // Check that all events emitted match the receipts
        const remainingSwaps = unsignedSwaps.filter(
            swap => (receipts.find(
                receipt => receipt.transactionHash === swap.transactionHash
            ) === undefined)
        );
        expect(remainingSwaps.length).to.equal(0);
    });

    it('...should mine some dummy blocks to let all operators pick up and sign LogBurn events', async () => {
        await Promise.all([...Array(testConfig.confirmations)].map(
            // eslint-disable-next-line no-return-await
            async _ => await mineBlock(web3)
        ));

        // Don't block the thread with the generator, this will go in one loop per operator
        Promise.all(operators.map(async (op) => {
            await op.run();
        })).then(
            res => console.log('All operators stopped')
        ).catch(
            err => console.log(`Error while running operators: ${err}`)
        );

        // Let each operator post their signature
        await sleep(testConfig.signingDelay * testConfig.numOfSwaps);
        operators.forEach(op => op.stop());

        await sleep(testConfig.stopWaitTime);
    }).timeout(testConfig.signingDelay * testConfig.numOfSwaps * 2);

    it('...should verify the operator signatures.', async () => {
        const unsignedSwaps = await db.findAboveThresholdUnsignedSwaps(testConfig.multisigThreshold);
        expect(unsignedSwaps.length).to.equal(testConfig.numOfSwaps);
    });

    it('...should mint one to one.', async () => {
        const unsignedSwaps = await db.findAboveThresholdUnsignedSwaps(testConfig.multisigThreshold);
        const tokenDecimals = web3.utils.toBN(8);
        const amount = tokenAmountToBurn.mul(web3.utils.toBN(10).pow(tokenDecimals));
        for (const swap of unsignedSwaps) {
            const swapAmt = swap.unsignedTx.value.msg[0].value.AmountENG;
            expect(swapAmt).to.equal(`${amount.toString()}.000000000000000000`);
        }

        // verify broadcast successfully
        leader.broadcastSignedSwaps();

        // wait 1 block and a little more
        await sleep(testConfig.broadcastInterval + testConfig.pollingInterval * testConfig.numOfSwaps);

        leader.stopBroadcasting();

        const remainingUnsignedSwaps = await db.findAboveThresholdUnsignedSwaps(testConfig.multisigThreshold);
        expect(remainingUnsignedSwaps.length).to.equal(0);

        await Promise.all(unsignedSwaps.map(async (swap) => {
            const fromDb = await db.fetchSwap(swap.transactionHash);
            expect(fromDb.status).to.equal(SWAP_STATUS_CONFIRMED);
            expect(fromDb.mintTransactionHash).to.not.be.empty;
            expect(fromDb.transactionHash).to.not.be.empty;
        }));

    }).timeout(testConfig.leaderSwapDelay * testConfig.numOfSwaps * 2);
});
