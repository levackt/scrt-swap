const {BurnWatcher} = require('../common/burn_watcher');

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
     * @param leaderAccount Required to verify swap was created by leader.
     * @param nbConfirmation
     * @param fromBlock
     * @param pollingInterval
     */
    constructor(tokenSwapClient, user, multisig, db, provider, networkId, 
                leaderAccount, nbConfirmation = 12,
                fromBlock = 0, pollingInterval = 30000) {
        this.user = user;
        this.multisig = multisig;
        this.burnWatcher = new BurnWatcher(provider, networkId, nbConfirmation, fromBlock, pollingInterval);
        this.db = db;
        this.tokenSwapClient = tokenSwapClient;
        this.leaderAccount = leaderAccount;
    }

    async run() {
        for await (let logBurn of this.burnWatcher.watchBurnLog()) {
            console.log('Operator', this.user, 'found LogBurn event', logBurn);
            const {transactionHash} = logBurn;
            let unsignedTx = null;
            try {
                unsignedTx = await this.db.fetchUnsignedTx(transactionHash);
                console.log('Found unsigned tx to sign', unsignedTx);
            } catch (e) {
                // If this happens, skipped LogBurn will have to be re-processed either by resetting fromBlock or manually
                console.error('The operator found a LogBurn event unregistered by the Leader. Is the leader running.')
                //todo shutdown until leader is up again?
            }
            if (unsignedTx) {
                //todo WIP: verify this.leaderAccount signed logBurn
                try {
                    const signature = await this.tokenSwapClient.signTx(unsignedTx);
                    await this.db.insertSignature(this.user, transactionHash, signature);
                    console.log(`signed tx hash ${transactionHash}`);                    
                } catch (e) {
                    console.error('Cannot sign unsigned tx', unsignedTx, logBurn, e);
                }
            }
        }
    }
}

module.exports = {Operator};
