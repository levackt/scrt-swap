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
     * @param multisigThreshold Minimum number of signatures to broadcast tx
     */
    constructor(tokenSwapClient, multisig, db, provider, networkId, fromBlock = 0, pollingInterval = 30000, 
        multisigThreshold = 2, broadcastInterval = 1000) {
        this.multisig = multisig;
        this.multisigThreshold = multisigThreshold;
        this.broadcastInterval = broadcastInterval;
        this.burnWatcher = new BurnWatcher(provider, networkId, 0, fromBlock, pollingInterval);
        this.db = db;
        this.tokenSwapClient = tokenSwapClient;
        this.broadcasting = false;
    }

    stopBroadcasting() {
        this.broadcasting = false;
    }

    async broadcastSignedSwaps() {
        console.log('Watching for signed swaps');
        this.broadcasting = true;
        do {
            const signedSwaps = await this.db.findAboveThresholdUnsignedSwaps(this.multisigThreshold);
            console.log(`Found ${signedSwaps.length} swaps`)
            for (const swap in signedSwaps) {
                const result = await this.tokenSwapClient.broadcastTokenSwap(
                    signedSwaps[swap].signatures, 
                    signedSwaps[swap].unsignedTx
                );
                if (result.txhash && this.tokenSwapClient.isSwapDone(result.txhash)) {
                    await this.db.completeSwap(signedSwaps[swap].transactionHash, result.txhash);
                } else {
                    console.error(`broadcastSignedSwaps result: ${result}`)
                }
            }
            await new Promise((resolve) => {
                setTimeout(() => resolve(true), this.broadcastInterval);
            })
        } while (this.broadcasting);
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

                // Sign the tx so any operator can verify
                const leaderSignature = await this.tokenSwapClient.signTx(logBurn);
                
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
                //todo query tx hash in tokenswap and update status
            }
        }
    }
}

module.exports = {Leader};
