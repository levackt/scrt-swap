const Web3 = require('web3');
const EngSwap = require("../client/src/contracts/EngSwap.json");
const cosmos = require('cosmos-lib');

/**
 * @typedef {Object} LogBurn
 * @property {BigNumber} amount - The funds amount in ENG "grains"
 * @property {string} from - The account who locked the funds
 * @property {string} to - The target Cosmos address
 * @property {BigNumber} nonce - The lock nonce
 * @property {string} transactionHash - The transaction hash associated with the receipt
 */

class BurnWatcher {
    constructor(provider, networkId, nbConfirmations = 0, fromBlock = 0, pollingInterval = 1000) {
        this.web3 = new Web3(provider);
        const deployedSwap = EngSwap.networks[networkId];
        this.fromBlock = fromBlock;
        this.swapContract = new this.web3.eth.Contract(
            EngSwap.abi,
            deployedSwap.address,
        );
        this.watching = false;
        this.pollingInterval = pollingInterval;
        this.nbConfirmations = nbConfirmations;
    }

    /**
     * Watch the chain and yield for each LogLock event
     * @returns {AsyncGenerator<LogLock, void, ?>}
     */
    async* watchBurnLog() {
        console.log('Watching for locked funds');
        this.watching = true;
        do {
            const currentBlock = await this.web3.eth.getBlockNumber();
            // Delay reading events by N confirmations (block numbers)
            // Using the default 'latest' would emit events that could be reverted in a reorg
            const toBlock = (this.nbConfirmations === 0) ? currentBlock : currentBlock - this.nbConfirmations;
            // Polling supports more provider than "subscribing" and easier to resume
            const evts = await this.swapContract.getPastEvents('LogBurn', {
                fromBlock: this.fromBlock,
                toBlock,
            });
            if (this.nbConfirmations > 0) {
                console.log('Delayed query with confirmations');
            }
            console.log('Got events', evts);
            for (const evt of evts) {
                const blockPosition = evt.blockNumber;
                // Always greater than 0 on mainnet
                this.fromBlock = ((blockPosition > 0) ? blockPosition : 0) + 1;

                //convert eth wei units
                const burnAmount = evt.returnValues['_amount'];
                const cosmosDecimals = Web3.utils.toBN(8);

                const amount = Web3.utils.toBN(Web3.utils.fromWei(burnAmount))
                    .mul(Web3.utils.toBN(10).pow(cosmosDecimals)).toString();
                
                //todo validate cosmos address checksum                
                const cosmosAddress = Web3.utils.hexToAscii(evt.returnValues['_to'])
                if (this.isValidCosmosAddress(cosmosAddress)) {
                    const logBurn = {
                        transactionHash: evt.transactionHash,
                        from: Web3.utils.toChecksumAddress(evt.returnValues['_from']),
                        amount: amount,
                        to: cosmosAddress,
                        nonce: evt.returnValues['_nonce'],
                    };
                    yield logBurn;
                } else {
                    console.error(`Invalid recipient: ${cosmosAddress}, transactionHash:${ evt.transactionHash}`);
                }
            }
            await new Promise((resolve) => {
                setTimeout(() => resolve(true), this.pollingInterval);
            })
        } while (this.watching);
    }

    /**
     * Checksum the recipient address.
     */
    isValidCosmosAddress(recipient) {
        try {
            cosmos.address.getBytes32(recipient);
            return true
        } catch (error) {
            console.error(error)
        }
        return false;
    }

    /**
     * Stop polling for events
     */
    stop() {
        this.watching = false;
    }
}

module.exports = {BurnWatcher};
