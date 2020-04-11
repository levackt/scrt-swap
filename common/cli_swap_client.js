const { exec } = require("child_process");
const fs = require("fs");
var temp = require("temp").track();

/**
 * 
 * @property {string} chainClient - Chain Client (eg enigmacli, kamutcli, gaiacli etc)
 * @property {string} fromAccount - Name or address of private key with which to sign
 * @property {string} keyringBackend - keyring backend (os|file|test) (default "os")
 * @property {string} multisigAddress - Address of the multisig account
 */

class CliSwapClient {
  constructor(chainClient, fromAccount, keyringBackend, multisigAddress) {
      this.chainClient = chainClient;
      this.fromAccount = fromAccount;
      this.keyringBackend = keyringBackend;
      this.multisigAddress = multisigAddress;
  }

  async broadcastTokenSwap(signatures, unsignedTx) {
      
      var unsignedFile = temp.path()
      let signCmd = `${this.chainClient} tx multisign ${unsignedFile} ${this.multisigAddress}`
      fs.writeFileSync(unsignedFile, unsignedTx);
      for (signature in signatures) {
        var tempName = temp.path();
        fs.writeFileSync(tempName, JSON.stringify(signature));
        signCmd = `${signCmd} ${tempName}`
      }
      var signedFile = temp.path();

      signCmd = `${signCmd} > ${signedFile}`
      let signed;
      await executeCommand(signCmd, function(result){
          signed = result
      });
      if (signed) {
        await executeCommand(`${this.chainclient} tx broadcast ${signedFile}`, function() {});
      }
  }

  async signTokenSwapRequest(unsignedTx) {

    var unsignedFile = temp.path()
    fs.writeFileSync(unsignedFile, unsignedTx);

    let signCmd = `${this.chainClient} tx sign ${unsignedFile} --from=${this.fromAccount}`;

    if (this.keyringBackend) {
        signCmd = `${signCmd} --keyring-backend ${this.keyringBackend}`;
    }

    await executeCommand(signCmd, function(signed){
        return signed
    });
  }

  /**
   * Generates a token swap request.
   *
   * @param {*} ethTxHash The burn tx hash
   * @param {*} senderEthAddress Sender's ethereum address
   * @param {*} amountTokens Number of tokens in wei burnt
   * @param {*} recipientAddress Address for newly minted tokens
   */
  async generateTokenSwap(ethTxHash, senderEthAddress, amountTokens, recipientAddress) {
    let createTxCmd = `enigmacli tx tokenswap create 
        ${ethTxHash} ${senderEthAddress} ${amountTokens} ${recipientAddress} 
        --generate-only 
        --from=${this.multisigAddress}`;

    if (this.keyringBackend) {
      createTxCmd = `${createTxCmd} --keyring-backend ${this.keyringBackend}`;
    }
    var unsignedFile = temp.path({ prefix: "unsigned-", suffix: ".json" });
    createTxCmd = `${createTxCmd} > ${unsignedFile}`;

    await executeCommand(createTxCmd, function(unsigned) {
        return unsigned
    });
  }

  *executeCommand(cmd, callback) {
    console.log(`Executing cmd : ${cmd} --output json`);
    exec(`${cmd} --output json`, (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
      }
      callback(JSON.parse(stdout));
    });
  }
}

module.exports = {CliSwapClient};
