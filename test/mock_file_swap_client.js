const { exec } = require("child_process");
const fs = require("fs");
var temp = require("temp").track();
const path = require("path");

class MockTokenSwapClient {

  async broadcastTokenSwap(signatures, unsignedTx) {
  }

  async signTokenSwapRequest(unsignedTx) {
    console.log("signing token swap")
     const signed = JSON.parse(fs.readFileSync(path.resolve(__dirname, "data/p1.json")));
     signed.signature = Math.random().toString(16);
     return signed
  }

  generateTokenSwap(ethTxHash, senderEthAddress, amountTokens, recipientAddress) {
    const unsignedTx = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, "data/unsigned.json"))
    );
    unsignedTx.value.msg[0].value.BurnTxHash = ethTxHash;
    unsignedTx.value.msg[0].value.EthereumSender = senderEthAddress;
    unsignedTx.value.msg[0].value.Receiver = recipientAddress;
    unsignedTx.value.msg[0].value.AmountENG = amountTokens;

    return unsignedTx;
  }
}

module.exports = {MockTokenSwapClient};
