pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC20/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";


/**
  https://github.com/element-group/enigma-erc20-smart-contract/blob/9b6a6edab5eaf79242cc59d705f8b315657f87b7/contracts/EnigmaToken.sol
 */
contract EngToken is ERC20Detailed, ERC20Pausable {

  uint256 public constant INITIAL_SUPPLY = 100000000000000000;    // 1 Billion ENG specified in Grains

  constructor () 
    ERC20Detailed('Enigma Token', 'ENG', 8)
    public {
      _mint(msg.sender, INITIAL_SUPPLY);                      // Creator address is assigned all
  }
  /**
   * @dev Transfer token for a specified address when not paused
   * @param _to The address to transfer to.
   * @param _value The amount to be transferred.
   */
  function transfer(address _to, uint256 _value) whenNotPaused public returns (bool) {
    require(_to != address(0));
    return super.transfer(_to, _value);
  }
  /**
   * @dev Transfer tokens from one address to another when not paused
   * @param _from address The address which you want to send tokens from
   * @param _to address The address which you want to transfer to
   * @param _value uint256 the amount of tokens to be transferred
   */
  function transferFrom(address _from, address _to, uint256 _value) whenNotPaused public returns (bool) {
    require(_to != address(0));
    return super.transferFrom(_from, _to, _value);
  }
}
