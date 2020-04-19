const { exec } = require('child_process');
const temp = require('temp').track();
const fs = require('fs');
const { sleep } = require('./utils');
const logger = require('../common/logger');

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
        const tokenSwap = this.getTokenSwap(ethTxHash);
        if (tokenSwap.length === 0 || tokenSwap.includes('ERROR')) {
            return false;
        }
        return JSON.parse(tokenSwap).done;
    }

    async getTokenSwap (ethTxHash) {
        await this.executeCommand(`${this.chainClient} query tokenswap get ${ethTxHash}`, result => result);
    }

    async broadcastTokenSwap (signatures, unsignedTx) {
        const unsignedFile = temp.path();
        let signCmd = `${this.chainClient} tx multisign ${unsignedFile} ${this.multisigAddress} --yes`;
        fs.writeFileSync(unsignedFile, JSON.stringify(unsignedTx));
        for (const signature in signatures) {
            const tempName = temp.path();
            fs.writeFileSync(tempName, JSON.stringify(signature));
            signCmd = `${signCmd} ${tempName}`;
        }
        const signedFile = temp.path();

        signCmd = `${signCmd} > ${signedFile}`;
        let signed;
        await this.executeCommand(signCmd, (result) => {
            signed = result;
        });
        if (signed) {
            await this.executeCommand(`${this.chainClient} tx broadcast ${signedFile}`, result => result);
        }
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

        await this.executeCommand(signCmd, signed => signed);
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
        let createTxCmd = `${this.chainClient} tx tokenswap create ${ethTxHash} ${senderEthAddress} ${amountTokens} ${recipientAddress} --from=${this.multisigAddress} --generate-only`;
        if (this.keyringBackend) {
            createTxCmd = `${createTxCmd} --keyring-backend ${this.keyringBackend}`;
        }
        const unsignedFile = temp.path({ prefix: 'unsigned-', suffix: '.json' });
        createTxCmd = `${createTxCmd} > ${unsignedFile}`;

        await this.executeCommand(createTxCmd, (result) => {
        // noop
        });

        await sleep(500);
        return JSON.parse(fs.readFileSync(unsignedFile));
    }

    async executeCommand (cmd, callback) {
    // todo timeout
        logger.info(`Executing cmd : ${cmd} --output json`);
        exec(`${cmd} --output json`, (error, stdout, stderr) => {
            if (error) {
                logger.error(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                logger.warn(`stderr: ${stderr}`);
                return;
            }
            if (stdout.toLowerCase().includes('error')) {
                throw new Error(stdout);
            }
            callback(stdout);
        });
    }
}

module.exports = { CliSwapClient };
