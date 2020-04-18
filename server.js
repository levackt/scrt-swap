require('dotenv-defaults').config();
require('dotenv-expand')
require('console-stamp')(console, '[HH:MM:ss.l]');
const Web3 = require('web3');
const {Operator} = require('./operator');
const {Leader} = require('./leader');
const {Db} = require('./common/db');
const {CliSwapClient} = require('./common/cli_swap_client')

const networkId = process.env.NETWORK_ID || '50';
const pollingInterval = process.env.POLLING_INTERVAL || 1000;
const ethProviderUrl = process.env.ETH_PROVIDER || 'http://localhost:8545';
const provider = new Web3.providers.HttpProvider(ethProviderUrl);
const fromBlock = 0; // TODO: Save to disk to resume after shutdown
const multisigAddress = process.env.MULTISIG_ADDRESS || 'enigma12345';
const keyringBackend = process.env.KEYRING_BACKEND || 'test';
const chainClient = process.env.CHAIN_CLIENT || 'enigmacli';
const nbConfirmations = process.env.NB_CONFIRMATIONS || '12';
const multisigThreshold = process.env.MULTISIG_THRESHOLD || 2;
const broadcastInterval = process.env.BROADCAST_INTERVAL || 30000;
const user = process.env.OPERATOR_USER;
const fromAccount = process.env.FROM_ACCOUNT;
const leaderAccount = process.env.LEADER_ACCOUNT;
const db_url = process.env.MONGO_URL || 'mongodb://localhost:27017';
const db = new Db(db_url, 'enigma-swap');

if (process.env.ROLE === 'operator' && !user) {
    throw new Error('OPERATOR_USER env variable required');
}

if (process.env.ROLE === 'operator' && !leaderAccount) {
    throw new Error('LEADER_ACCOUNT env variable required to verify unsigned')
}

const tokenSwapClient = new CliSwapClient(chainClient, fromAccount, keyringBackend, multisigAddress);

(async () => {
    await db.init();
    
    await new Promise(resolve => {
        setTimeout(() => resolve(true), 3000);
    });
    
    if (process.env.ROLE === 'operator') {
        const operator = new Operator(tokenSwapClient, user, multisigAddress, db, provider, networkId, 
        leaderAccount, nbConfirmations, fromBlock, pollingInterval);
        await operator.run();
    } else if (process.env.ROLE === 'leader') {
        const leader = new Leader(tokenSwapClient, multisigAddress, db, provider, networkId, fromBlock, pollingInterval,
            multisigThreshold, broadcastInterval);

        (async () => {
            await leader.broadcastSignedSwaps();
        })();
        
        await leader.run();
    }
})().catch(async e => {
    await db.teardown();
    console.error('Fatal error', e);
});
