import dotenv from "dotenv";
import { createWalletClient, http, getContract, parseEther } from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { Address } from "viem";
import { abi } from "./abi";

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

const token = getContract({
  address:
    isTesting === "true"
      ? (process.env.TEST_TOKEN_ADDRESS as `0x${string}`)
      : (process.env.TOKEN_ADDRESS as `0x${string}`),
  abi,
  client,
});

export const transferToken = async function (
  wallet: Address
): Promise<`0x${string}`> {
  return await token.write.transfer([
    wallet,
    parseEther(process.env.ALLOCATION_AMOUNT as string),
  ]);
};
