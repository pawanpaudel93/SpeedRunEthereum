pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: MIT

import 'hardhat/console.sol';
import './ExampleExternalContract.sol';

contract Staker {
  ExampleExternalContract public exampleExternalContract;
  mapping(address => uint256) public balances;
  uint256 public deadline = block.timestamp + 72 hours;
  uint256 public constant threshold = 1 ether;
  bool public openForWithdraw = false;

  event Stake(address indexed staker, uint256 amount);

  modifier notCompleted() {
    require(!exampleExternalContract.completed(), 'ExampleExternalContract has already been completed');
    _;
  }

  constructor(address exampleExternalContractAddress) {
    exampleExternalContract = ExampleExternalContract(exampleExternalContractAddress);
  }

  // Collect funds in a payable `stake()` function and track individual `balances` with a mapping:
  //  ( make sure to add a `Stake(address,uint256)` event and emit it for the frontend <List/> display )

  function stake() public payable {
    require(msg.value > 0, 'You must stake a positive amount');
    balances[msg.sender] += msg.value;
    emit Stake(msg.sender, msg.value);
  }

  // After some `deadline` allow anyone to call an `execute()` function
  //  It should either call `exampleExternalContract.complete{value: address(this).balance}()` to send all the value

  // if the `threshold` was not met, allow everyone to call a `withdraw()` function

  // Add a `timeLeft()` view function that returns the time left before the deadline for the frontend

  // Add the `receive()` special function that receives eth and calls stake()
  function execute() public notCompleted {
    if (address(this).balance >= threshold) {
      exampleExternalContract.complete{value: address(this).balance}();
    } else {
      openForWithdraw = true;
    }
  }

  function withdraw() public notCompleted {
    uint256 withdrawAmount = balances[msg.sender];
    require(withdrawAmount > 0, 'Not enough funds');
    require(openForWithdraw, "Can't withdraw before execute");
    balances[msg.sender] = 0;
    (bool sent, ) = msg.sender.call{value: withdrawAmount}('');
    require(sent, 'Could not send');
  }

  function timeLeft() public view returns (uint256) {
    if (deadline > block.timestamp) {
      return deadline - block.timestamp;
    } else {
      return 0;
    }
  }

  receive() external payable {
    stake();
  }
}
