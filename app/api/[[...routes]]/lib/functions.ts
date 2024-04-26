import dotenv from "dotenv";
import { init, fetchQuery } from "@airstack/node";

dotenv.config();
init(process.env.AIRSTACK_API_KEY as string, "prod");

export const log = function (message?: any, ...optionalParams: any[]) {
  if ((process.env.VERBOSE as string) === "true") {
    console.log(message, ...optionalParams);
  }
};

export const checkIsFollowingFrameCaster = async function (
  _fid: number
): Promise<Boolean> {
  const query = `query {
        SocialFollowers(
          input: {filter: {dappName: {_eq: farcaster}, followerProfileId: {_eq: "${_fid}"}, followingProfileId: {_eq: "${
    process.env.FID as string
  }"}}, blockchain: ALL}
        ) {
          Follower {
            followerProfileId
          }
        }
      }`;
  log("checkIsFollowingFrameCaster Query: ", query);

  const { data, error } = await fetchQuery(query);

  if (error) {
    throw new Error(error);
  }
  if (data.SocialFollowers) {
    if (
      Array.isArray(data.SocialFollowers.Follower) &&
      data.SocialFollowers.Follower.length > 0
    ) {
      return true;
    }
    return false;
  } else {
    throw new Error("E1. Error retrieving data, please try again.");
  }
};

export const checkIfRecasted = async function (
  recaster_fid: number,
  cast_hash: string
): Promise<Boolean> {
  const server = process.env.AIRSTACK_HUB as string;
  const url = `${server}/reactionById?fid=${recaster_fid}&reaction_type=2&target_fid=${
    process.env.FID as string
  }&target_hash=${cast_hash}`;
  const headers = {
    "Content-Type": "application/json",
    "x-airstack-hubs": process.env.AIRSTACK_API_KEY as string,
  };
  log("Check recasted url:", url);
  const response = await fetch(url, {
    method: "GET",
    headers: headers,
  });
  return response.ok;
};

export const getWalletAddresses = async function (_fid: number) {
  const query = `query {
        Socials(
          input: {filter: {userId: {_eq: "${_fid}"}, dappName: {_eq: farcaster}}, blockchain: ethereum}
        ) {
          Social {
            userAssociatedAddresses
          }
        }
      }`;

  const { data, error } = await fetchQuery(query);

  if (error) {
    throw new Error(error);
  }

  if (
    data.Socials &&
    data.Socials.Social &&
    data.Socials.Social[0].userAssociatedAddresses
  ) {
    if (
      Array.isArray(data.Socials.Social[0].userAssociatedAddresses) &&
      data.Socials.Social[0].userAssociatedAddresses.length >= 1
    ) {
      return (
        data.Socials.Social[0].userAssociatedAddresses as Array<string>
      ).slice(1);
    } else {
      throw new Error(`E2. No wallet found for fid = ${_fid}`);
    }
  } else {
    throw new Error(`E3. User not found (fid = ${_fid}).`);
  }
};

export const isToday = function (lastClaimTimestamp: number): Boolean {
  const today = new Date();
  const timestampDate = new Date(lastClaimTimestamp * 1000);

  return (
    timestampDate.getDate() === today.getDate() &&
    timestampDate.getMonth() === today.getMonth() &&
    timestampDate.getFullYear() === today.getFullYear()
  );
};

export const getTxhashOnExplorer = function (txHash: string): string {
  let addr =
    (process.env.TESTING as string) === "true"
      ? (process.env.BASE_SEPOLIA_EXPLORER as string)
      : (process.env.BASE_MAINNET_EXPLORER as string);

  if (!addr.endsWith("/")) {
    addr += "/";
  }
  return addr + `tx/${txHash}`;
};
