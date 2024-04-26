/** @jsxImportSource frog/jsx */

import { Button, FrameResponse, Frog, TextInput } from "frog";
import { devtools } from "frog/dev";
import { handle } from "frog/next";
import { serveStatic } from "frog/serve-static";
import dotenv from "dotenv";
import {
  createTable,
  getLatestTxHashForAUser,
  getLatestTxTimestampForAUser,
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
  isToday,
  log,
} from "./lib/functions";
import { transferToken } from "./lib/onchain";
import { logger } from "hono/logger";

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
  image: <img src="/frame-welcome.png" />,
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
  title: "Error",
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
    title: "Error",
  };
};

const dailyAllocationAvailableResponse: FrameResponse = {
  browserLocation: "/",
  image: <img src="/frame-daily-allocation-yes.png" />,
  intents: [<Button action="/claim">Claim</Button>],
  title: "Error",
};

const txSuccessfulResponse: FrameResponse = {
  browserLocation: "/",
  image: <img src="/frame-tx-succesfull.png" />,
  intents: [<Button.Link href="https://docs.deribet.io/">Info</Button.Link>],
  title: "Error",
};

///

app.frame("/", async (c) => {
  await createTable();
  return c.res(welcomeResponse);
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
      frameData?.fid as number
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
      if (lastTimestamp === 0 || !isToday(lastTimestamp)) {
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
  if (lastTimestamp === 0 || !isToday(lastTimestamp)) {
    // User can claim tokens now, send the amount to user's wallet
    const txHash = await transferToken(wallets[0] as `0x${string}`);
    if (txHash.length > 2) {
      // Successful transfer, update database
      setClaimTimestamp(
        frameData?.fid as number,
        wallets[0],
        new Date().toISOString(),
        isTesting === "true"
          ? (process.env.TEST_TOKEN_ADDRESS as string)
          : (process.env.TOKEN_ADDRESS as string),
        process.env.ALLOCATION_AMOUNT as string,
        txHash
      );

      response = txSuccessfulResponse;
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

  return c.res(response);
});

// app.frame("/", (c) => {
//   const { buttonValue, inputText, status } = c;
//   const fruit = inputText || buttonValue;
//   return c.res({
//     image: (
//       <div
//         style={{
//           alignItems: "center",
//           background:
//             status === "response"
//               ? "linear-gradient(to right, #432889, #17101F)"
//               : "black",
//           backgroundSize: "100% 100%",
//           display: "flex",
//           flexDirection: "column",
//           flexWrap: "nowrap",
//           height: "100%",
//           justifyContent: "center",
//           textAlign: "center",
//           width: "100%",
//         }}
//       >
//         <div
//           style={{
//             color: "white",
//             fontSize: 60,
//             fontStyle: "normal",
//             letterSpacing: "-0.025em",
//             lineHeight: 1.4,
//             marginTop: 30,
//             padding: "0 120px",
//             whiteSpace: "pre-wrap",
//           }}
//         >
//           {status === "response"
//             ? `Nice choice.${fruit ? ` ${fruit.toUpperCase()}!!` : ""}`
//             : "Welcome!"}
//         </div>
//       </div>
//     ),
//     intents: [
//       <TextInput placeholder="Enter custom fruit..." />,
//       <Button value="apples">Apples</Button>,
//       <Button value="oranges">Oranges</Button>,
//       <Button value="bananas">Bananas</Button>,
//       status === "response" && <Button.Reset>Reset</Button.Reset>,
//     ],
//   });
// });

devtools(app, { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
