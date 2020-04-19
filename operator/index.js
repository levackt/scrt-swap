const {BurnWatcher} = require('../common/burn_watcher');
const { SWAP_STATUS_UNSIGNED } = require('../common/constants');

class Operator {
    /**
     * For each LogBurn event on Ethereum, submit signature to Leader
     *
     * @param {TokenSwapClient} tokenSwapClient - Implements token swap operations.
     * @param {Db} db
     * @param {string} user - The Enigma Chain operator key alias
     * @param {string} multisig - The multisig address
     * @param provider
     * @param networkId
     * @param nbConfirmation
     * @param fromBlock
     * @param pollingInterval
     */
    constructor(tokenSwapClient, user, multisig, db, provider, networkId, 
                nbConfirmation = 12, fromBlock = 0, pollingInterval = 30000) {
        this.user = user;
        this.multisig = multisig;
        this.burnWatcher = new BurnWatcher(provider, networkId, nbConfirmation, fromBlock, pollingInterval);
        this.db = db;
        this.tokenSwapClient = tokenSwapClient;
    }

    async run() {
        for await (let logBurn of this.burnWatcher.watchBurnLog()) {
            console.log('Operator', this.user, 'found LogBurn event', logBurn);
            const {transactionHash} = logBurn;
            let swap = null;
            try {
                swap = await this.db.fetchSwap(transactionHash);
                console.log('Found swap', swap);
            } catch (e) {
                // If this happens, skipped LogBurn will have to be re-processed either by resetting fromBlock or manually
                console.error('The operator found a LogBurn event unregistered by the Leader. Is the leader running.')
                //todo shutdown until leader is up again?
            }
            if (swap) {
                if (swap.status == SWAP_STATUS_UNSIGNED) {
                    try {
                        const signature = await this.tokenSwapClient.signTx(swap.unsignedTx);
                        await this.db.insertSignature(this.user, transactionHash, signature);
                        console.log(`signed tx hash ${transactionHash}`);
                    } catch (e) {
                        console.error('Cannot sign unsigned tx', swap.unsignedTx, logBurn, e);
                    }
                } else {
                    console.log(`Skipping signing ethTxHash=${transactionHash}`);
                }
            }
        }
    }
}

module.exports = {Operator};
