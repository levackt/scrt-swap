const p1 = require('./data/p1.json');
const unsignedTxData = require('./data/unsigned.json');
const txData = require('./data/tx.json');
const doneSwap = require('./data/done_swap.json');
const qAccount = require('./data/q_account.json');
const logger = require('../common/logger');

class MockTokenSwapClient {

    async sequenceNumber () {
        return qAccount.sequence;
    }

    async getAccountNumber () {
        return qAccount;
    }

    async isSwapDone (ethTxHash) {
        const swap = await this.getTokenSwap(ethTxHash);
        return swap.done;
    }

    async getTokenSwap (ethTxHash) {
        if (ethTxHash) {
            return doneSwap;
        }
    }

    async broadcastTokenSwap (signatures, unsignedTx, sequence, accountNumber) {
        txData.txhash = Math.random().toString(16);
        return JSON.stringify(txData);
    }

    async signTx (unsignedTx) {
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

module.exports = { MockTokenSwapClient };
