const { exec } = require("child_process");
const temp = require("temp");

const MULTISIG_ADDRESS = process.env.MULTISIG_ADDRESS;
const KEYRING_BACKEND = process.env.KEYRING_BACKEND;

async function createTokenSwapRequest(
  ethTxHash,
  senderEthAddress,
  amountTokens,
  recipientAddress
) {
  const unsignedFile = generateTokenSwap(
    ethTxHash,
    senderEthAddress,
    amountTokens,
    recipientAddress
  );

  var signedFile = temp.path({ prefix: "signed-", suffix: ".json" });
  let signCmd = `enigmacli tx sign ${unsignedFile} --from=${process.env.MULTISIG_ADDRESS} --output-document ${signedFile}`;

  if (KEYRING_BACKEND) {
    signCmd = `${signCmd} --keyring-backend ${KEYRING_BACKEND}`;
  }

  console.log(`Signing token swap \n ${signCmd}`);

  exec(signCmd, (error, stdout, stderr) => {
    // todo throw error if it fails, eg key not configured
    if (error) {
      console.log(`error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return;
    }
  });
  return signedFile;
}

/**
 * Generates a token swap request.
 *
 * @param {*} ethTxHash The burn tx hash
 * @param {*} senderEthAddress Sender's ethereum address
 * @param {*} amountTokens Number of tokens in wei burnt
 * @param {*} recipientAddress Address for newly minted tokens
 */
function generateTokenSwap(
  ethTxHash,
  senderEthAddress,
  amountTokens,
  recipientAddress
) {
  let createTxCmd = `enigmacli tx tokenswap create ${ethTxHash} ${senderEthAddress} ${amountTokens} ${recipientAddress} --generate-only --from=${MULTISIG_ADDRESS}`;

  if (KEYRING_BACKEND) {
    createTxCmd = `${createTxCmd} --keyring-backend ${KEYRING_BACKEND}`;
  }
  var unsignedFile = temp.path({ prefix: "unsigned-", suffix: ".json" });
  createTxCmd = `${createTxCmd} > ${unsignedFile}`;

  console.log(`Generating token swap \n ${createTxCmd}`);
  exec(createTxCmd, (error, stdout, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return;
    }
  });
  return unsignedFile;
}

module.exports = { generateTokenSwap, createTokenSwapRequest };
