# With the passing of Proposal 27, the $ENG to $SCRT swap is CLOSED. $SCRT can now only be created via network inflation. Over 114M $ENG tokens were burned over the past ~6 months in over 3,000 individual swaps to nearly 2,000 addresses.


# ENG to SCRT Unidirectional Swap Tooling

This set of tools provides a reasonably secure mechanism for burning ENG on Ethereum, and minting
SCRT 1-to-1 on the Enigma chain. 

This repo contains the implementation for the [Multisig Setup Proposal](https://hackmd.io/AY1XxpRsQey1E-qB3iSyVg)

## Installation

Clone this repo

```sh
    git clone https://github.com/levackt/scrt-swap.git
```

#### Prerequisites
- mongodb
- Eth provider
- Yarn: 1.22.*
- Node: v12.*


1. Install the dependencies
   ```js
   yarn
   ```

2. Edit the environment as needed, for kamut's that config/test.json

3. Start leader/operator with nodeEnv, defaults to prod
   ```js
   ROLE=leader node ./server.js --nodeEnv=test
   ```

## Installation - DEV

1. Install the dependencies
   ```js
   yarn
   ```
   To install yarn you can follow this guide.
   [install yarn](https://linuxize.com/post/how-to-install-yarn-on-ubuntu-18-04/)

2. In a new terminal session, run ganache:
    ```
    ganache-cli -d -i 50
    ```

3. In another new terminal session, run the database:
    ```
    docker-compose run --service-ports mongo
    ```
   
4. Compile and migrate the smart contracts:
    ```
    yarn migrate
    ```

5. Run the unit tests (the `yarn test` also migrates). The unit test is more of an integration tests that burns tokens and verifies the leader and operators busines logic.
    ```
    yarn test
    ```

6. Start the leader
    ```
    ROLE=leader node ./server.js --nodeEnv=dev
    ```
   
7. Start multiple operators
    ```
    # Set other environment variables in a .env file in the project root
    ROLE=operator node ./server.js --nodeEnv=dev
    ```
   
8. The `client` folder contains a frontend template that gets Web3 and imports the
    `EngSwap` contract. The contract has single `burnFunds(bytes memory _recipient, uint256 _amount)`
    public function. Usage specs and examples can be found in `swap.test.js`.
    When all the components are online, swaps can be tested by calling
    `burnFunds` using Remix or Web3, or by creating a page in the frontend.

## Keeping the worker running

The leader and operators should be fault tolerant and recover from errors such as network,
database or blockchain connection failures.

The worker will log such errors and exit, it is up to the host to keep it running with Docker or a process manager such as [PM2](https://pm2.keymetrics.io/docs/usage/process-management/).

- Using PM2

```sh
# install pm2
npm install -g pm2

# start the server as an operator for eg
ROLE=operator pm2 start 'node ./server.js --nodeEnv=test --chainId=kamut-2' --name "operator"

# or as the leader, broadcasting with the multisig account called multi1
ROLE=leader pm2 start 'node ./server.js --nodeEnv=test --chainId=kamut-2 --fromAccount=multi1' --name "leader"

# generate a startup script, copy/paste the output as instructed
pm2 startup

# save the list of processes to respawn at machine reboot
pm2 save

# view process logs
pm2 logs

# restart, to reload config for example
pm2 restart operator

```
