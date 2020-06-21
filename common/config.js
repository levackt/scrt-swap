// config.js
require('dotenv').config();
const convict = require('convict');

const config = convict({
    env: {
        format: ['prod', 'dev', 'test'],
        default: 'prod',
        arg: 'nodeEnv',
        env: 'NODE_ENV'
    },
    networkId: {
        format: String,
        default: '1',
        arg: 'NETWORK_ID',
        env: 'NETWORK_ID'
    },
    pollingInterval: {
        format: Number,
        default: 30000,
        arg: 'POLLING_INTERVAL',
        env: 'POLLING_INTERVAL'
    },
    ethProviderUrl: {
        format: String,
        default: 'http://localhost:8545',
        arg: 'ethProviderUrl',
        env: 'ETH_PROVIDER'
    },
    multisigAddress: {
        format: String,
        default: 'enigma12345',
        arg: 'multisigAddress',
        env: 'MULTISIG_ADDRESS'
    },
    keyringBackend: {
        format: String,
        default: 'test',
        arg: 'keyringBackend',
        env: 'KEYRING_BACKEND'
    },
    db_url: {
        format: String,
        default: 'mongodb://localhost:27017',
        arg: 'db',
        env: 'MONGO_URL'
    },
    dbName: {
        format: String,
        default: 'enigma-swap',
        arg: 'dbname',
        env: 'DB_NAME'
    },
    chainClient: {
        format: String,
        default: 'kamutcli',
        arg: 'chainClient',
        env: 'CHAIN_CLIENT'
    },
    chainId: {
        format: String,
        default: 'enigma-testnet',
        arg: 'chain-id',
        env: 'CHAIN_ID'
    },
    fromAccount: {
        format: String,
        default: '',
        arg: 'fromAccount',
        env: 'FROM_ACCOUNT'
    },
    nbConfirmations: {
        format: String,
        default: '12',
        arg: 'nbConfirmations',
        env: 'NB_CONFIRMATIONS'
    },
    multisigThreshold: {
        format: String,
        default: '',
        arg: 'multisigThreshold',
        env: 'MULTISIG_THRESHOLD'
    },
    broadcastInterval: {
        format: Number,
        default: 30000,
        arg: 'broadcastInterval',
        env: 'BROADCAST_INTERVAL'
    },
    operatorUser: {
        format: String,
        default: '',
        arg: 'operatorUser',
        env: 'OPERATOR_USER'
    },
    bech32prefix: {
        format: String,
        default: 'kamut',
        arg: 'prefix',
        env: 'PREFIX'
    },
    docker: {
        format: Boolean,
        default: false
    },
    password: {
        format: String,
        default: '',
        arg: 'keyringPassword',
        env: 'KEYRING_PASSWORD',
        sensitive: true
    },
    tmpPath: {
        format: String,
        default: '~/.kamutcli',
        arg: 'tmpPath',
        env: 'TMP_PATH',
        sensitive: true
    },
    fromBlock: {
        format: Number,
        default: 0,
        arg: 'fromBlock',
        env: 'FROM_BLOCK'
    },
});

const env = config.get('env');
config.loadFile(`./config/${env}.json`);

config.validate({ allowed: 'strict' }); // throws error if config does not conform to schema

module.exports = config.getProperties();
