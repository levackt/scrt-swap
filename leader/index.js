/* eslint-disable no-await-in-loop */
const logger = require('../common/logger');
const { sleep } = require('../common/utils');
const { BurnWatcher } = require('../common/burn_watcher');
const { SWAP_STATUS_UNSIGNED, SWAP_STATUS_SUBMITTED, SWAP_STATUS_CONFIRMED } = require('../common/constants');

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
        multisigThreshold = 2, broadcastInterval = 1000) {
        this.multisig = multisig;
        this.multisigThreshold = multisigThreshold;
        this.broadcastInterval = broadcastInterval;
        this.burnWatcher = new BurnWatcher(provider, networkId, 0, fromBlock, pollingInterval);
        this.db = db;
        this.tokenSwapClient = tokenSwapClient;
        this.broadcasting = false;
    }

    stopBroadcasting () {
        this.broadcasting = false;
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
                const result = await this.tokenSwapClient.broadcastTokenSwap(
                    swap.signatures,
                    swap.unsignedTx
                );
                if (result.txhash) {
                    await this.db.updateSwapStatus(swap.transactionHash,
                        result.txhash, SWAP_STATUS_SUBMITTED);
                } else {
                    logger.error(`broadcastSignedSwaps result: ${result}`);
                }
            }

            const submittedTxs = await this.db.findAllByStatus(SWAP_STATUS_SUBMITTED);
            await Promise.all(
                submittedTxs.map(async (swap) => {
                    if (await this.tokenSwapClient.isSwapDone(swap.transactionHash)) {
                        await this.db.updateSwapStatus(swap.transactionHash,
                            swap.mintTransactionHash, SWAP_STATUS_CONFIRMED);
                    }
                })
            );

            await sleep(this.broadcastInterval);
        } while (this.broadcasting);
    }

    async run () {
        // eslint-disable-next-line no-restricted-syntax
        for await (const logBurn of this.burnWatcher.watchBurnLog()) {
            try {
                const dbSwap = await this.db.fetchSwap(logBurn.transactionHash);

                if (dbSwap) {
                    logger.error('Swap already exists for ethTxHash=', logBurn.transactionHash);
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
                        _id: logBurn.transactionHash,
                        mintTransactionHash: null,
                        unsignedTx,
                        status: SWAP_STATUS_UNSIGNED
                    };
                    logger.info('Storing unsigned swap', logBurn);
                    await this.db.insertUnsignedSwap(unsignedSwap);
                }
            } catch (e) {
                logger.error('Cannot create unsigned tx', logBurn, e);
            }
        }
    }
}

module.exports = { Leader };
