pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract EngSwap {
    using SafeMath for uint256;

    IERC20 public token;
    uint256 public burnNonce;
    address burningAddress = 0x0;

    constructor(IERC20 _token) public {
        token = _token;
    }

    /*
    * Event declarations
    */
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
    * Burn funds and emit a LogBurn event for emission on the Enigma Chain
    *
    * @param _recipient: The intended recipient's Enigma Chain address.
    * @param _amount: The amount of ENG tokens to be itemized.
    */
    function burnFunds(bytes memory _recipient, uint256 _amount)
    availableNonce
    canDeliver(msg.sender, _amount)
    public {
        // Increment the lock nonce
        burnNonce = burnNonce.add(1);
        // The funds are gone forever
        require(token.transferFrom(msg.sender, burningAddress, _amount), "Unable to transfer to the burning address");
        emit LogBurn(
            msg.sender,
            _recipient,
            _amount,
            burnNonce
        );
    }
}
