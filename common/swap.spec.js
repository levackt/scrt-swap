const { generateTokenSwap, createTokenSwapRequest } = require("./swap.js");
const fs = require("fs");

const ethTxHash =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const senderEthAddress = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";
const amountTokens = "100";
const recipientAddress = "enigma1yuth8vrhemuu5m0ps0lv75yjhc9t86tf9hf83z";
const expectedSignature =
  "2pg10G6dTSReEolAPReHpsUn3Sr8kWxevNkeKAmFE0FJfj2WyQiDj5Yl3ejlDp02FmJXPFfm55Xb5sRqqP2O7A==";

const it2 = (message, fn) => it(message, async (...args) => fn(...args));

async function sleep(ms) {
  await new Promise(resolve => {
    setTimeout(() => resolve(true), ms);
  });
}

describe("generateTokenSwap", () => {
  it2("generates valid unsigned file", async () => {
    const unsignedFile = await generateTokenSwap(
      ethTxHash,
      senderEthAddress,
      amountTokens,
      recipientAddress
    );

    await sleep(300);

    const unsignedTx = JSON.parse(fs.readFileSync(unsignedFile));

    expect(unsignedTx.value.msg[0].value.BurnTxHash).toBe(ethTxHash);
    expect(unsignedTx.value.msg[0].value.EthereumSender).toBe(senderEthAddress);
    expect(unsignedTx.value.msg[0].value.Receiver).toBe(recipientAddress);
    expect(parseInt(unsignedTx.value.msg[0].value.AmountENG)).toBe(parseInt(amountTokens));
  });

  it2("valid signature", async () => {
    const signedFile = await createTokenSwapRequest(
      ethTxHash,
      senderEthAddress,
      amountTokens,
      recipientAddress
    );
    await sleep(300);

    const signedTx = JSON.parse(fs.readFileSync(signedFile));
    expect(signedTx.value.signatures[0].signature).toBe(expectedSignature);
  });
});
