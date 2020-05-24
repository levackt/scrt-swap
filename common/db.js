const { MongoClient } = require('mongodb');
const Web3 = require('web3');
const logger = require('../common/logger');
const {
    SWAP_STATUS_UNSIGNED, SWAP_STATUS_SUBMITTED, SWAP_STATUS_SIGNED, SWAP_STATUS_CONFIRMED
} = require('./constants');

const SWAP_COLLECTION = 'swap';
const SIGNATURE_COLLECTION = 'signature';

class Db {
    constructor (url, dbName) {
        this.url = url;
        this.dbName = dbName;
    }

    async init () {
        this.client = await MongoClient.connect(this.url, { useUnifiedTopology: true });
        this.db = this.client.db(this.dbName);
    }

    async teardown () {
        if (!this.client) {
            throw new Error('No Mongo client, accountant not initialized');
        }
        logger.info('Closing db connection');
        return this.client.close();
    }

    async clear (collection) {
        await this.db.collection(collection).deleteMany({});
        logger.info('Deleted all rows', collection);
    }

    /**
     * Insert LogBurn event emitted by Ethereum
     *
     * @param {Swap} unsignedSwap
     * @returns boolean
     */
    // eslint-disable-next-line class-methods-use-this
    validateSwap (unsignedSwap) {
        try {
            if (!unsignedSwap.unsignedTx.value || !unsignedSwap.transactionHash) {
                logger.error(`Error validating inserted swap. Details: ${unsignedSwap}`);
                return false;
            }
            return unsignedSwap.status === SWAP_STATUS_UNSIGNED;
        } catch (e) {
            logger.error(`Error validating inserted swap. Error: ${e}. Details: ${unsignedSwap}`);
            return false;
        }
    }

    /**
     * Insert LogBurn event emitted by Ethereum
     *
     * @param {Swap} unsignedSwap
     */
    async insertUnsignedSwap (unsignedSwap) {
        if (!this.validateSwap(unsignedSwap)) {
            throw new Error('Invalid unsigned swap');
        }
        const record = {
            ...unsignedSwap,
            amount: unsignedSwap.amount.toString()
        };
        this.db.collection(SWAP_COLLECTION).insertOne(record);
    }

    async insertSignature (user, transactionHash, signature) {
        const query = { _id: signature.signature };
        const exists = await this.db.collection(SIGNATURE_COLLECTION).findOne(query);
        if (exists) {
            logger.info(`Signature exists for txHash=${transactionHash}`)
            return
        }
        const record = {
            _id: signature.signature, user, transactionHash, signature
        };
        this.db.collection(SIGNATURE_COLLECTION).insertOne(record);
    }

    /**
     * Fetch the specified swap
     *
     * @param {string} transactionHash
     * @returns {Promise<Swap>}
     */
    async fetchSwap (transactionHash) {
        const query = { _id: transactionHash };
        const swap = await this.db.collection(SWAP_COLLECTION).findOne(query);
        if (swap) {
            swap.amount = Web3.utils.toBN(swap.amount);
            swap.nonce = Web3.utils.toBN(swap.nonce);
        }
        return swap;
    }

    /**
     * Updates the swap status.
     * @param transactionHash
     * @param mintTransactionHash - The Enigma Chain mint transaction hash
     * @param status - blockchain status
     */
    async updateSwapStatus (transactionHash, mintTransactionHash, status) {
        logger.info(`updating swap ethTxHash=${transactionHash}, mintTransactionHash=${mintTransactionHash}, \
        status=${status}`);

        const query = { _id: transactionHash };

        const values = { $set: { status, mintTransactionHash } };
        this.db.collection(SWAP_COLLECTION).updateOne(query, values, (err, res) => {
            if (err) {
                throw err;
            }
            logger.info(`Updated transactionHash=${transactionHash}`);
        });
    }

    /**
     * Find all by status.
     *
     * @returns {Promise<Array<Swap>>}
     */
    async findAllByStatus (status) {
        const query = { status };
        const result = await this.db.collection(SWAP_COLLECTION).find(query);
        const swaps = await result.toArray();
        for (const swap of swaps) {
            swap.amount = Web3.utils.toBN(swap.amount);
            swap.nonce = Web3.utils.toBN(swap.nonce);
        }
        return swaps;
    }

    /**
     * Finds above threshold swap (multisig tx candidates)
     *
     * @param {number} threshold
     * @returns {Promise<Array<AboveThresholdUnsignedSwap>>}
     */
    async findAboveThresholdUnsignedSwaps (threshold) {
        const unsignedSwaps = await this.findAllByStatus(SWAP_STATUS_UNSIGNED);
        const aboveThresholdUnsignedSwaps = [];
        await Promise.all(unsignedSwaps.map(async (swap) => {
            const { transactionHash, unsignedTx, status, sequence, accountNumber } = swap;
            // TODO: Consider indexing this field
            const query = { transactionHash: swap.transactionHash };
            // Slightly inefficient to fetch results instead on counting, but saves us from querying twice
            const result = await this.db.collection(SIGNATURE_COLLECTION).find(query);
            const signatures = await result.toArray();
            if (signatures.length >= threshold) {
                aboveThresholdUnsignedSwaps.push({
                    transactionHash,
                    unsignedTx,
                    status,
                    signatures,
                    sequence,
                    accountNumber
                });
            }
        }));
        return aboveThresholdUnsignedSwaps;
    }
}

module.exports = { Db, SWAP_COLLECTION, SIGNATURE_COLLECTION };
