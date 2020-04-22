// const temp = require('temp').track();
// const fs = require('fs');
const { executeCommand, readFile, writeFile } = require('./utils');
const logger = require('./logger');

const { commands } = require('./process');

/**
 *
 * @property {string} chainClient - Chain Client (eg enigmacli, kamutcli, gaiacli etc)
 * @property {string} fromAccount - Name or address of private key with which to sign
 * @property {string} keyringBackend - keyring backend (os|file|test) (default "os")
 * @property {string} multisigAddress - Address of the multisig account
 */
class CliSwapClient {
    constructor (chainClient, fromAccount, keyringBackend, multisigAddress, password) {
        this.chainClient = chainClient;
        this.fromAccount = fromAccount;
        this.keyringBackend = keyringBackend;
        this.multisigAddress = multisigAddress;
        this.basePath = '~/.enigmacli';
        this.password = password;
    }

    async isSwapDone (ethTxHash) {
        const tokenSwap = await this.getTokenSwap(ethTxHash);
        if (tokenSwap.length === 0 || tokenSwap.includes('ERROR')) {
            logger.error(`Returned tokenswap was empty or errored for tx hash: ${ethTxHash}`);
            throw new Error('Failed to get tokenswap for tx hash');
        }
        return JSON.parse(tokenSwap).done;
    }

    async getTokenSwap (ethTxHash) {
        return executeCommand(`${this.chainClient} query tokenswap get ${ethTxHash}`);
    }

    async broadcastTokenSwap (signatures, unsignedTx) {
        const unsignedFile = `${this.basePath}/${this.fromAccount}_${unsignedTx.value.msg[0].value.BurnTxHash}_unsigned.json`;

        await writeFile(unsignedFile, JSON.stringify(unsignedTx));

        const sigFiles = [];

        await Promise.all(signatures.map(
            async (signature) => {
                const tempName = `${this.basePath}/${this.fromAccount}_signed_${signature.user}_${signature.transactionHash}.json`;
                // eslint-disable-next-line no-await-in-loop
                await writeFile(tempName, signature.signature);
                sigFiles.push(tempName);
            }
        ));
        // const signedFile = temp.path();
        const signedFile = `${this.basePath}/${this.fromAccount}_${unsignedTx.value.msg[0].value.BurnTxHash}signed.json`;
        // signCmd = `${signCmd} > ${signedFile}`;

        // if (this.keyringBackend) {
        //     signCmd = `${signCmd} --keyring-backend ${this.keyringBackend}`;
        // }

        await commands.multisign(unsignedFile, this.password, this.fromAccount, sigFiles, signedFile);
        // todo: verify signature some other way

        const outputFile = `${this.basePath}/${this.fromAccount}_${unsignedTx.value.msg[0].value.BurnTxHash}_broadcast.json`;

        await commands.broadcast(signedFile, this.password, outputFile);

        return readFile(outputFile);
    }

    async signTx (unsignedTx) {
        const unsignedFile = `${this.basePath}/${this.fromAccount}_unsigned_operator.json`;
        const signedFile = `${this.basePath}/${this.fromAccount}_sig_${unsignedTx.value.msg[0].value.BurnTxHash}.json`;
        await writeFile(unsignedFile, JSON.stringify(unsignedTx));
        // eslint-disable-next-line max-len
        // let signCmd = `${this.chainClient} tx sign ${unsignedFile} --multisig ${this.multisigAddress} --from=${this.fromAccount} --yes`;
        //
        // if (this.keyringBackend) {
        //     signCmd = `${signCmd} --keyring-backend ${this.keyringBackend}`;
        // }

        const resp = await commands.signTx(unsignedFile, this.password, this.multisigAddress, this.fromAccount, signedFile);
        logger.info(`resp: ${JSON.stringify(resp)}`);
        return readFile(signedFile);
    }

    /**
   * Generates a token swap request.
   *
   * @param {*} ethTxHash The burn tx hash
   * @param {*} senderEthAddress Sender's ethereum address
   * @param {*} amountTokens Number of tokens in wei burnt
   * @param {*} recipientAddress Address for newly minted tokens
   */
    async generateTokenSwap (ethTxHash, senderEthAddress, amountTokens, recipientAddress) {
        // eslint-disable-next-line max-len
        // let createTxCmd = `${this.chainClient} tx tokenswap create ${ethTxHash} ${senderEthAddress} ${amountTokens} ${recipientAddress} --from=${this.multisigAddress} --generate-only`;
        // if (this.keyringBackend) {
        //     createTxCmd = `${createTxCmd} --keyring-backend ${this.keyringBackend}`;
        // }
        const unsignedFile = `${this.basePath}/${this.fromAccount}unsigned.json`;
        // const unsignedFile = temp.path({ prefix: 'unsigned-', suffix: '.json' });
        // createTxCmd = `${createTxCmd} > ${unsignedFile}`;
        //    swap (name, password, amount, ethTxHash, ethAddress, engAddress, callback) {
        // eslint-disable-next-line max-len
        await commands.swap(this.multisigAddress, this.password, amountTokens, ethTxHash, senderEthAddress, recipientAddress, unsignedFile);
        // await executeCommand(createTxCmd);
        return JSON.parse(await readFile(unsignedFile));
    }
}

module.exports = { CliSwapClient };
