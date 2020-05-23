// const temp = require('temp').track();
// const fs = require('fs');
const { executeCommand, readFile, writeFile } = require('./utils');
const logger = require('./logger');
const config = require('./config');
const { commands } = require('./process');

/**
 *
 * @property {string} chainClient - Chain Client (eg enigmacli, kamutcli, gaiacli etc)
 * @property {string} fromAccount - Name or address of private key with which to sign
 * @property {string} keyringBackend - keyring backend (os|file|test) (default "os")
 * @property {string} multisigAddress - Address of the multisig account
 */
class CliSwapClient {
    constructor (chainClient, fromAccount, multisigAddress, password) {
        this.chainClient = chainClient;
        this.accountName = fromAccount;
        this.multisigAddress = multisigAddress;
        this.basePath = config.tmpPath;
        this.password = password;
    }

    async getAccountAddress () {
        // eslint-disable-next-line max-len
        return executeCommand(`${this.chainClient} keys show -a ${this.accountName} --keyring-backend ${config.keyringBackend}`, false).catch(
            (error) => {
                logger.error(`Failed to execute command to get account address: ${error}`);
                throw new Error('Failed to get account address');
            }
        );
    }

    async getAccountNumber () {
        const res = await executeCommand(`${this.chainClient} query account ${await this.getAccountAddress()}`).catch(
            (error) => {
                logger.error(`Failed to execute command to get account number: ${error}`);
                throw new Error('Failed to get account number');
            }
        );
        const parsed = JSON.parse(res);
        if (!Object.prototype.hasOwnProperty.call(parsed.value, 'account_number')) {
            logger.error(`Resulting account information doesn't contain account number: ${JSON.stringify(parsed)}`);
            throw new Error('Failed to get account_number');
        }
        return parsed.value.account_number;
    }

    async sequenceNumber () {
        const res = await executeCommand(`${this.chainClient} query account ${await this.getAccountAddress()}`).catch(
            (error) => {
                logger.error(`Failed to execute command to get sequence number: ${error}`);
                throw new Error('Failed to get sequence number');
            }
        );
        const parsed = JSON.parse(res);
        if (!Object.prototype.hasOwnProperty.call(parsed.value, 'sequence')) {
            logger.error(`Resulting account information doesn't contain sequence number: ${JSON.stringify(parsed)}`);
            throw new Error('Failed to get sequence number');
        }
        return parsed.value.sequence;
    }

    async isSwapDone (ethTxHash) {
        try {
            const tokenSwap = await this.getTokenSwap(ethTxHash);
            if (tokenSwap.length === 0 || tokenSwap.includes('Unknown Ethereum tx hash')) {
                return false;
            } else if (tokenSwap.includes('ERROR')) {
                logger.error(`Returned tokenswap was empty or errored for tx hash: ${ethTxHash}`);
                throw new Error('Failed to get tokenswap for tx hash');
            }
            return JSON.parse(tokenSwap).done;
        } catch (e) {
            if (e.message.includes('Unknown Ethereum tx hash')) {
                return false;
            } else {
                logger.error(`Returned tokenswap was empty or errored for tx hash: ${ethTxHash}`);
                throw new Error('Failed to get tokenswap for tx hash');
            }
        }
    }

    async getTokenSwap (ethTxHash) {
        return executeCommand(`${this.chainClient} query tokenswap get ${ethTxHash}`);
    }

    /**
     * @returns {string}
     */
    async broadcastTokenSwap (signatures, unsignedTx, sequence, accountNumber) {
        const unsignedFile = `${this.basePath}/${this.accountName}_${unsignedTx.value.msg[0].value.BurnTxHash}_unsigned.json`;

        await writeFile(unsignedFile, JSON.stringify(unsignedTx));

        const sigFiles = [];

        await Promise.all(signatures.map(
            async (signature) => {
                const tempName = `${this.basePath}/${this.accountName}_signed_${signature.user}_${signature.transactionHash}.json`;
                // eslint-disable-next-line no-await-in-loop
                await writeFile(tempName, JSON.stringify(signature.signature));
                sigFiles.push(tempName);
            }
        ));
        const signedFile = `${this.basePath}/${this.accountName}_${unsignedTx.value.msg[0].value.BurnTxHash}signed.json`;

        await commands.multisign(unsignedFile, this.accountName, sigFiles, sequence, accountNumber, signedFile);
        // todo: verify signature some other way

        const outputFile = `${this.basePath}/${this.accountName}_${unsignedTx.value.msg[0].value.BurnTxHash}_broadcast.json`;

        await commands.broadcast(signedFile, outputFile);
        return readFile(outputFile);
    }

    async signTx (unsignedTx, sequence, accountNumber) {
        const unsignedFile = `${this.basePath}/${this.accountName}_unsigned_operator.json`;
        const signedFile = `${this.basePath}/${this.accountName}_sig_${unsignedTx.value.msg[0].value.BurnTxHash}.json`;
        await writeFile(unsignedFile, JSON.stringify(unsignedTx));

        const resp = await commands.signTx(unsignedFile, this.password, this.multisigAddress, this.accountName, sequence, accountNumber, signedFile);
        logger.info(`resp: ${JSON.stringify(resp)}`);
        return readFile(signedFile);
    }

  /**
   * Generates a token swap request.
   *
   * @param {*} ethTxHash The burn tx hash
   * @param {*} senderEthAddress Sender's ethereum address
   * @param {*} amountTokens Number of tokens in grains burnt
   * @param {*} recipientAddress Address for newly minted tokens
   */
    async generateTokenSwap (ethTxHash, senderEthAddress, amountTokens, recipientAddress) {
        // eslint-disable-next-line max-len
        const unsignedFile = `${this.basePath}/${this.accountName}unsigned.json`;
        // eslint-disable-next-line max-len
        await commands.swap(this.multisigAddress, this.password, amountTokens, ethTxHash, senderEthAddress, recipientAddress, unsignedFile);
        return JSON.parse(await readFile(unsignedFile));
    }
}

module.exports = { CliSwapClient };
