var p1 = require('./data/p1.json');
var unsignedTxData = require('./data/unsigned.json')
var txData = require('./data/tx.json')

class MockTokenSwapClient {

  async broadcastTokenSwap(signatures, unsignedTx) {
    txData.txhash = Math.random().toString(16);
    return txData
  }

  async signTokenSwapRequest(unsignedTx) {
     p1.signature = Math.random().toString(16);
     return p1
  }

  generateTokenSwap(ethTxHash, senderEthAddress, amountTokens, recipientAddress) {
    unsignedTxData.value.msg[0].value.BurnTxHash = ethTxHash;
    unsignedTxData.value.msg[0].value.EthereumSender = senderEthAddress;
    unsignedTxData.value.msg[0].value.Receiver = recipientAddress;
    unsignedTxData.value.msg[0].value.AmountENG = amountTokens;

    return unsignedTxData;
  }
}

module.exports = {MockTokenSwapClient};
