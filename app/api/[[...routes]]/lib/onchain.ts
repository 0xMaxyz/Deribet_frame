import dotenv from "dotenv";
import {
  parseUnits,
  createWalletClient,
  createPublicClient,
  http,
  getContract,
  parseEther,
  encodeFunctionData,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { Address } from "viem";
import { abi } from "./abi";
import { env } from "process";
import { log } from "./functions";

dotenv.config();

// Set initial values
const isTesting = process.env.TESTING as string;

const vault = privateKeyToAccount(process.env.VAULT_PRIVATE_KEY as Address);

const client = createWalletClient({
  account: vault,
  chain: isTesting === "true" ? baseSepolia : base,
  transport: http(
    isTesting === "true"
      ? (process.env.BASE_SEPOLIA_RPC as string)
      : (process.env.BASE_MAINNET_RPC as string)
  ),
});

export const publicClient = createPublicClient({
  chain: base,
  transport: http(
    isTesting === "true"
      ? (process.env.BASE_SEPOLIA_RPC as string)
      : (process.env.BASE_MAINNET_RPC as string)
  ),
})

export const transferToken = async function (
  wallet: Address
): Promise<`0x${string}` | undefined> {
  const tokenAddress =
    isTesting === "true"
      ? (process.env.TEST_TOKEN_ADDRESS as `0x${string}`)
      : (process.env.TOKEN_ADDRESS as `0x${string}`);

  const balance = await publicClient.getBalance({ address: wallet as Address });
  const minBalance = 4e15; // Minimum balance of 0.0004 ETH (in wei)
  if (balance < minBalance) {
    console.warn(`Skipping address ${wallet}, balance below minimum (0.0004 ETH)`);

    const data = encodeFunctionData({
      abi,
      functionName: "transfer",
      args: [wallet, parseEther(process.env.ALLOCATION_AMOUNT as string)],
    });

    const txHash = await client.sendTransaction({
      account: vault,
      to: tokenAddress,
      data: data,
      maxFeePerGas: parseUnits(process.env.MAX_FEE_PER_GAS as string, 9),
    });
    log(`Wallet address is ${wallet}, tx hash is ${txHash}`);
    return txHash;
  }
  log(`Wallet address is ${wallet} and has no minium balanace of 0.0004 ETH`);
  return undefined; // Explicitly return undefined if balance is not below minimum
};
