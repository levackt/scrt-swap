// const { createSignature, createWalletFromMnemonic, verifyTx } = require('@tendermint/sig');
//
// const mnemonic = 'trouble salon husband push melody usage fine ensure blade deal miss twin';
// const wallet = createWalletFromMnemonic(mnemonic); // BIP39 mnemonic string
//
// const tx = {
//     type: 'cosmos-sdk/StdTx',
//     value:
//         {
//             msg:
//                 [{
//                     type: 'tokenswap/TokenSwap',
//                     value:
//                         {
//                             BurnTxHash: '0x16cfbd19027c99d0f8bde7dc4dc0d22fff029d503176d134ad153d03bbdc564f',
//                             EthereumSender: '0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0',
//                             Receiver: 'enigma1um27s6ee62r8evnv7mz85fe4mz7yx6rkvzut0e',
//                             AmountENG: '1000000000.000000000000000000',
//                             SignerAddr: 'enigma1c52jw3wtxjn90hylquqka2q687jh9jlfsy9skp'
//                         }
//                 }],
//             fee:
//                 {
//                     amount: [],
//                     gas: '200000'
//                 },
//             signatures: null,
//             memo: ''
//         }
// };
//
// const signMeta = {
//     account_number: '1',
//     chain_id: 'cosmos',
//     sequence: '0'
// };
//
// const stdTx = createSignature(tx, wallet); // Wallet or privateKey / publicKey pair; see example above
// /*
// {
//     fee:        { amount: [{ amount: '0', denom: '' }], gas: '10000' },
//     memo:       '',
//     msg:       [{
//         type:  'cosmos-sdk/Send',
//         value: {
//             inputs:  [{
//                 'address': 'cosmos1qperwt9wrnkg5k9e5gzfgjppzpqhyav5j24d66',
//                 'coins':   [{ amount: '1', denom: 'STAKE' }]
//             }],
//             outputs: [{
//                 address: 'cosmos1yeckxz7tapz34kjwnjxvmxzurerquhtrmxmuxt',
//                 coins:   [{ amount: '1', denom: 'STAKE' }]
//             }]
//         }
//     }],
//     signatures: [{
//         signature: 'uwQQzsubfzk/EwedKbZI/IDiXru5M6GuEBA2DZ+U7LVBwO80MFhU6ULA/5yjT8F0Bdx113VzS/GtbntazzNPwQ==',
//         pub_key:   { type: 'tendermint/PubKeySecp256k1', value: 'A58jKYIwA/eL8nEpyLBJG2boceJQuGuQ2ViXFRa5RBzT' }
//     }]
// }
// */
//
// const valid = verifyTx(stdTx, signMeta); // signed transaction and metadata; see example above
//
// if (valid) {
//     console.log('yay');
// } else {
//     console.log('aww');
// }

// const scrt = {
//     async sequenceNumber (account) {
//         const res = await executeCommand(`${}`)
//     }
// };
