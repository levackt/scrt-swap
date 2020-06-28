
require('dotenv').config()
const path = require("path");
const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  contracts_build_directory: path.join(__dirname, "client/src/contracts"),
  networks: {
    develop: {
      host: 'localhost',
      port: 8545,
      gas: 4700000,
      network_id: '50'
    },
    rinkeby: {
      provider: () =>
        new HDWalletProvider(
          `${process.env.MNEMONIC}`,
          `https://rinkeby.infura.io/v3/${process.env.INFURA_ID}`
        ),
      network_id: 4,
      gas: 5500000,
      skipDryRun: false
    },
    ropsten: {
      provider: () =>
        new HDWalletProvider(
          `${process.env.MNEMONIC}`,
          `https://ropsten.infura.io/v3/${process.env.INFURA_ID}`
        ),
      network_id: 3
    },
    live: {
      provider: () => new HDWalletProvider(`${process.env.MNEMONIC}`, 
          `https://mainnet.infura.io/v3/${process.env.INFURA_ID}`),
      network_id: 1,
      gasPrice: 55000000000,
      gas: 2000000,
    }
  },
  mocha: {
    reporter: 'eth-gas-reporter'
  }
};
