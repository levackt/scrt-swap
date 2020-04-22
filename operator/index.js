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
        nbConfirmation = 12, fromBlock = 0, pollingInterval = 30000) {
        this.user = user;
        this.multisig = multisig;
        this.pollingInterval = pollingInterval;
        this.burnWatcher = new BurnWatcher(provider, networkId, nbConfirmation, fromBlock, pollingInterval);
        this.db = db;
        this.tokenSwapClient = tokenSwapClient;
    }

    async run () {
        for await (const logBurn of this.burnWatcher.watchBurnLog()) {
            logger.info(`Operator: ${this.user}. found LogBurn event: ${logBurn}`);
            const { transactionHash } = logBurn;
            try {
                const swap = await this.db.fetchSwap(transactionHash);
                logger.info('Found swap', swap);
                if (swap.status === SWAP_STATUS_UNSIGNED) {
                    try {
                        const signature = await this.tokenSwapClient.signTx(swap.unsignedTx);
                        await this.db.insertSignature(this.user, transactionHash, signature);
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
                // todo shutdown until leader is up again?
                // just putting it to sleep for now
                await sleep(this.pollingInterval);
            }
        }
    }
}

module.exports = { Operator };
