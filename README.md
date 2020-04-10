# ENG to SCRT Unidirectional Swap Tooling

This set of tools provides a reasonably secure mechanism for burning ENG on Ethereum, and minting
SCRT 1-to-1 on the Enigma chain. 

## Work in Progress

Development tasks:

- [x] Smart contract that burns ENG
- [x] Leader that watches Ethereum, and unsigned tx to the db (mocked tx)
- [x] Operator watches Ethereum and sign the tx (mocked sig)
- [ ] Leader ratifies the tx and submits to enigma cli
- [ ] Integrate enigmacli into the operator and learder (real tx and sig)
- [x] Frontend React template integrate with Web and the smart contract
- [ ] Burn ENG form in frontend
- [x] End-to-end integration test
- [ ] Stress test and dry run
- [x] Minter module that authenticates the multisig address (is this needed?)

Operational tasks:

- [ ] Vote on operators and leader
- [x] Do we need a Minter module or are coins pre-mined?
- [ ] Operators configure their private key in their enigmad
- [ ] Leader creates the multigig address and imports operators public keys in enigmad

This repo contains the implementation for the [Multisig Setup Proposal](https://hackmd.io/AY1XxpRsQey1E-qB3iSyVg)

## Installation

First ensure you are in a new and empty directory.

1. Install the dependencies
   ```js
   yarn
   ```

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
    # Set other environment variables in a .env file in the project root
    ROLE=leader node ./server.js
    ```
   
7. Start multiple operators
    ```
    # Set other environment variables in a .env file in the project root
    ROLE=operator node ./server.js
    ```
   
8. The `client` folder contains a frontend template that gets Web3 and imports the
    `EngSwap` contract. The contract has single `burnFunds(bytes memory _recipient, uint256 _amount)`
    public function. Usage specs and examples can be found in `swap.test.js`.
    When all the components are online, swaps can be tested by calling
    `burnFunds` using Remix or Web3, or by creating a page in the frontend.

## FAQ

* __How do I use this with the Ganache-CLI?__

    It's as easy as modifying the config file! [Check out our documentation on adding network configurations](http://truffleframework.com/docs/advanced/configuration#networks). Depending on the port you're using, you'll also need to update line 29 of `client/src/utils/getWeb3.js`.

