//
// this script executes when you run 'yarn test'
//
// you can also test remote submissions like:
// CONTRACT_ADDRESS=0x43Ab1FCd430C1f20270C2470f857f7a006117bbb yarn test --network rinkeby
//
// you can even run mint commands if the tests pass like:
// yarn test && echo "PASSED" || echo "FAILED"
//
import { ethers, network, deployments } from 'hardhat';
import { use, expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber, Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';

use(solidity);

describe('🚩 Challenge 4: ⚖️ 🪙 DEX', () => {
  // this.timeout(45000);

  let dexContract: Contract;
  let balloonsContract: Contract;
  let deployer: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  before(async () => {
    [deployer, user2, user3] = await ethers.getSigners();

    const Balloons = await ethers.getContractFactory('Balloons');
    balloonsContract = await Balloons.deploy();

    const DEX = await ethers.getContractFactory('DEX');
    dexContract = await DEX.deploy(balloonsContract.address);

    await balloonsContract.approve(dexContract.address, ethers.utils.parseEther('100'));

    await dexContract.init(ethers.utils.parseEther('5'), {
      value: ethers.utils.parseEther('5'),
      gasLimit: 200000,
    });
  });

  // quick fix to let gas reporter fetch data from gas station & coinmarketcap
  before((done) => {
    setTimeout(done, 2000);
  });

  describe('DEX: Standard Path', () => {
    // TODO: need to add tests that the other functions do not work if we try calling them without init() started.
    /* TODO checking `price` calcs. Preferably calculation test should be provided by somebody who didn't implement this functions in 
    challenge to not reproduce mistakes systematically.*/
    describe('init()', () => {
      it('Should DEX balance: 5 Ether and 5 BAL ', async () => {
        expect(await ethers.provider.getBalance(dexContract.address)).to.equal(ethers.utils.parseEther('5'));

        expect(await balloonsContract.balanceOf(dexContract.address)).to.equal(ethers.utils.parseEther('5'));
      });

      describe('ethToToken()', () => {
        it('Should send 1 Ether to DEX in exchange for _ $BAL', async () => {
          const ethReserve = await ethers.provider.getBalance(dexContract.address);
          const tokenReserve = await balloonsContract.balanceOf(dexContract.address);
          const tokenOutput = await dexContract.price(ethers.utils.parseEther('1'), ethReserve, tokenReserve);

          let tx1 = await dexContract.ethToToken({
            value: ethers.utils.parseEther('1'),
          });
          // TODO: SYNTAX - Figure out how to read eth balance of dex contract and to compare it against the eth sent in via this tx. Also
          //figure out why/how to read the event that should be emitted with this too.
          /* Also, notice, that reference `DEX.sol` could emit *after* `return`, so that they're never emited. It's on your own to find and
          correct */

          expect(await ethers.provider.getBalance(dexContract.address)).to.equal(ethers.utils.parseEther('6'));

          await expect(tx1).emit(dexContract, 'EthToTokenSwap').withArgs(deployer.address, 'ETH to Balloons', ethers.utils.parseEther('1'), tokenOutput);
        });

        it('Should send less tokens after the first trade (ethToToken called)', async () => {
          const ethReserve1 = await ethers.provider.getBalance(dexContract.address);
          const tokenReserve1 = await balloonsContract.balanceOf(dexContract.address);
          const tokenOutput1 = await dexContract.price(ethers.utils.parseEther('1'), ethReserve1, tokenReserve1);
          await dexContract.ethToToken({
            value: ethers.utils.parseEther('1'),
          });
          const ethReserve2 = await ethers.provider.getBalance(dexContract.address);
          const tokenReserve2 = await balloonsContract.balanceOf(dexContract.address);
          const tokenOutput2 = await dexContract.price(ethers.utils.parseEther('1'), ethReserve2, tokenReserve2);
          let tx1 = dexContract.connect(user2).ethToToken({
            value: ethers.utils.parseEther('1'),
          });
          expect(tx1).emit(dexContract, 'EthToTokenSwap').withArgs(user2.address, 'ETH to Balloons', ethers.utils.parseEther('1'), tokenOutput2);
          expect(tokenOutput2.lt(tokenOutput1));
        });
        // could insert more tests to show the declining price, and what happens when the pool becomes very imbalanced.
      });
      describe('tokenToEth', async () => {
        it('Should send 1 $BAL to DEX in exchange for _ $ETH', async () => {
          const ethReserve = await ethers.provider.getBalance(dexContract.address);
          const tokenReserve = await balloonsContract.balanceOf(dexContract.address);
          const ethOutput = await dexContract.price(ethers.utils.parseEther('1'), tokenReserve, ethReserve);

          let tx1 = await dexContract.tokenToEth(ethers.utils.parseEther('1'));

          //TODO: SYNTAX -  write an expect that takes into account the emitted event from tokenToETH.
          expect(tx1).emit(dexContract, 'TokenToEthSwap').withArgs(deployer.address, 'Balloons to ETH', ethOutput, ethers.utils.parseEther('1'));
          expect(await balloonsContract.balanceOf(dexContract.address)).to.equal(tokenReserve.add(ethers.utils.parseEther('1')));
        });

        it('Should send less eth after the first trade (tokenToEth() called)', async () => {
          let tx1 = await dexContract.tokenToEth(ethers.utils.parseEther('1'));
          const tx1_receipt = await tx1.wait();

          let tx2 = await dexContract.tokenToEth(ethers.utils.parseEther('1'));
          const tx2_receipt = await tx2.wait();

          function getEthAmount(txReceipt: any) {
            const logDescr = dexContract.interface.parseLog(txReceipt.logs.find((log: any) => log.address == dexContract.address));
            const args = logDescr.args;
            return args[2]; // index of ethAmount in event
          }
          const ethSent_1 = getEthAmount(tx1_receipt);
          const ethSent_2 = getEthAmount(tx2_receipt);
          expect(ethSent_2).below(ethSent_1);
        });
      });

      describe('deposit', async () => {
        it('Should deposit 1 ETH and 1 $BAL when pool at 1:1 ratio', async () => {
          const totalLiquidity = await dexContract.liquidity(deployer.address);
          const ethReserve = (await ethers.provider.getBalance(dexContract.address)) as BigNumber;
          const tokenReserve = (await balloonsContract.balanceOf(dexContract.address)) as BigNumber;
          const tokensDeposited = ethers.utils.parseEther('5').mul(tokenReserve).div(ethReserve).add(1);
          const liquidityMinted = ethers.utils.parseEther('5').mul(totalLiquidity).div(ethReserve);
          let tx1 = await dexContract.deposit(
            (ethers.utils.parseEther('5'),
            {
              value: ethers.utils.parseEther('5'),
            })
          );
          // TODO: SYNTAX - Write expect() assessing changed liquidty within the pool. Should have an emitted event!
          expect(tx1).emit(dexContract, 'LiquidityProvided').withArgs(deployer.address, liquidityMinted, ethers.utils.parseEther('5'), tokensDeposited);
        });
      });

      // pool should have 5:5 ETH:$BAL ratio
      describe('withdraw', async () => {
        it('Should withdraw 1 ETH and 1 $BAL when pool at 1:1 ratio', async () => {
          const totalLiquidity = (await dexContract.liquidity(deployer.address)) as BigNumber;
          const ethReserve = (await ethers.provider.getBalance(dexContract.address)) as BigNumber;
          const tokenReserve = (await balloonsContract.balanceOf(dexContract.address)) as BigNumber;
          const ethWithdrawn = ethers.utils.parseEther('1').mul(ethReserve).div(totalLiquidity);
          const tokenAmount = ethers.utils.parseEther('1').mul(tokenReserve).div(totalLiquidity);
          let tx1 = await dexContract.withdraw(ethers.utils.parseEther('1'));

          // TODO: SYNTAX - Write expect() assessing changed liquidty within the pool. Should have an emitted event!
          expect(tx1).emit(dexContract, 'LiquidityRemoved').withArgs(deployer.address, ethers.utils.parseEther('1'), ethWithdrawn, tokenAmount);
        });
      });
    });
  });
});
