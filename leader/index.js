/* eslint-disable no-await-in-loop */
const logger = require('../common/logger');
const { sleep } = require('../common/utils');
const { BurnWatcher } = require('../common/burn_watcher');
const {
    SWAP_STATUS_UNSIGNED, SWAP_STATUS_SUBMITTED, SWAP_STATUS_CONFIRMED, SWAP_STATUS_FAILED
} = require('../common/constants');

/**
 * @typedef {Object} Swap
 * @property {string} _id - Database identifier (equal to tx hash)
 * @property {BigNumber} amount - The funds amount in ENG "grains"
 * @property {string} from - The account who locked the funds
 * @property {string} to - The target Cosmos address
 * @property {BigNumber} nonce - The lock nonce
 * @property {string} transactionHash - The transaction hash associated with the receipt
 * @property {string | null} mintTransactionHash - The Enigma Chain mint transaction hash
 * @property {string} unsignedTx - The unsigned transaction encoded in JSON
 * @property {number} status - 0=Unsigned; 1=Signed; 2=Submitted; 3=Confirmed
 * @param {CliSwapClient} tokenSwapClient - Implements token swap operations.
 */

/**
 * @typedef {Object} AboveThresholdUnsignedSwap
 * @property {string} transactionHash - The transaction hash associated with the receipt
 * @property {string} unsignedTx - The unsigned transaction encoded in JSON
 * @property {number} status - 0=Unsigned; 1=Signed; 2=Submitted; 3=Confirmed
 * @property {Array<string>} signatures - The signatures required to generate a multisig tx
 */

class Leader {
    /**
     * Responsible for populating the database with LogBurn events and submitting multisig messages on chain
     * when all M-of-N operators have signed
     *
     * Prerequisite: A multisig key must be generated offline generated offline:
     * `enigmacli keys add --multisig=name1,name2,name3[...] --multisig-threshold=K new_key_name`
     *
     * @param {string} multisig - The multisig address
     * @param {CliSwapClient} tokenSwapClient - Implements token swap operations.
     * @param {Db} db
     * @param provider
     * @param networkId
     * @param fromBlock
     * @param pollingInterval
     * @param multisigThreshold Minimum number of signatures to broadcast tx
     * @param broadcastInterval
     */
    constructor (tokenSwapClient, multisig, db, provider, networkId, fromBlock = 0, pollingInterval = 30000,
        multisigThreshold = 2, broadcastInterval = 7000) {
        this.multisig = multisig;
        this.multisigThreshold = multisigThreshold;
        this.broadcastInterval = broadcastInterval;
        this.burnWatcher = new BurnWatcher(provider, networkId, 0, fromBlock, pollingInterval);
        this.db = db;
        this.tokenSwapClient = tokenSwapClient;
        this.broadcasting = false;
        this.done = false;
    }

    async getSequence () {
        return this.tokenSwapClient.sequenceNumber();
    }

    async getAccountNumber () {
        return this.tokenSwapClient.getAccountNumber();
    }

    stopBroadcasting () {
        this.broadcasting = false;
    }

    async updateFailedSwap (transactionHash) {
        await this.db.updateSwapStatus(transactionHash, '', SWAP_STATUS_FAILED).catch(
            error => logger.error(`Failed to update value in database: ${error}`)
        );
    }

    async retrySubmittedSwap (transactionHash) {
        logger.info(`Retrying transactionHash=${transactionHash}`);
                await this.db.updateSwapStatus(transactionHash, '', SWAP_STATUS_UNSIGNED).catch(
            error => logger.error(`Failed to update value in database: ${error}`)
        );
    }

    async updateConfirmedTransaction (ethTxHash, mintTxHash) {
        await this.db.updateSwapStatus(ethTxHash, mintTxHash, SWAP_STATUS_CONFIRMED).catch(
            error => logger.error(`Failed to update value in database: ${error}`)
        );
    }

    async statusCheck(swap, result, attempts = 1) {
        const self = this;
        var done = false;
        setTimeout(async function() {
            try{
                done = await self.tokenSwapClient.isSwapDone(swap.transactionHash)
                if (done) {
                    logger.info(`Completing txHash=${result.txhash}`);
                    self.updateConfirmedTransaction(swap.transactionHash, result.txhash);
                } else {
                    logger.info(`Rechecking txHash=${result.txhash}`);
                }
            } catch (e) {
                logger.error(`Swap not done yet: ${e}`);
            }
            
            attempts++;
            if (attempts < 10 && !done) {
                logger.info(`statusCheck attempt ${attempts}`);
                self.statusCheck(swap, result, attempts);
            }
        }, 1000)
    }

    // noinspection FunctionWithMultipleLoopsJS
    async broadcastSignedSwaps () {
        logger.info('Watching for signed swaps');
        this.broadcasting = true;
        do {
            const signedSwaps = await this.db.findAboveThresholdUnsignedSwaps(this.multisigThreshold);
            logger.info(`Found ${signedSwaps.length} swaps`);

            // eslint-disable-next-line no-restricted-syntax
            for (const swap of signedSwaps) {
                try {
                    const result = JSON.parse(
                        await this.tokenSwapClient.broadcastTokenSwap(swap.signatures, swap.unsignedTx, swap.sequence, swap.accountNumber).catch(
                            async (error) => {
                                logger.error(`Failed to append signatures, or broadcast transaction: ${error}`);
                                await this.updateFailedSwap(swap.transactionHash);
                            }
                        )
                    );
                    if (result.txhash) {
                        await this.db.updateSwapStatus(swap.transactionHash, result.txhash, SWAP_STATUS_SUBMITTED);
                        await this.statusCheck(swap, result);
                    } else {
                        logger.error(`Txhash not found in returned result: ${result}`);
                        await this.updateFailedSwap(swap.transactionHash);
                    }
                } catch (err) {
                    logger.error(`Unknown error: ${err} - on swap ${swap}`);
                }
            }

            // todo: move this to a different handler

            // wait 1 block for txs to be verified
            await sleep(this.broadcastInterval);

            const submittedTxs = await this.db.findAllByStatus(SWAP_STATUS_SUBMITTED);
            await Promise.all(
                submittedTxs.map(async (swap) => {
                    try {
                        if (await this.tokenSwapClient.isSwapDone(swap.transactionHash)) {
                            await this.updateConfirmedTransaction(swap.transactionHash, swap.mintTransactionHash);
                        } else {
                            await this.retrySubmittedSwap(swap.transactionHash);
                        }
                    } catch(e) {
                        logger.error(`Failed to check swap status of transactionHash: ${swap.transactionHash}, error: ${e}`);
                        await this.updateFailedSwap(swap.transactionHash);
                    }
                })
            );
        } while (this.broadcasting);
    }

    stop () {
        this.burnWatcher.stop();
        this.done = true;
    }

    async run () {
        this.done = false;
        let sequenceNumber = parseInt(await this.getSequence(), 10);
        const accountNumber = parseInt(await this.getAccountNumber(), 10);
        // let accountNumber = await this.getAccountNumber();
        // eslint-disable-next-line no-restricted-syntax
        for await (const logBurn of this.burnWatcher.watchBurnLog()) {
            try {
                const dbSwap = await this.db.fetchSwap(logBurn.transactionHash);

                if (dbSwap) {
                    logger.error(`Swap already exists for ethTxHash=${logBurn.transactionHash}`);
                } else {
                    const unsignedTx = await this.tokenSwapClient.generateTokenSwap(
                        logBurn.transactionHash,
                        logBurn.from,
                        logBurn.amount,
                        logBurn.to
                    );

                    /** @type Swap */
                    const unsignedSwap = {
                        ...logBurn,
                        sequence: sequenceNumber,
                        accountNumber,
                        _id: logBurn.transactionHash,
                        mintTransactionHash: null,
                        unsignedTx,
                        status: SWAP_STATUS_UNSIGNED
                    };

                    sequenceNumber += 1;

                    logger.info('Storing unsigned swap', logBurn);
                    await this.db.insertUnsignedSwap(unsignedSwap);
                }
            } catch (e) {
                logger.error(`Cannot create unsigned tx: ${JSON.stringify(logBurn)}, error: ${e}`);
            }
            if (this.done) {
                logger.info('Stop called. Shutting down leader');
                return;
            }
        }
    }
}

module.exports = { Leader };
