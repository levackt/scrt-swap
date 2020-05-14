import React, { Component } from "react";
import EngSwapContract from "./contracts/EngSwap.json";
import tokenContract from "./contracts/ERC20.json";
import getWeb3 from "./getWeb3";
import Alert from "@material-ui/lab/Alert";
import "./App.css";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Link from "@material-ui/core/Link";
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import { IconButton } from '@material-ui/core';
import Typography from "@material-ui/core/Typography";
import InputTwoToneIcon from "@material-ui/icons/InputTwoTone";
import Tooltip from '@material-ui/core/Tooltip';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import styled, { ThemeProvider } from "styled-components";
import Container from "@material-ui/core/Container";
import CssBaseline from "@material-ui/core/CssBaseline";
import Grid from "@material-ui/core/Grid";
import theme from "./theme";
import TermsDialog from "./components/terms"
import Box from "./components/Box";

const cosmos = require("cosmos-lib");
const Web3 = require("web3");
const prefix = process.env.REACT_APP_BECH32_PREFIX || 'enigma';
const tokenDecimals = 8;
const ETHERSCAN_MAINNET = 'http://etherscan.io/tx/';
const ETHERSCAN_RINKEBY = 'http://rinkeby.etherscan.io/tx/';

const StyledButton = styled(Button)`
  color: ${props => props.theme.palette.primary.main};
`;

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      accepted: false,
      submitting: false,
      tokenBalance: null,
      swapAmount: null,
      recipientAddress: null,
      web3: null,
      accounts: null,
      contract: null,
      contractAddress: null,
      tokenContract: null,
      errors: {
        swapAmount: "",
        recipientAddress: "",
        termsAccepted: ""
      },
      receipt: null,
      infoMessage: null,
      errorMessage: null,
      transactionHash: null,
      etherscanUrl: ETHERSCAN_RINKEBY
    };
  }

  handleChange = event => {
    const { name, value, checked } = event.target;
    const { errors, tokenBalance } = this.state;
    let newValue = value;
    
    switch (name) {
      case "termsAccepted":
        if (!checked) {
          errors.termsAccepted = "You must agree to the terms and conditions";
        } else {
          errors.termsAccepted = "";
        }

        this.setState({ accepted: checked });
        break;

      case "swapAmount":

        if(value.length === 0 || isNaN(value)) {
            errors.swapAmount = "Invalid swap amount"
        } else if (parseFloat(value) < 1) {
            errors.swapAmount = "Minimum 1 ENG"
        } else if (this.toGrains(value) > Web3.utils.toBN(tokenBalance)) {
            errors.swapAmount = "Insufficient balance"
        } else {
          if (value.includes(".") && value.substring(value.indexOf(".")).length > tokenDecimals) {
            newValue = parseFloat(parseFloat(value, tokenDecimals).toFixed(tokenDecimals)).toString();
          }
          errors.swapAmount = "";
        }
        break;

      case "recipientAddress":
        errors.recipientAddress = "";
        if (!value || !value.startsWith(prefix)) {
          errors.recipientAddress = `Invalid prefix, expected ${prefix}`;
        }
        try {
          cosmos.address.getBytes32(value, prefix);
          this.setState({
            recipientAddress: value
          });
        } catch (error) {
          errors.recipientAddress = error.message;
        }
        break;

      default:
        break;
    }

    this.setState({ errors, [name]: newValue });
  };

  handleSubmit = event => {
    event.preventDefault();

    if (this.validateForm(this.state.errors)) {
      this.initiateSwap();
    } else {
      this.setErrorMessage(this.state.errors);
    }
  };

  validateForm = errors => {
    let valid = true;
    Object.values(errors).forEach(val => val.length > 0 && (valid = false));
    return valid;
  };

  networkHandler = async (networkId) => {
    const {web3} = this.state;

    const deployedNetwork = EngSwapContract.networks[networkId];

    // Confirm we have a contract configured
    if (!deployedNetwork) {
      this.setErrorMessage("Network is unsupported");
      return;
    } else {
      this.setErrorMessage("");
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
      const tokenInstance = new web3.eth.Contract(
        tokenContract.abi,
        deployedNetwork && tokenAddress
      );
      
      this.setState({
        contract: instance,
        contractAddress: contractAddress,
        tokenContract: tokenInstance,
        etherscanUrl: networkId === 1 ? ETHERSCAN_MAINNET : ETHERSCAN_RINKEBY
      },
      this.tokenBalance
    );
  }

  etherscanUrl = () => {
    const {etherscanUrl, transactionHash} = this.state;
    return etherscanUrl + transactionHash;
  }

  accountsHandler = accounts => {
    if (accounts && accounts.length > 0) {
      this.setState({
        accounts: accounts,
        errors: {
          swapAmount: "",
          recipientAddress: "",
          termsAccepted: ""
        }
      })
      this.tokenBalance();
    }
  }

  componentDidMount = async () => {
    try {
      // Get network provider and web3 instance.
      const web3 = await getWeb3(this.accountsHandler, this.networkHandler);

      // Use web3 to get the user's accounts.
      const accounts = await web3.eth.getAccounts();

      // Get the contract instance.
      const networkId = await web3.eth.net.getId();
      this.setState({
        web3: web3,
        accounts: accounts,
      });

      this.networkHandler(networkId);
    } catch (error) {
      // Catch any errors for any of the above operations.
      this.setErrorMessage(
        `Failed to load web3, accounts, or contract. Check console for details.`
      );
      console.error(error);
    }
  };

  tokenBalance = async () => {
    const { accounts, tokenContract } = this.state;

    if (accounts && accounts.length > 0 && tokenContract) {
      await tokenContract.methods
        .balanceOf(accounts[0])
        .call()
        .then(result => {
          this.setState({
            tokenBalance: result,
            maxSwap: this.fromGrains(result)
          });
        });
    }
  };

  setInfoMessage = message => {
    this.setState({ infoMessage: message, errorMessage: null });
  };

  setErrorMessage = message => {
    this.setState({ errorMessage: message, infoMessage: null });
  };

  toGrains = amount => {
    return parseFloat(amount) * 10 ** tokenDecimals;
  }

  fromGrains = amount => {
    return Web3.utils.toBN(amount) / Math.pow(10, tokenDecimals)
  }

  initiateSwap = async () => {
    const {
      accounts,
      swapAmount,
      contract,
      tokenContract,
      contractAddress
    } = this.state;

    const self = this;

    const allowance = await tokenContract.methods
      .allowance(accounts[0], contractAddress)
      .call();

    this.setState({submitting: true});

    const swapAmountGrains = this.toGrains(swapAmount)

    // Check if current allowance is sufficient, else approve
    if (Web3.utils.toBN(allowance).lt(Web3.utils.toBN(swapAmountGrains))) {
      self.setInfoMessage("Approve the ENG Swap contract to transfer ENG");
      this.approveEmitter = await tokenContract.methods
        .approve(contractAddress, swapAmountGrains)
        .send({
          from: accounts[0],
          gas: 100000
        })
        .on("confirmation", function(confirmationNumber, receipt) {
          if (receipt.status === true) {
            self.setInfoMessage("Transfer approved. Sign the burnFunds tx");
            this.stopListeners();
          } else {
            self.setState({submitting: false});
            self.setErrorMessage("Failed to approve ENG transfer");
          }
        })
        .on("error", function(contractError) {
          console.error(`Contract error: ${contractError.message}`);
          self.setErrorMessage("Failed to approve ENG transfer");
          self.setState({submitting: false});
        });
    }

    this.burnEmitter = await contract.methods
      .burnFunds(
        Web3.utils.fromAscii(self.state.recipientAddress),
        swapAmountGrains
      )
      .send({
        from: accounts[0],
        gas: 1000000
      })
      .on("transactionHash", function(hash) {
        self.setState({ transactionHash: hash });
        self.setInfoMessage(`Broadcasting tx`);
      })
      .on("receipt", function(receipt) {
        self.setState({ transactionHash: receipt.transactionHash });
      })
      .on("confirmation", function(confirmationNumber, receipt) {
        if (receipt.status === true) {
          self.setInfoMessage("Successfully swapped");
          this.stopListeners();
        } else {
          self.setErrorMessage("Swap failed");
        }
      })
      .on("error", function(contractError) {
        console.error(`Contract error: ${contractError.message}`);
        self.setErrorMessage("Swap failed. Check console for details.");
      });
  };

  stopListeners = () => {
    if (this.burnEmitter) {
      this.burnEmitter.removeAllListeners();
    }

    if (this.approveEmitter) {
      this.approveEmitter.removeAllListeners();
    }
  }

  canSubmit = () => {
    return (
      !this.state.submitting &&
      this.state.accepted &&
      this.state.swapAmount > 0 &&
      this.state.recipientAddress &&
      this.validateForm(this.state.errors)
    );
  };

  maxSwapAmount = () => {
    const { tokenBalance } = this.state;
    this.setState({swapAmount: this.fromGrains(tokenBalance)});
  }

  hasEng = () => {
    const { tokenBalance } = this.state;
    return tokenBalance && parseFloat(tokenBalance) > 0
  }

  render() {
    const { errors } = this.state;

    if (!this.state.web3) {
      return <div>Loading Web3, accounts, and contract...</div>;
    }

    return (
      <Container component="main" maxWidth="xs">
        <CssBaseline />
        <ThemeProvider theme={theme}>
          <div className="App">
            <Box
              fontFamily="h6.fontFamily"
              fontSize={{ xs: 'h6.fontSize', sm: 'h4.fontSize', md: 'h3.fontSize' }}
              p={{ xs: 2, sm: 3, md: 4 }}
            >
              <Typography component="h1" variant="h5" style={{ marginTop: 50 }}>
                ENG <InputTwoToneIcon fontSize="small" /> SCRT
              </Typography>

              <p></p>

              <form noValidate>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <TextField
                        required
                        name="swapAmount"
                        id="swapAmount"
                        disabled={!this.hasEng()}
                        label="ENG to swap"
                        value={this.state.swapAmount || ""}
                        autoFocus
                        onChange={this.handleChange}
                      />
                    }
                    label={this.state.maxSwap}
                    labelPlacement="bottom"
                  />
                  
                  <Tooltip title="Swap full ENG balance" aria-label="scrt">
                    <IconButton
                        disabled={!this.hasEng()}
                        onClick={this.maxSwapAmount}
                        >
                        <ArrowUpwardIcon/>
                      </IconButton>
                  </Tooltip>
                </Grid>

                {errors.swapAmount.length > 0 && (
                  <Grid item xs={12}>
                    <Typography style={{ color: "red", marginTop: 0 }}>
                        {errors.swapAmount}
                    </Typography>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <TextField
                        required
                        name="recipientAddress"
                        label="SCRT address"
                        onChange={this.handleChange}
                        disabled={!this.hasEng()}
                      />
                    }
                    label=" SCRT"
                    labelPlacement="bottom"
                  />
                  <Tooltip title="Learn how to create a Secret account" aria-label="scrt">
                    <IconButton>
                        <HelpOutlineIcon fontSize="small"/>
                    </IconButton>
                  </Tooltip>
                </Grid>

                {errors.recipientAddress.length > 0 && (
                  <Grid item xs={12}>
                    <Typography style={{ color: "red", marginTop: 0 }}>
                      {errors.recipientAddress}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Checkbox
                        onChange={this.handleChange}
                        checked={this.state.accepted}
                        name="termsAccepted"
                        color="primary"
                      />
                  <TermsDialog></TermsDialog>
                </Grid>
                <Grid item xs={12}>
                  <StyledButton color="primary"
                    onClick={this.handleSubmit}
                    disabled={!this.canSubmit()}
                  >
                    Start Swap
                  </StyledButton>
                </Grid>
                <Grid item xs={12}>
                  {this.state.infoMessage && (
                    <Alert severity="info">{this.state.infoMessage}</Alert>
                  )}
                  {this.state.errorMessage && (
                    <Alert severity="error">{this.state.errorMessage}</Alert>
                  )}
                  {this.state.transactionHash && (
                    <StyledButton variant="contained" color="white" href="#contained-buttons">
                      <Link
                        href={this.etherscanUrl()}
                      >View on Etherscan
                      </Link>
                    </StyledButton>
                  )}
                </Grid>
              </Grid>
            </form>
            </Box>
          </div>
        </ThemeProvider>
      </Container>
    );
  }
}

export default App;
