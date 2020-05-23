/* eslint-disable no-underscore-dangle,no-await-in-loop */
const Web3 = require('web3');
const EngSwap = require('../client/src/contracts/EngSwap.json');
const { sleep, isValidCosmosAddress } = require('./utils');
const logger = require('../common/logger');

/**
 * @typedef {Object} LogBurn
 * @property {string} amount - The funds amount in ENG "grains"
 * @property {string} from - The account who locked the funds
 * @property {string} to - The target Cosmos address
 * @property {string} nonce - The lock nonce
 * @property {string} transactionHash - The transaction hash associated with the receipt
 */

class BurnWatcher {
    constructor (provider, networkId, nbConfirmations = 0, fromBlock = 0, pollingInterval = 1000) {
        this.web3 = new Web3(provider);
        const deployedSwap = EngSwap.networks[networkId];
        this.fromBlock = fromBlock;
        this.swapContract = new this.web3.eth.Contract(
            EngSwap.abi,
            deployedSwap.address
        );
        this.watching = false;
        this.pollingInterval = pollingInterval;
        this.nbConfirmations = nbConfirmations;
    }

    /**
     * Watch the chain and yield for each LogLock event
     * @returns {AsyncGenerator<LogBurn, void, ?>}
     */
    async * watchBurnLog () {
        logger.info('Watching for locked funds');
        this.watching = true;
        do {
            const currentBlock = await this.web3.eth.getBlockNumber();
            // Delay reading events by N confirmations (block numbers)
            // Using the default 'latest' would emit events that could be reverted in a reorg
            const toBlock = (this.nbConfirmations === 0) ? currentBlock : currentBlock - this.nbConfirmations;
            // Polling supports more provider than "subscribing" and easier to resume
            const evts = await this.swapContract.getPastEvents('LogBurn', {
                fromBlock: this.fromBlock,
                toBlock
            });
            if (this.nbConfirmations > 0) {
                logger.info('Delayed query with confirmations');
            }
            logger.info('Got events', evts);
            for (const evt of evts) {
                const blockPosition = evt.blockNumber;
                // Always greater than 0 on mainnet
                this.fromBlock = ((blockPosition > 0) ? blockPosition : 0) + 1;

                
                const cosmosAddress = Web3.utils.hexToAscii(evt.returnValues._to);
                if (isValidCosmosAddress(cosmosAddress)) {
                    const logBurn = {
                        transactionHash: evt.transactionHash,
                        from: Web3.utils.toChecksumAddress(evt.returnValues._from),
                        amount: evt.returnValues._amount,
                        to: cosmosAddress,
                        nonce: evt.returnValues._nonce
                    };
                    yield logBurn;
                } else {
                    logger.error(`Invalid recipient: ${cosmosAddress}, transactionHash:${evt.transactionHash}`);
                }
            }
            // eslint-disable-next-line no-await-in-loop
            await sleep(this.pollingInterval);
        } while (this.watching);
    }

    /**
     * Stop polling for events
     */
    stop () {
        this.watching = false;
    }
}

module.exports = { BurnWatcher };
