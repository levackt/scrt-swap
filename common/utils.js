const cprocess = require('child_process');
const cosmos = require('cosmos-lib');
const fs = require('fs');
const util = require('util');
const logger = require('../common/logger');
const config = require('./config');

const processSpawn = util.promisify(cprocess.execFile);

async function sleep (time) {
    await new Promise((resolve) => {
        setTimeout(() => resolve(true), time);
    });
}

async function executeCommand (cmd) {
    // todo timeout
    logger.info(`Executing cmd : ${cmd} --output json`);
    const result = await processSpawn(`${cmd} --output json`);
    return result.stdout;
}

const promiseReadFile = util.promisify(fs.readFile);
const promiseWriteFile = util.promisify(fs.writeFile);

async function writeFile (filePath, data) {
    return promiseWriteFile(filePath, data);

    // yield promiseReadFile(filePath);
}

async function readFile (filePath) {
    return promiseReadFile(filePath);
}

/**
 * Checksum the recipient address.
 */
function isValidCosmosAddress (recipient) {
    if (!recipient || !recipient.startsWith(config.bech32prefix)) {
        return false;
    }
    try {
        cosmos.address.getBytes32(recipient);
        return true;
    } catch (error) {
        logger.error(error);
    }
    return false;
}

module.exports = {
    executeCommand, sleep, readFile, writeFile, isValidCosmosAddress
};
