const os = require('os');
const pty = require('node-pty');
const util = require('util');
const config = require('./config');

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
// const httpClient = axios.create({ baseURL: config.api });

// this is just for me running on windows to be able to run commands inside the docker with the blockchain
// const docker = os.platform() === 'win32' ? 'docker exec -it swaptest4 /bin/bash' : '';

function sleep (time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

const cmd = {
    spawnProcess () {
        const ptyProcess = pty.spawn(shell, [], {
            name: Math.random().toString(36).substring(7),
            cols: 8000,
            rows: 30,
            cwd: process.cwd(),
            env: process.env
        });
        return ptyProcess;
    },

    spawnNoPassword (toRun, callback) {
        const ptyProcess = cmd.spawnProcess();
        ptyProcess.onExit((c) => {
            // console.log(`exit: ${JSON.stringify(c)}`);
            if (c.exitCode === 0) {
                callback(null, {});
            } else {
                callback(c.exitCode, null);
            }
        });
        ptyProcess.onData((data) => {
            process.stdout.write(data);
            // retry incase 2 commands are trying to sign at the same time
            if (data.includes('ERROR')) {
                callback(data, null);
            }
            sleep(200).then(() => {
                ptyProcess.write('exit\r');
            });
        });

        // ptyProcess.onExit(())
        ptyProcess.write(toRun);
    },

    spawnAndInputPassword (password, toRun, callback) {
        const ptyProcess = cmd.spawnProcess();
        ptyProcess.onExit((c) => {
            // console.log(`exit: ${JSON.stringify(c)}`);
            if (c.exitCode === 0) {
                callback(null, {});
            } else {
                callback(c.exitCode, null);
            }
        });
        ptyProcess.onData((data) => {
            // process.stdout.write(data);

            // retry incase 2 commands are trying to sign at the same time
            if (data.includes('failed')) {
                ptyProcess.write(toRun);
            }

            // retry incase 2 commands are trying to sign at the same time
            if (data.includes('ERROR')) {
                callback(data, null);
            }

            // 0.37.9
            if (data.includes('Password to sign with')) {
                // process.stdout.write('Confirming password to '+password);
                ptyProcess.write(`${password}\r`);
                ptyProcess.write('exit\r');
            }
            // 0.38.x
            if (data.includes('Enter keyring passphrase:')) {
                // process.stdout.write('Setting password to '+password);
                ptyProcess.write(`${password}\r`);
                ptyProcess.write('exit\r');
            }
            // ptyProcess.write('exit\r');
        });

        // ptyProcess.onExit(())

        ptyProcess.write(toRun);
    },

    appendKeyring (command, keyring, terminate = true) {
        const term = terminate ? '\r' : '';
        return `${command} --keyring-backend ${keyring}${term}`;
    },

    appendOutputFile (command, outputFile) {
        return `${command} > ${outputFile}\r`;
    },

    signTx (unsignedFile, password, multisigAddress, fromAccount, sequence, accountNumber, outputFile, callback) {
        // eslint-disable-next-line max-len
        let toRun = `${config.chainClient} tx sign ${unsignedFile} --offline --account-number ${accountNumber} --sequence ${sequence} --multisig ${multisigAddress} --chain-id=${config.chainId} --from=${fromAccount} --output-document ${outputFile} --yes`;

        if (config.keyringBackend === 'test') {
            toRun = cmd.appendKeyring(toRun, config.keyringBackend);
            cmd.spawnNoPassword(toRun, callback);
        } else {
            toRun += '\r';
            cmd.spawnAndInputPassword(password, toRun, callback);
        }
    },

    broadcast (signedTx, outputFile, callback) {
        let toRun = `${config.chainClient} tx broadcast ${signedTx} -b async`;
        toRun = cmd.appendOutputFile(toRun, outputFile);
        cmd.spawnNoPassword(toRun, callback);
    },

    multisign (unsignedFile, fromAccount, sigs, sequence, accountNumber, signedFile, callback) {
        const sigString = sigs.join(' ');

        // eslint-disable-next-line max-len
        let toRun = `${config.chainClient} tx multisign --offline --account-number ${accountNumber} --sequence ${sequence} ${unsignedFile} ${fromAccount} --chain-id=${config.chainId} --yes ${sigString}`;

        if (config.keyringBackend === 'test') {
            toRun = cmd.appendKeyring(toRun, config.keyringBackend, false);
            toRun = cmd.appendOutputFile(toRun, signedFile);
        } else {
            toRun = cmd.appendOutputFile(toRun, signedFile);
        }
        cmd.spawnNoPassword(toRun, callback);
    },

    swap (name, password, amount, ethTxHash, ethAddress, engAddress, outputfile, callback) {
        // eslint-disable-next-line max-len
        let toRun = `${config.chainClient} tx tokenswap create ${ethTxHash} ${ethAddress} ${amount} ${engAddress} --from ${name} --chain-id=${config.chainId} --generate-only`;

        if (config.keyringBackend === 'test') {
            toRun = cmd.appendKeyring(toRun, config.keyringBackend, false);
            toRun = cmd.appendOutputFile(toRun, outputfile);
            cmd.spawnNoPassword(toRun, callback);
        } else {
            toRun = cmd.appendOutputFile(toRun, outputfile);
            cmd.spawnAndInputPassword(password, toRun, callback);
        }
    }
};

const commands = {
    // createKey: util.promisify(cmd.createKey),
    swap: util.promisify(cmd.swap),
    signTx: util.promisify(cmd.signTx),
    broadcast: util.promisify(cmd.broadcast),
    multisign: util.promisify(cmd.multisign)
};
module.exports = {
    commands
};
