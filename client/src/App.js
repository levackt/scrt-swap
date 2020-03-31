import React, { Component } from "react";
import EngSwapContract from "./contracts/EngSwap.json";
import tokenContract from "./contracts/ERC20.json";
import getWeb3 from "./getWeb3";
import {Button, InputLabel, TextField} from "@material-ui/core"
import { Alert } from '@material-ui/lab';
import "./App.css";

const cosmos = require('cosmos-lib');

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      engBalance: null,
      engToSwap: null,
      engToSwapError: null,
      scrtAddress: null,
      scrtAddressError: null,
      web3: null,
      accounts: null,
      contract: null,
      contractAddress: null,
      tokenContract: null
    };

    this.handleAmountChange = this.handleAmountChange.bind(this);
    this.handleScrtAddressChange = this.handleScrtAddressChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleAmountChange(event) {
    if (isNaN(parseFloat(event.target.value)) || parseFloat(event.target.value) <= 0) {
      this.setState({ engToSwapError: "Invalid swap amount" });
    } else if (parseFloat(event.target.value) > parseFloat(this.state.engBalance)) {
      this.setState({ engToSwapError: `Cannot exceed ${this.state.engBalance} ENG` });
    } else {
      this.setState({ 
        engToSwapError: null,
        engToSwap: event.target.value 
      });
    }
  }

  handleScrtAddressChange(event) {
    const newAddress = event.target.value;
    try {
      // checksum
      const bytes32 = cosmos.address.getBytes32(newAddress, "enigma");
      this.setState({ scrtAddress: event.target.value });
      this.setState({ scrtAddressBytes: bytes32.toString('hex')});
    } catch(error) {
      this.setState({ scrtAddressError: error.message});
    }
  }

  handleSubmit(event) {
    this.initiateSwap();
    event.preventDefault();
  }

  componentDidMount = async () => {
    try {
      // Get network provider and web3 instance.
      const web3 = await getWeb3();

      // Use web3 to get the user's accounts.
      const accounts = await web3.eth.getAccounts();

      // Get the contract instance.
      const networkId = await web3.eth.net.getId();
      const deployedNetwork = EngSwapContract.networks[networkId];
      let contractAddress = deployedNetwork.address;
      const instance = new web3.eth.Contract(
        EngSwapContract.abi,
        deployedNetwork && contractAddress
      );

      let tokenAddress = null;

      await instance.methods
        .token()
        .call()
        .then(result => {
          console.log(`Swapping with ENG contract at address: ${result}`);
          tokenAddress = result;
        });
      let tokenInstance = new web3.eth.Contract(
        tokenContract.abi,
        deployedNetwork && tokenAddress
      );

      this.setState(
        {
          web3: web3,
          accounts: accounts,
          contract: instance,
          contractAddress: contractAddress,
          tokenContract: tokenInstance
        },
        this.engBalance
      );
    } catch (error) {
      // Catch any errors for any of the above operations.
      alert(
        `Failed to load web3, accounts, or contract. Check console for details.`
      );
      console.error(error);
    }
  };

  engBalance = async () => {
    const { web3, accounts, tokenContract } = this.state;

    await tokenContract.methods
      .balanceOf(accounts[0])
      .call()
      .then(result => {
        this.setState({
          engBalance: web3.utils.fromWei(result, "ether")
        });
      });
  };

  initiateSwap = async () => {
    const {
      accounts,
      engToSwap,
      scrtAddress,
      contract,
      tokenContract,
      contractAddress,
      web3
    } = this.state;

    const swapAmount = web3.utils.toWei(engToSwap, "ether");

    const allowance = await tokenContract.methods.allowance(accounts[0], contractAddress).call()
    
    // Check if current allowance is sufficient, else approve
    if (parseFloat(allowance) < swapAmount) {
      const approveTx = await tokenContract.methods
            .approve(contractAddress, swapAmount)
            .send({ from: accounts[0] });
          if (!approveTx.status) {
            alert("Failed to approve");
            return;
          }
    }

    await contract.methods
      .burnFunds(web3.utils.fromAscii(scrtAddress), swapAmount)
      .send({
        from: accounts[0],
        gas: 1000000 // todo gas
      })
      .on("transactionHash", function(hash) {
        console.log(`swap initiated, hash=${hash}`);
      })
      .on("receipt", function(receipt) {
        console.log(
          `Got tx receipt. status=${receipt.status}, hash=${receipt.transactionHash}`
        );
      })
      .on("confirmation", function(confirmationNumber, receipt) {
        alert("Successfully swapped");
      })
      .on("error", function(contractError) {
        alert(contractError.message);
      });
  };

  render() {
    if (!this.state.web3) {
      return <div>Loading Web3, accounts, and contract...</div>;
    }
    return (
      <div className="App">
        <div>
          <form>
            <TextField
              required
              id="amount"
              label="Amount to SWAP"
              onChange={this.handleAmountChange}
            />
            {this.state.engToSwapError && (
              <Alert severity="error">{this.state.engToSwapError}</Alert>
            )}
            <InputLabel shrink>MAX : {this.state.engBalance}</InputLabel>
            <p></p>
            <TextField
              required
              id="scrtAddress"
              label="SCRT address"
              onChange={this.handleScrtAddressChange}
            />
            {this.state.scrtAddressError && (
              <Alert severity="error">{this.state.scrtAddressError}</Alert>
            )}
            <InputLabel shrink>SCRT account on EnigmaChain</InputLabel>
            <p></p>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                this.initiateSwap();
              }}
            >
              Initiate ENG to SCRT Swap
            </Button>
          </form>
        </div>
      </div>
    );
  }
}

export default App;
