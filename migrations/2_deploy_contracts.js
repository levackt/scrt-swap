const EngSwap = artifacts.require('./EngSwap.sol');
const EngToken = artifacts.require('./EngToken.sol');
const web3 = require('web3');

module.exports = async function (deployer) {
    const tokenDecimals = web3.utils.toBN(18);
    const tokenAmountToMint = web3.utils.toBN(1000);
    const supply = tokenAmountToMint.mul(web3.utils.toBN(10).pow(tokenDecimals));

    await deployer.deploy(EngToken, supply);
    const token = EngToken.address;
    await deployer.deploy(EngSwap, token);
    console.log('Deployed EngSwap', EngSwap);
};
