import React, { Component } from "react";
import EngSwapContract from "./contracts/EngSwap.json";
import tokenContract from "./contracts/ERC20.json";
import getWeb3 from "./getWeb3";
import Alert from '@material-ui/lab/Alert';
import "./App.css";
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Link from '@material-ui/core/Link';
import Typography from '@material-ui/core/Typography';
import InputTwoToneIcon from '@material-ui/icons/InputTwoTone';
import styled, { ThemeProvider } from 'styled-components';
import { createMuiTheme} from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import CssBaseline from '@material-ui/core/CssBaseline';
import Grid from '@material-ui/core/Grid';
import theme from './theme';

const cosmos = require('cosmos-lib');
const Web3 = require('web3');


const StyledButton = styled(Button)`
  color: ${props => props.theme.palette.primary.main};
`;

class App extends Component {

  constructor(props) {
    super(props);

    this.state = {
      accepted: false,
      engBalance: null,
      swapAmount: null,
      recipientAddress: null,
      recipientAddressBytes: null,
      web3: null,
      accounts: null,
      contract: null,
      contractAddress: null,
      tokenContract: null,
      errors: {
        swapAmount: '',
        recipientAddress: '',
        termsAccepted: '',
      },
      receipt: null,
      infoMessage: null
    };
  }

  handleChange = (event) => {

    const { name, value, checked } = event.target;
    const {errors, engBalance} = this.state;

    switch (name) {
      case 'termsAccepted':
      
        if (!checked) {
          errors.termsAccepted = 'You must agree to the terms and conditions';
        } else {
          errors.termsAccepted = ''
        }

        this.setState({accepted: checked});
        break

      case 'swapAmount':
        errors.swapAmount = 
          (value.length === 0 || 
          isNaN(value) || 
          parseFloat(value) <= 0 ||
          parseInt(Web3.utils.toWei(value, 'ether')) > parseInt(engBalance))
            ? `Invalid swap amount`
            : '';
        break;

      case 'recipientAddress': 
        errors.recipientAddress = ''
        try {
          // checksum
          const bytes32 = cosmos.address.getBytes32(value, "enigma");
          this.setState(
            { 
              recipientAddress: value ,
              recipientAddressBytes: bytes32.toString('hex')
            });
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
    } else {
      this.setInfoMessage(this.state.errors)
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

      // Confirm we have a contract configured
      if (!deployedNetwork) {
        debugger 

        this.setInfoMessage("Network is unsupported");
        return
      }

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
      this.setInfoMessage(
        `Failed to load web3, accounts, or contract. Check console for details.`
      );
      console.error(error);
    }
  };

  engBalance = async () => {
    const { accounts, tokenContract } = this.state;

    await tokenContract.methods
      .balanceOf(accounts[0])
      .call()
      .then(result => {
        this.setState({
          engBalance: result,
          maxSwap: Web3.utils.fromWei(result, "ether") + " ENG"
        });
      });
  };

  setInfoMessage = message => {
    this.setState({infoMessage: message});
  }

  initiateSwap = async () => {

    const {
      accounts,
      swapAmount,
      contract,
      tokenContract,
      contractAddress
    } = this.state;

    const swapAmountWei = Web3.utils.toWei(swapAmount, "ether");

    const self = this;
    
    const allowance = await tokenContract.methods.allowance(accounts[0], contractAddress).call()
    
    // Check if current allowance is sufficient, else approve
    if (parseInt(allowance) < parseInt(swapAmountWei)) {
      const approveTx = await tokenContract.methods
        .approve(contractAddress, swapAmountWei)
        .send({ 
          from: accounts[0],
          gas: 500000
        });
      if (!approveTx.status) {
        self.setInfoMessage("Failed to approve");
        return;
      }
    }

    await contract.methods
      .burnFunds(Web3.utils.fromAscii(self.state.recipientAddressBytes), swapAmountWei)
      .send({
        from: accounts[0],
        gas: 1000000
      })
      .on("transactionHash", function(hash) {
        console.log(`Broadcasting tx hash=${hash}`);
      })
      .on("receipt", function(receipt) {
        self.setState({receipt: receipt})
      })
      .on("confirmation", function(confirmationNumber, receipt) {
        self.setState({receipt: receipt});
        if (receipt.status === true) {
          self.setInfoMessage("Successfully swapped");
        } else {
          self.setInfoMessage("Swap failed");
        }
      })
      .on("error", function(contractError) {
        console.error(`Contract error: ${contractError.message}`)
        self.setInfoMessage("Swap failed. Check console for details.");
      });
  };

  canSubmit = () => {
    return this.state.accepted && 
      this.state.swapAmount > 0 && 
      this.state.recipientAddress &&
      this.validateForm(this.state.errors)
  }

  render() {
    const {errors, receipt} = this.state;

    if (!this.state.web3) {
      return <div>Loading Web3, accounts, and contract...</div>;
    }
    
    return (

    <Container component="main" maxWidth="xs">
      <CssBaseline />
      <ThemeProvider theme={theme}>
      <div className="App">
        <Typography component="h1" variant="h5">
          ENG <InputTwoToneIcon fontSize="small"/> SCRT
        </Typography>
          <form noValidate>
             <Grid container spacing={2}>
                <Grid item sm={12}>
                  <FormControlLabel control={
                    <TextField
                      required
                      name="swapAmount"
                      label="Amount to swap"
                      autoFocus
                      onChange={this.handleChange}
                    />
                  }
                  label={this.state.maxSwap}/>
                </Grid>

                <Grid item sm={12}>
                {errors.swapAmount.length > 0 && 
                  <span className='error'>{errors.swapAmount}</span>}
                </Grid>

                <Grid item sm={12}>
                  <FormControlLabel control={
                    <TextField
                      required
                      name="recipientAddress"
                      label="SCRT address"
                      onChange={this.handleChange}
                    />
                  }
                  label="? SCRT"/>
                  {errors.recipientAddress.length > 0 && 
                  <span className='error'>{errors.recipientAddress}</span>}
                  </Grid>
                  <Grid item sm={12}>
                    <FormControlLabel control={
                        <Checkbox
                          onChange={this.handleChange}
                          checked={this.state.accepted}
                          name="termsAccepted"
                          color="primary"
                        />
                      }
                      label = "Agree to the SCRT swap conditions?"/>
                      </Grid>
                      <Grid item sm={12}>
                        <StyledButton 
                          onClick={this.handleSubmit} 
                          disabled={!this.canSubmit()}
                        >Start Swap
                        </StyledButton>
                        </Grid>

                        <Grid item xs={12}>

                          {this.state.infoMessage && (
                            <Alert severity="error">{this.state.infoMessage}</Alert>  
                          )}
                          {receipt !== null && receipt.transactionHash !== '' && (
                            <Link href={'https://etherscan/tx/' + receipt.transactionHash}>Tx confirmed: etherscan.io</Link>
                          )}

                          {receipt !== null && receipt.status === false && (
                          <Alert severity="error">Swap failed. {receipt.message}</Alert>)}

                          {receipt !== null && receipt.status !== false && (
                          <Alert severity="info">Swap initiated</Alert>)}
                        </Grid>
              </Grid>
          </form>
        </div>
      </ThemeProvider>

    </Container>
    );
  }
}

export default App;
