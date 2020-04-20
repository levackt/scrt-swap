const temp = require('temp').track();
const fs = require('fs');
const { sleep, executeCommand, readFile } = require('./utils');
const logger = require('./logger');
/**
 *
 * @property {string} chainClient - Chain Client (eg enigmacli, kamutcli, gaiacli etc)
 * @property {string} fromAccount - Name or address of private key with which to sign
 * @property {string} keyringBackend - keyring backend (os|file|test) (default "os")
 * @property {string} multisigAddress - Address of the multisig account
 */
class CliSwapClient {
    constructor (chainClient, fromAccount, keyringBackend, multisigAddress) {
        this.chainClient = chainClient;
        this.fromAccount = fromAccount;
        this.keyringBackend = keyringBackend;
        this.multisigAddress = multisigAddress;
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
        const unsignedFile = temp.path();
        let signCmd = `${this.chainClient} tx multisign ${unsignedFile} ${this.multisigAddress} --yes`;
        fs.writeFileSync(unsignedFile, JSON.stringify(unsignedTx));
        for (const signature of signatures) {
            const tempName = temp.path();
            fs.writeFileSync(tempName, JSON.stringify(signature));
            signCmd = `${signCmd} ${tempName}`;
        }
        const signedFile = temp.path();

        signCmd = `${signCmd} > ${signedFile}`;
        const signed = await executeCommand(signCmd);
        if (signed) {
            return executeCommand(`${this.chainClient} tx broadcast ${signedFile}`);
        }
        throw new Error('Failed to sign');
    }

    async signTx (unsignedTx) {
        // const unsignedFile = '~/.kamutcli/unsigned.json';
        const unsignedFile = temp.path();
        fs.writeFileSync(unsignedFile, JSON.stringify(unsignedTx));

        // let signCmd = `docker exec ${this.chainClient} tx sign ${unsignedFile} --from=${this.fromAccount} --yes kamut`;
        let signCmd = `${this.chainClient} tx sign ${unsignedFile} --from=${this.fromAccount} --yes`;

        if (this.keyringBackend) {
            signCmd = `${signCmd} --keyring-backend ${this.keyringBackend}`;
        }

        return executeCommand(signCmd);
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
        let createTxCmd = `${this.chainClient} tx tokenswap create ${ethTxHash} ${senderEthAddress} ${amountTokens} ${recipientAddress} --from=${this.multisigAddress} --generate-only`;
        if (this.keyringBackend) {
            createTxCmd = `${createTxCmd} --keyring-backend ${this.keyringBackend}`;
        }
        const unsignedFile = temp.path({ prefix: 'unsigned-', suffix: '.json' });
        createTxCmd = `${createTxCmd} > ${unsignedFile}`;

        await executeCommand(createTxCmd);
        await sleep(500);
        return JSON.parse(await readFile(unsignedFile));
    }
}

module.exports = { CliSwapClient };
