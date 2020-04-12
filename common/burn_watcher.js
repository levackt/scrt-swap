const Web3 = require('web3');
const EngSwap = require("../client/src/contracts/EngSwap.json");

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
                const logBurn = {
                    transactionHash: evt.transactionHash,
                    from: this.web3.utils.toChecksumAddress(evt.returnValues['_from']),
                    to: this.web3.utils.hexToAscii(evt.returnValues['_to']), // The Cosmos chain address
                    amount: evt.returnValues['_amount'], 
                    nonce: evt.returnValues['_nonce'],
                };
                yield logBurn;
            }
            await new Promise((resolve) => {
                setTimeout(() => resolve(true), this.pollingInterval);
            })
        } while (this.watching);
    }

    /**
     * Stop polling for events
     */
    stop() {
        this.watching = false;
    }
}

module.exports = {BurnWatcher};
