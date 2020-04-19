const cprocess = require('child_process');
// eslint-disable-next-line import/prefer-default-export
const fs = require('fs');
const util = require('util');
const logger = require('../common/logger');

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
const promiseDeleteFile = util.promisify(fs.unlink);

export async function deleteFile (filePath) {
    return promiseDeleteFile(filePath);
}

export async function writeFile (filePath, data) {
    return promiseWriteFile(filePath, data);

    // yield promiseReadFile(filePath);
}

export async function readFile (filePath) {
    return promiseReadFile(filePath);
}

module.exports = {
    executeCommand, sleep, readFile, writeFile, deleteFile
};
