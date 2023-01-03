pragma solidity >=0.8.0 <0.9.0;
// SPDX-License-Identifier: MIT

//import "@openzeppelin/contracts/access/Ownable.sol";
import './YourToken.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract Vendor is Ownable {
  YourToken public yourToken;
  uint256 public constant tokensPerEth = 100;
  event BuyTokens(address buyer, uint256 amountOfEth, uint256 amountOfTokens);

  constructor(address tokenAddress) {
    yourToken = YourToken(tokenAddress);
  }

  function buyTokens() public payable {
    require(msg.value > 0, 'You must send some ether');
    uint256 amountOfTokens = msg.value * tokensPerEth;
    yourToken.transfer(msg.sender, amountOfTokens);
    emit BuyTokens(msg.sender, msg.value, amountOfTokens);
  }

  function withdraw() public onlyOwner {
    (bool sent, ) = msg.sender.call{value: address(this).balance}('');
    require(sent, 'Failed to send ether to the owner');
  }

  function sellTokens(uint256 theAmount) public {
    require(yourToken.balanceOf(msg.sender) >= theAmount, 'You do not have enough tokens');
    uint256 amountOfEth = theAmount / tokensPerEth;
    bool sent = yourToken.transferFrom(msg.sender, address(this), theAmount);
    require(sent, 'Failed to send tokens to the owner');
    (sent, ) = msg.sender.call{value: amountOfEth}('');
    require(sent, 'Failed to send ether');
  }
}
