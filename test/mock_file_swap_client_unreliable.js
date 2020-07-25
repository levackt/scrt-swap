const p1 = require('./data/p1.json');
const unsignedTxData = require('./data/unsigned.json');
const txData = require('./data/tx.json');
const doneSwap = require('./data/done_swap.json');
const qAccount = require('./data/q_account.json');
const logger = require('../common/logger');


class MockTokenSwapClientUnreliable {

    constructor(){
        this.fail = false;
    }

    setFail(fail) {
        this.fail = fail;
    }

    async sequenceNumber () {
        if (this.fail) {
            throw new Error("mock fail")
        }
        return qAccount.sequence;
    }

    async getAccountNumber () {
        if (this.fail) {
            throw new Error("mock fail")
        }
        return qAccount;
    }

    async isSwapDone (ethTxHash) {
        if (this.fail) {
            return false
        }
        const swap = await this.getTokenSwap(ethTxHash);
        return swap.done;
    }

    async getTokenSwap (ethTxHash) {
        if (this.fail) {
            throw new Error('Failed to get tokenswap for tx hash');
        }
        if (ethTxHash) {
            return doneSwap;
        }
    }

    async broadcastTokenSwap (signatures, unsignedTx, sequence, accountNumber) {
        if (this.fail) {
            throw new Error("mock fail")
        }
        txData.txhash = Math.random().toString(16);
        return JSON.stringify(txData);
    }

    async signTx (unsignedTx) {
        if (this.fail) {
            throw new Error("mock fail")
        }
        p1.signature = Math.random().toString(16);
        return JSON.stringify(p1);
    }

    generateTokenSwap (ethTxHash, senderEthAddress, amountTokens, recipientAddress) {
        unsignedTxData.value.msg[0].value.BurnTxHash = ethTxHash;
        unsignedTxData.value.msg[0].value.EthereumSender = senderEthAddress;
        unsignedTxData.value.msg[0].value.Receiver = recipientAddress;
        unsignedTxData.value.msg[0].value.AmountENG = amountTokens;

        return unsignedTxData;
    }
}

module.exports = { MockTokenSwapClientUnreliable };
