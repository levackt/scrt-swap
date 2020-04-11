/**
 * @typedef {Object} SwapClient
 * @property {string} fromAccount - Name or address of private key with which to sign
 * @property {string} keyringBackend - keyring backend (os|file|test) (default "os")
 * @property {string} multisigAddress - Address of the multisig account
 */

class TokenSwap {
  constructor(swapClient, fromAccount, keyringBackend, multisigAddress) {
    this.swapClient = swapClient;
    this.fromAccount = fromAccount;
    this.keyringBackend = keyringBackend;
    this.multisigAddress = multisigAddress;
  }
  async *broadcastTokenSwap(signatures, unsignedTx) {
    this.swapClient.broadcastTokenSwap(signatures, unsignedTx);
  }

  async *signTokenSwapRequest(unsignedTx) {
    return this.swapClient.signTokenSwapRequest(unsignedTx);
  }

  /**
   * Generates a token swap request.
   *
   * @param {*} ethTxHash The burn tx hash
   * @param {*} senderEthAddress Sender's ethereum address
   * @param {*} amountTokens Number of tokens in wei burnt
   * @param {*} recipientAddress Address for newly minted tokens
   */
  generateTokenSwap(
    ethTxHash,
    senderEthAddress,
    amountTokens,
    recipientAddress
  ) {
    return this.swapClient.generateTokenSwap(
      ethTxHash,
      senderEthAddress,
      amountTokens,
      recipientAddress
    );
  }
}
