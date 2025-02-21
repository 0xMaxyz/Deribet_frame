/** @jsxImportSource frog/jsx */

import { Button, FrameResponse, Frog } from "frog";
import { devtools } from "frog/dev";
import { handle } from "frog/next";
import { serveStatic } from "frog/serve-static";
import dotenv from "dotenv";
import {
  createTable,
  getLatestTxHashForAUser,
  getLatestTxTimestampForAUser,
  getNumberofTxToday,
  setClaimTimestamp,
} from "./lib/db";
import { pinata } from "frog/hubs";
import { vars } from "./lib/ui";

import {
  checkIfRecasted,
  checkIsFollowingFrameCasterAirstack,
  checkIsFollowingFrameCasterPinata,
  getTxhashOnExplorer,
  getWalletAddresses,
  getfilteredResultsOnExplorer,
  isToday,
  log,
} from "./lib/functions";
import { transferToken } from "./lib/onchain";

dotenv.config();

const isTesting = process.env.TESTING as string;

const app = new Frog({
  assetsPath: "/",
  basePath: "/api",
  browserLocation: "/",
  hub: pinata(),
  ui: { vars },
});

/// Responses

const noWalletResponse: FrameResponse = {
  browserLocation: "/",
  image: <img src="/frame-no-wallet.png" />,
  intents: [<Button action="/follow">Follow</Button>],
  title: "Deribet",
};

const notFollowingResponse: FrameResponse = {
  browserLocation: "/",
  image: <img src="/frame-no-follow.png" />,
  intents: [
    <Button.Link href={process.env.PROFILE as string}>Follow</Button.Link>,
    <Button action="/check">Check</Button>,
  ],
  title: "Deribet",
};

const welcomeResponse: FrameResponse = {
  image: <img src="/frame-welcome_test.png" />,
  intents: [
    <Button.Link href="https://docs.deribet.io/">Info</Button.Link>,
    <Button.Link href={process.env.PROFILE as string}>Follow</Button.Link>,
    <Button action="/check">Check</Button>,
  ],
  title: "Check",
};

const errorResponse: FrameResponse = {
  browserLocation: "/",
  image: <img src="/frame-error.png" />,
  intents: [<Button.Reset>Reset</Button.Reset>],
  title: "Nooo! What Happened!",
};

const noAllocationResponse = function (_txHash: string): FrameResponse {
  return {
    browserLocation: "/",
    image: <img src="/frame-daily-allocation-no.png" />,
    intents: [
      <Button.Link href={getTxhashOnExplorer(_txHash)}>
        Check on Explorer
      </Button.Link>,
    ],
    title: "Sorry!",
  };
};

const dailyAllocationAvailableResponse: FrameResponse = {
  browserLocation: "/",
  image: <img src="/frame-daily-allocation-yes.png" />,
  intents: [<Button action="/claim">Claim</Button>],
  title: "Check Tomorrow!",
};

const capacityLimitResponse: FrameResponse = {
  browserLocation: "/",
  image: <img src="/frame-capacity-reached.png" />,
  intents: [
    <Button.Link href={process.env.PROFILE as string}>Follow</Button.Link>,
  ],
  title: "You're In!",
};

const txSuccessfulResponse = function (
  wallet: string,
  token: string
): FrameResponse {
  return {
    browserLocation: "/",
    image: <img src="/frame-tx-succesfull.png" />,
    intents: [
      <Button.Link href={getfilteredResultsOnExplorer(wallet, token)}>
        Check on Explorer
      </Button.Link>,
    ],
    title: "Successful",
  };
};

///

app.frame("/", async (c) => {
  await createTable();
  // Check max claim per day
  const maxClaimToday = await getNumberofTxToday();
  if (maxClaimToday < Number(process.env.MAX_CLAIM_PER_DAY as string)) {
    return c.res(welcomeResponse);
  } else {
    return c.res(capacityLimitResponse);
  }
});

app.frame("/check", async (c) => {
  let response: FrameResponse = { image: "" };
  const { frameData } = c;
  let isFollowing: Boolean = false,
    isRecasted: Boolean = false,
    hasError: Boolean = false;

  // Show daily allocation available for frame caster
  if (
    frameData?.fid.toString() === (process.env.FID as string) ||
    frameData?.fid === 1
  ) {
    return c.res(dailyAllocationAvailableResponse);
  }

  try {
    // Check if the user follows the frame author
    isFollowing = await checkIsFollowingFrameCasterPinata(
      frameData?.fid as number,
      2000
    );

    // Check if the user recasted this frame
    isRecasted = await checkIfRecasted(
      frameData?.fid as number,
      frameData?.castId.hash as string
    );

    log("frameData", frameData);
    log(
      `Is ${frameData?.fid} recasted ${frameData?.castId.hash as string}`,
      isRecasted
    );
    log(
      `Is ${frameData?.fid} follows ${process.env.FID as string}: `,
      isFollowing
    );
  } catch (error) {
    hasError = true;
    log(error);
  }

  //

  if (!isRecasted || !isFollowing) {
    response = notFollowingResponse;
    // Next step (check for wallet and if the user received the tokens today)
  } else if (!hasError && isRecasted && isFollowing) {
    try {
      // Check if user has a wallet associated with this fid
      const wallets = await getWalletAddresses(frameData?.fid as number);
      if (wallets.length == 0) {
        // show no wallet frame
        response = noWalletResponse;
      }

      // check if the user claimed his share today
      const lastTimestamp = await getLatestTxTimestampForAUser(
        frameData?.fid as number,
        wallets[0]
      );
      if (!lastTimestamp || !isToday(new Date(lastTimestamp).getTime())) {
        // User can claim tokens now
        response = dailyAllocationAvailableResponse;
      } else {
        // user claimed his share today
        const tx_hash: string = await getLatestTxHashForAUser(
          frameData?.fid as number,
          wallets[0]
        );
        response = noAllocationResponse(tx_hash);
      }
    } catch (error) {
      hasError = true;
      log(error);
    }
  }

  // Check if there were any errors so far
  if (hasError) {
    response = errorResponse;
  }

  return c.res(response);
});

app.frame("/claim", async (c) => {
  const { frameData } = c;
  let response: FrameResponse = { image: "" };
  // Get wallet
  const wallets = await getWalletAddresses(frameData?.fid as number);
  // Check if user can claim token today
  const lastTimestamp = await getLatestTxTimestampForAUser(
    frameData?.fid as number,
    wallets[0]
  );
  // Check max claims for today
  const maxClaimToday = await getNumberofTxToday();

  if (maxClaimToday < Number(process.env.MAX_CLAIM_PER_DAY as string)) {
    if (!lastTimestamp || !isToday(new Date(lastTimestamp).getTime())) {
      // User can claim tokens now, send the amount to user's wallet
      const txHash = await transferToken(wallets[0] as `0x${string}`);
      if (txHash.length > 2) {
        const token =
          isTesting === "true"
            ? (process.env.TEST_TOKEN_ADDRESS as string)
            : (process.env.TOKEN_ADDRESS as string);
        // Successful transfer, update database
        setClaimTimestamp(
          frameData?.fid as number,
          wallets[0],
          new Date().toISOString(),
          token,
          process.env.ALLOCATION_AMOUNT as string,
          txHash
        );

        response = txSuccessfulResponse(wallets[0], token);
      } else {
        const tx_hash: string = await getLatestTxHashForAUser(
          frameData?.fid as number,
          wallets[0]
        );
        response = noAllocationResponse(tx_hash);
      }
    } else {
      // something went wrong
      response = errorResponse;
    }
  } else {
    response = capacityLimitResponse;
  }

  return c.res(response);
});

devtools(app, { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
