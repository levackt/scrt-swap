const cprocess = require('child_process');
const cosmos = require('cosmos-lib');
const fs = require('fs');
const path = require('path');
const util = require('util');
const os = require('os');
const logger = require('../common/logger');
const config = require('./config');

function resolveTilde (filePath) {
    if (!filePath || typeof (filePath) !== 'string') {
        return '';
    }
    // '~/folder/path' or '~'
    if (filePath[0] === '~' && (filePath[1] === '/' || filePath.length === 1)) {
        return filePath.replace('~', os.homedir());
    }
    return filePath;
}

const processSpawn = util.promisify(cprocess.exec);

async function sleep (time) {
    await new Promise((resolve) => {
        setTimeout(() => resolve(true), time);
    });
}

/**
 * @returns string
 */

//todo debugging toJson & new line
async function executeCommand (cmd, toJson = false) {
    // todo timeout

    const addJsonOutput = toJson ? ' --output json' : '';

    // workaround to be able to run commands inside a docker container
    const appendDockerPostfix = config.docker ? '"' : '';

    logger.info(`Executing cmd : ${cmd}${addJsonOutput}${appendDockerPostfix}`);
    const result = await processSpawn(`${cmd}${addJsonOutput}${appendDockerPostfix}`);
    return result.stdout;
}

const promiseReadFile = util.promisify(fs.readFile);
const promiseWriteFile = util.promisify(fs.writeFile);

async function writeFile (filePath, data) {
    return promiseWriteFile(resolveTilde(filePath), data);

    // yield promiseReadFile(filePath);
}

async function readFile (filePath) {
    return promiseReadFile(resolveTilde(filePath, 'utf-8'));
}

/**
 * Checksum the recipient address.
 */
function isValidCosmosAddress (recipient) {
    //todo why is config.bech32prefix undefined?
    if (!recipient || !(recipient.startsWith("kamut") || recipient.startsWith("secret"))) {
        logger.error(`recipient=${recipient} has invalid prefix`)
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
