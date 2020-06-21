pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/**
 Contract to approve the transfer of ENG (Enigma ERC20 tokens) to a burn address,
 emitting an event containing the intended recipient's Secret Network address
 for the purpose of minting native coins on the Secret Network.
 */
contract EngSwap {
    using SafeMath for uint256;

    /// ENG contract address
    IERC20 public token;
    /// Links the tx hash to the burn event
    uint256 public burnNonce;
    /// total amount of ENG burnt
    uint256 public totalBurnt;
    /// address tokens are transferred to by the burn event
    address burningAddress = 0x000000000000000000000000000000000000dEaD;

    constructor(IERC20 _token) public {
        token = _token;
    }

    /// Burn event log
    event LogBurn(
        address _from,
        bytes _to,
        uint256 _amount,
        uint256 _nonce
    );

    modifier canDeliver(address _sender, uint256 _amount) {
        require(
            token.balanceOf(_sender) >= _amount,
            'Insufficient ERC20 token balance for delivery.'
        );
        _;
    }

    modifier availableNonce() {
        require(
            burnNonce + 1 > burnNonce,
            'No available nonces.'
        );
        _;
    }

    /*
    * Burn funds and emit a LogBurn event for emission on the Secret Network
    *
    * @param _recipient: The intended recipient's Secret Network address.
    * @param _amount: The amount of ENG tokens to be itemized.
    */
    function burnFunds(bytes memory _recipient, uint256 _amount)
    public availableNonce
    canDeliver(msg.sender, _amount)
     {
        /// Increment the lock nonce
        burnNonce = burnNonce.add(1);
        /// Add to burnt total
        totalBurnt = totalBurnt.add(_amount);
        /// Transfer to burn address
        require(token.transferFrom(msg.sender, burningAddress, _amount), "Unable to transfer to the burning address");
        emit LogBurn(
            msg.sender,
            _recipient,
            _amount,
            burnNonce
        );
    }
}
