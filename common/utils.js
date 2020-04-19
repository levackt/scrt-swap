// eslint-disable-next-line import/prefer-default-export
async function sleep (time) {
    await new Promise((resolve) => {
        setTimeout(() => resolve(true), time);
    });
}

module.exports = sleep;
