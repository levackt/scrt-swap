const { sleep } = require('../common/utils');
const logger = require('../common/logger');
const { BurnWatcher } = require('../common/burn_watcher');
const { SWAP_STATUS_UNSIGNED } = require('../common/constants');

class Operator {
    /**
     * For each LogBurn event on Ethereum, submit signature to Leader
     *
     * @param {CliSwapClient} tokenSwapClient - Implements token swap operations.
     * @param {Db} db
     * @param {string} user - The Enigma Chain operator key alias
     * @param {string} multisig - The multisig address
     * @param provider
     * @param networkId
     * @param nbConfirmation
     * @param fromBlock
     * @param pollingInterval
     */
    constructor (tokenSwapClient, user, multisig, db, provider, networkId,
        nbConfirmation = 12, fromBlock = 0, pollingInterval = 3000) {
        this.user = user;
        this.multisig = multisig;
        this.pollingInterval = pollingInterval;
        this.burnWatcher = new BurnWatcher(provider, networkId, nbConfirmation, fromBlock, pollingInterval);
        this.db = db;
        this.tokenSwapClient = tokenSwapClient;
        this.done = false;
    }

    stop () {
        this.burnWatcher.stop();
        this.done = true;
        process.exit(0);
    }

    async run () {
        this.done = false;
        for await (const logBurn of this.burnWatcher.watchBurnLog()) {
            logger.info(`Operator: ${this.user}. found LogBurn event: ${JSON.stringify(logBurn)}`);
            const { transactionHash } = logBurn;
            try {
                const swap = await this.db.fetchSwap(transactionHash);
                if (!swap) {
                    throw new Error(`No record of swap for txHash=${transactionHash}`);
                }
                if (swap.status === SWAP_STATUS_UNSIGNED) {
                    try {
                        const signature = await this.tokenSwapClient.signTx(swap.unsignedTx, swap.sequence, swap.accountNumber);
                        await this.db.insertSignature(this.user, transactionHash, JSON.parse(signature));
                        logger.info(`signed tx hash ${transactionHash}`);
                    } catch (e) {
                        logger.error(`Cannot sign unsigned tx ${swap.unsignedTx}, ${logBurn}, error: ${e}`);
                    }
                } else {
                    logger.info(`Skipping signing ethTxHash=${transactionHash}`);
                }
            } catch (e) {
                // If this happens, skipped LogBurn will have to be re-processed either by resetting fromBlock or manually
                logger.error(`The operator found a LogBurn event unregistered by the Leader. Is the leader running? ${e}`);
                await sleep(10000);
                this.stop();
            }
            if (this.done) {
                logger.info('Stop called. Shutting down operator');
                return;
            }
        }
    }
}

module.exports = { Operator };
