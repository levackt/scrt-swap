const os = require('os');
const pty = require('node-pty');
const util = require('util');
const config = require('./config');

const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
// const httpClient = axios.create({ baseURL: config.api });

// this is just for me running on windows to be able to run commands inside the docker with the blockchain
const docker = os.platform() === 'win32' ? 'docker exec -it swaptest3 /bin/bash' : '';

const cmd = {
    spawnProcess () {
        const ptyProcess = pty.spawn(shell, [docker], {
            name: Math.random().toString(36).substring(7),
            cols: 8000,
            rows: 30,
            cwd: process.env.HOME,
            env: process.env
        });
        return ptyProcess;
    },

    spawnNoPassword (password, toRun, callback) {
        const ptyProcess = cmd.spawnProcess();
        ptyProcess.onExit((c) => {
            console.log(`exit: ${JSON.stringify(c)}`);
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
            ptyProcess.write('exit\r');
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

    // createKey (name, password, callback) {
    //     const ptyProcess = cmd.spawnProcess();
    //
    //     let buildResponse = '';
    //
    //     ptyProcess.on('data', (data) => {
    //         process.stdout.write(data);
    //
    //         // 0.37.9
    //         if (data.includes('Enter a passphrase')) {
    //             // process.stdout.write('Setting password to '+password);
    //             ptyProcess.write(`${password}\r`);
    //         }
    //         // 0.37.9
    //         if (data.includes('Repeat the passphrase')) {
    //             // process.stdout.write('Confirming password to '+password);
    //             ptyProcess.write(`${password}\r`);
    //         }
    //
    //         // 0.38.x
    //         if (data.includes('Enter keyring passphrase:')) {
    //             // process.stdout.write('Setting password to '+password);
    //             ptyProcess.write(`${password}\r`);
    //         }
    //
    //         if (os.platform() !== 'win32') {
    //             buildResponse += data;
    //
    //             if (data.split(' ').length === 24) {
    //                 const tmpData = buildResponse.split('\n');
    //
    //                 let publicKey = '';
    //                 let address = '';
    //                 let seedPhrase = '';
    //
    //                 for (let i = 0; i < tmpData.length; i++) {
    //                     // eslint-disable-next-line max-len
    //                     if (tmpData[i].indexOf('NAME:') >= 0 && tmpData[i].indexOf('TYPE:') >= 0 && tmpData[i].indexOf('ADDRESS:') >= 0 && tmpData[i].indexOf('PUBKEY:') >= 0) {
    //                         const arr = tmpData[i + 1].split('\t').filter(Boolean);
    //                         address = arr[2].replace('\r', '');
    //                         publicKey = arr[3].replace('\r', '');
    //                         console.log(arr);
    //                     }
    //
    //                     if (tmpData[i].split(' ').length === 24) {
    //                         seedPhrase = tmpData[i].replace('\r', '');
    //                     }
    //                 }
    //
    //                 ptyProcess.write('exit\r');
    //
    //                 callback(null, {
    //                     address,
    //                     publicKey,
    //                     seedPhrase
    //                 });
    //             }
    //         } else if (data.includes('**Important**')) {
    //             // process.stdout.write(data);
    //             // eslint-disable-next-line max-len
    //             const tmpData = data.replace(/\s\s+/g, ' ').replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').split(' ');
    //             const address = tmpData[6];
    //             const publicKey = tmpData[7];
    //             const seedPhrase = tmpData.slice(33, 57).join(' ');
    //
    //             ptyProcess.write('exit\r');
    //             callback(null, {
    //                 address,
    //                 publicKey,
    //                 seedPhrase
    //             });
    //         }
    //
    //         if (data.includes('override the existing name')) {
    //             ptyProcess.write('n\r');
    //             ptyProcess.write('exit\r');
    //             callback('Symbol already exists', {});
    //         }
    //     });
    //
    //     // ptyProcess.write(`cd ${config.filePath}\r`);
    //     ptyProcess.write(`${config.chainClient} keys add ${name}\r`);
    // },

    signTx (unsignedFile, password, multisigAddress, fromAccount, outputFile, callback) {
        // eslint-disable-next-line max-len
        const toRun = `${config.chainClient} tx sign ${unsignedFile} --multisig ${multisigAddress} --chain-id=${config.chainId} --from=${fromAccount} --output-document ${outputFile} --yes\r`;

        cmd.spawnAndInputPassword(password, toRun, callback);
    },

    broadcast (signedTx, password, outputFile, callback) {
        // eslint-disable-next-line max-len
        const toRun = `${config.chainClient} tx broadcast ${signedTx} > ${outputFile}\r`;

        cmd.spawnNoPassword(password, toRun, callback);
    },

    multisign (unsignedFile, password, fromAccount, sigs, signedFile, callback) {
        const sigString = sigs.join(' ');

        // eslint-disable-next-line max-len
        const toRun = `${config.chainClient} tx multisign ${unsignedFile} ${fromAccount} --chain-id=${config.chainId} --yes ${sigString} > ${signedFile}\r`;

        cmd.spawnNoPassword(password, toRun, callback);
    },

    swap (name, password, amount, ethTxHash, ethAddress, engAddress, outputfile, callback) {
        // eslint-disable-next-line max-len
        const toRun = `${config.chainClient} tx tokenswap create ${ethTxHash} ${ethAddress} ${amount} ${engAddress} --from ${name} --chain-id=${config.chainId} --generate-only > ${outputfile}\r`;
        cmd.spawnNoPassword(password, toRun, callback);
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

// (async () => {
//     // await commands.swap('enigma1c52jw3wtxjn90hylquqka2q687jh9jlfsy9skp', 'orejas123', '100000', '0x4a11cf554ad774f22cadd1b49cb8dfa10484976f80ace4c3f45886788c0cadae',
//     //     '0xd03ea8624C8C5987235048901fB614fDcA89b117', 'enigma1um27s6ee62r8evnv7mz85fe4mz7yx6rkvzut0e', '~/.enigmacli/file.txt').then(
//     //     data => console.log('yay')
//     // ).catch(
//     //     error => console.log(`aww: ${error}`)
//     // );
//
//     await commands.signTx('~/.enigmacli/t3_unsigned_operator.json', 'orejas123', 'enigma1c52jw3wtxjn90hylquqka2q687jh9jlfsy9skp', 't3',
//         '~/.enigmacli/signed.txt').then(
//         data => console.log('yay')
//     ).catch(
//         error => console.log(`aww: ${error}`)
//     );
//
//     console.log('boop');
// })();
