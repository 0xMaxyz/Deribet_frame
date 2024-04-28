import dotenv from "dotenv";
import {
  parseUnits,
  createWalletClient,
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

export const transferToken = async function (
  wallet: Address
): Promise<`0x${string}`> {
  const tokenAddress =
    isTesting === "true"
      ? (process.env.TEST_TOKEN_ADDRESS as `0x${string}`)
      : (process.env.TOKEN_ADDRESS as `0x${string}`);

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
};
