import React, { Component } from "react";
import EngSwapContract from "./contracts/EngSwap.json";
import tokenContract from "./contracts/ERC20.json";
import getWeb3 from "./getWeb3";
import {Button, TextField} from "@material-ui/core"
import "./App.css";

const cosmos = require('cosmos-lib');

class App extends Component {

  constructor(props) {
    super(props);

    this.state = {
      engBalance: null,
      swapAmount: null,
      recipientAddress: null,
      web3: null,
      accounts: null,
      contract: null,
      contractAddress: null,
      tokenContract: null,
      errors: {
        swapAmount: '',
        recipientAddress: '',
      },
      receipt: null
    };
  }

  handleChange = (event) => {
    event.preventDefault();
    const { name, value } = event.target;
    const {errors, web3, engBalance, accounts} = this.state;

    switch (name) {
      case 'swapAmount': 

        errors.swapAmount = 
          (value.length <= 0 || 
          isNaN(value) || 
          parseFloat(value) <= 0 ||
          parseInt(web3.utils.toWei(value, 'ether')) > parseInt(engBalance))
            ? `Invalid swap amount. ${accounts[0]} has ${web3.utils.fromWei(engBalance)} ENG`
            : '';
        break;
      case 'recipientAddress': 
        try {
          // checksum
          const bytes32 = cosmos.address.getBytes32(value, "enigma");
          this.setState({ recipientAddress: value });
          this.setState({ scrtAddressBytes: bytes32.toString('hex')});
        } catch(error) {
          errors.recipientAddress = error.message;
        }
        break;
      default:
        break;
    }

    this.setState({errors, [name]: value});
  }

  handleSubmit = (event) => {

    event.preventDefault();

    if(this.validateForm(this.state.errors)) {
      this.initiateSwap();
    }
  }

  validateForm = (errors) => {
    let valid = true;
    Object.values(errors).forEach(
      (val) => val.length > 0 && (valid = false)
    );
    return valid;
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
          engBalance: result
        });
      });
  };

  initiateSwap = async () => {

    const {
      accounts,
      swapAmount,
      recipientAddress,
      contract,
      tokenContract,
      contractAddress,
      web3
    } = this.state;

    const swapAmountWei = web3.utils.toWei(swapAmount, "ether");

    const allowance = await tokenContract.methods.allowance(accounts[0], contractAddress).call()
    
    // Check if current allowance is sufficient, else approve
    if (parseInt(allowance) < parseInt(swapAmountWei)) {
      const approveTx = await tokenContract.methods
            .approve(contractAddress, swapAmountWei)
            .send({ from: accounts[0] });
          if (!approveTx.status) {
            alert("Failed to approve");
            return;
          }
    }

    await contract.methods
      .burnFunds(web3.utils.fromAscii(recipientAddress), swapAmount)
      .send({
        from: accounts[0],
        gas: 1000000 // todo gas
      })
      .on("transactionHash", function(hash) {
        console.log(`Broadcasting tx hash=${hash}`);
      })
      .on("receipt", function(receipt) {
        debugger
        this.setState({receipt: receipt})
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
    const {errors, receipt} = this.state;

    if (!this.state.web3) {
      return <div>Loading Web3, accounts, and contract...</div>;
    }
    return (
      <div className="App">
        <div>
          <form onSubmit={this.handleSubmit} noValidate>
            <div>
              <div>
                <TextField
                  required
                  name="swapAmount"
                  label="Amount to SWAP"
                  onChange={this.handleChange}
                />
              </div>
              <div>
                {errors.swapAmount.length > 0 && 
                <span className='error'>{errors.swapAmount}</span>}
              </div>
            </div>
            <p></p>
            <div>
              <div>
                <TextField
                  required
                  name="recipientAddress"
                  label="SCRT address"
                  onChange={this.handleChange}
                />
              </div>
              <div>
                {errors.recipientAddress.length > 0 && 
                <span className='error'>{errors.recipientAddress}</span>}
              </div>
            </div>
            <p></p>

            <div className='submit'>
              <div className='submit'>
                <button>Start Swap</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }
}

export default App;
