import React, { Component } from "react";
import EngSwapContract from "./contracts/EngSwap.json";
import tokenContract from "./contracts/ERC20.json";
import getWeb3 from "./getWeb3";
import Button from "@material-ui/core/Button";
import InputLabel from "@material-ui/core/InputLabel";
import TextField from "@material-ui/core/TextField";

import "./App.css";

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      engBalance: null,
      engToSwap: null,
      scrtAddress: null,
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
    this.setState({ engToSwap: event.target.value });
  }

  handleScrtAddressChange(event) {
    this.setState({ scrtAddress: event.target.value });
  }

  handleSubmit(event) {
    debugger;
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

      // Call balanceOf function

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
        this.swapDetails
      );
    } catch (error) {
      // Catch any errors for any of the above operations.
      alert(
        `Failed to load web3, accounts, or contract. Check console for details.`
      );
      console.error(error);
    }
  };

  swapDetails = async () => {
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

  canSwap = () => {
    // todo form validation, then check if scrtAddress is valid

    const { engToSwap, scrtAddress, web3 } = this.state;
    return (
      engToSwap && scrtAddress && web3.utils.toWei(engToSwap, "ether") !== "0"
    );
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

    if (!this.canSwap()) {
      alert("invalid data");
      return;
    }

    const weiAmount = web3.utils.toWei(engToSwap, "ether");

    debugger;

    const approveTx = await tokenContract.methods
      .approve(contractAddress, weiAmount)
      .send({ from: accounts[0] });
    if (!approveTx.status) {
      alert("Failed to approve");
      return;
    }
    await contract.methods
      .burnFunds(web3.utils.fromAscii(scrtAddress), weiAmount)
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
            <InputLabel shrink>MAX : {this.state.engBalance}</InputLabel>
            <p></p>
            <TextField
              required
              id="scrtAddress"
              label="SCRT address"
              onChange={this.handleScrtAddressChange}
            />
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
