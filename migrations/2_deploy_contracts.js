const EngSwap = artifacts.require('./EngSwap.sol');
const EngToken = artifacts.require('./EngToken.sol');
const web3 = require('web3');

module.exports = async function (deployer) {
    await deployer.deploy(EngToken);
    const token = EngToken.address;
    console.log('Deployed EngToken', EngToken.address);
    await deployer.deploy(EngSwap, token);
    console.log('Deployed EngSwap', EngSwap.address);
};
