
require('dotenv-defaults').config();
require('dotenv-expand');
require('console-stamp')(console, '[HH:MM:ss.l]');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');

const myEnv = dotenv.config();
dotenvExpand(myEnv);

const Web3 = require('web3');
const { Operator } = require('./operator');
const { Leader } = require('./leader');
const { Db } = require('./common/db');
const { CliSwapClient } = require('./common/cli_swap_client');
const { sleep } = require('./common/utils');
const config = require('./common/config');
const logger = require('./common/logger');

const provider = new Web3.providers.HttpProvider(config.ethProviderUrl);
const db = new Db(config.db_url, config.dbName);

if (process.env.ROLE === 'operator' && !config.operatorUser) {
    throw new Error('OPERATOR_USER env variable required');
}


const tokenSwapClient = new CliSwapClient(config.chainClient, config.fromAccount, config.multisigAddress, config.password);

(async () => {
    await db.init();

    await sleep(3000);

    if (process.env.ROLE === 'operator') {
        const operator = new Operator(tokenSwapClient, config.operatorUser, config.multisigAddress, db, provider, config.networkId,
            config.nbConfirmations, config.fromBlock, config.pollingInterval);
        await operator.run();
    } else if (process.env.ROLE === 'leader') {
        const leader = new Leader(tokenSwapClient, config.multisigAddress, db, provider, config.networkId,
            config.fromBlock, config.pollingInterval, config.multisigThreshold, config.broadcastInterval);

        (async () => {
            await leader.broadcastSignedSwaps();
        })();

        await leader.run();
    }
})().catch(async (e) => {
    await db.teardown().catch(
        (error) => {
            logger.error(`Fatal error tearing down DB: ${error}`);
        }
    );
    logger.error('Fatal error starting: ', e);
});
