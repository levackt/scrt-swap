/* eslint-disable no-await-in-loop,no-undef */
require('dotenv').config();
const { expect } = require('chai');
const { Db, SWAP_COLLECTION, SIGNATURE_COLLECTION } = require('../common/db');
const signature = require('./data/p1.json');
const signature2 = require('./data/p2.json');
const unsignedTx = require('./data/unsigned.json');

const { SWAP_STATUS_UNSIGNED, SWAP_STATUS_SUBMITTED, SWAP_STATUS_CONFIRMED } = require('../common/constants');


describe('DB Tests', () => {
    const db = new Db('mongodb://localhost:27017/', 'enigma-swap');

    const transactionHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    before(async () => {
        await db.init();
        await db.clear(SWAP_COLLECTION);
        await db.clear(SIGNATURE_COLLECTION);
    });


    it('...should insert signature.', async () => {

        const logBurn = {
            transactionHash: transactionHash,
            from: "0x0",
            amount: "10000000000",
            to: "enigma12345",
            nonce: 0
        };
        const unsignedSwap = {
            ...logBurn,
            sequence: 0,
            accountNumber: 0,
            _id: transactionHash,
            mintTransactionHash: null,
            unsignedTx,
            status: SWAP_STATUS_UNSIGNED
        };
        
        db.insertUnsignedSwap(unsignedSwap)

        const swap = await db.fetchSwap(transactionHash);

        expect(swap.status).to.equal(SWAP_STATUS_UNSIGNED);
        expect(swap.mintTransactionHash).to.be.null;
        
        db.insertSignature("some user", transactionHash, signature);
    });

    it('...should not insert duplicate swap.', async () => {

        const logBurn = {
            transactionHash: transactionHash,
            from: "0x0",
            amount: "10000000000",
            to: "enigma12345",
            nonce: 0
        };
        const unsignedSwap = {
            ...logBurn,
            sequence: 0,
            accountNumber: 0,
            _id: transactionHash,
            mintTransactionHash: null,
            unsignedTx,
            status: SWAP_STATUS_UNSIGNED
        };
        
        await db.insertUnsignedSwap(unsignedSwap);
        
        const dbSwaps = await db.findAllByStatus(SWAP_STATUS_UNSIGNED);
        expect(dbSwaps.length).to.equal(1);
    });

    it('...should insert new hash.', async () => {
        const newTransactionHash = "0xaaaa2"

        const logBurn = {
            transactionHash: newTransactionHash,
            from: "0x0",
            amount: "10000000000",
            to: "enigma12345",
            nonce: 0
        };
        const unsignedSwap = {
            ...logBurn,
            sequence: 0,
            accountNumber: 0,
            _id: newTransactionHash,
            mintTransactionHash: null,
            unsignedTx,
            status: SWAP_STATUS_UNSIGNED
        };
        
        await db.insertUnsignedSwap(unsignedSwap);
        
        const dbSwaps = await db.findAllByStatus(SWAP_STATUS_UNSIGNED);
        expect(dbSwaps.length).to.equal(2);
    });

    it('...should not insert duplicate signature.', async () => {

        await db.insertSignature("some user", transactionHash, signature);

        const unsignedSwaps = await db.findAboveThresholdUnsignedSwaps(2);
        expect(unsignedSwaps.length).to.equal(0);
    });

    it('...should insert 2nd users signature.', async () => {

        await db.insertSignature("another user", transactionHash, signature2);

        const unsignedSwaps = await db.findAboveThresholdUnsignedSwaps(2);
        expect(unsignedSwaps.length).to.equal(1);
    });
});
