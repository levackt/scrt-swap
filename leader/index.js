const {BurnWatcher} = require('../common/burn_watcher');

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
 * @param {TokenSwapClient} tokenSwapClient - Implements token swap operations.
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
     * @param {TokenSwapClient} tokenSwapClient - Implements token swap operations.
     * @param {Db} db
     * @param provider
     * @param networkId
     * @param fromBlock
     * @param pollingInterval
     */
    constructor(tokenSwapClient, multisig, db, provider, networkId, fromBlock = 0, pollingInterval = 30000) {
        this.multisig = multisig;
        this.burnWatcher = new BurnWatcher(provider, networkId, 0, fromBlock, pollingInterval);
        this.db = db;
        this.tokenSwapClient = tokenSwapClient;
    }

    async run() {
        for await (let logBurn of this.burnWatcher.watchBurnLog()) {
            try {
                const unsignedTx = this.tokenSwapClient.generateTokenSwap(
                    logBurn.transactionHash, 
                    logBurn.from, 
                    logBurn.amount, 
                    logBurn.to
                );

                // Sign the tx so any thresholder can verify and broadcast
                const leaderSignature = await this.tokenSwapClient.signTokenSwapRequest(unsignedTx);
                console.log(`leaderSignature: ${leaderSignature}`)
                
                /** @type Swap */
                const unsignedSwap = {
                    ...logBurn,
                    _id: logBurn.transactionHash,
                    mintTransactionHash: null,
                    unsignedTx,
                    status: 0,
                    leaderSignature
                };
                console.log('Storing unsigned swap', logBurn);
                await this.db.insertUnsignedSwap(unsignedSwap);
            } catch (e) {
                console.error('Cannot create unsigned tx', logBurn, e);
            }
        }
    }
}

module.exports = {Leader};
