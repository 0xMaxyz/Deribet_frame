import { sql } from "@vercel/postgres";
import { log } from "./functions";

export const createTable = async function () {
  const result = await sql`
  CREATE TABLE IF NOT EXISTS Allocations (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    wallet_address varchar(42) NOT NULL,
    fid TEXT NOT NULL,
    amount_redeemed TEXT NOT NULL,
    tx_hash varchar(66) NOT NULL,
    token_address varchar(42) NOT NULL
  );
  `;
  log(result);
};

const getLatestRowForAUser = async function (_fid: number, _wallet: string) {
  return await sql`
      SELECT *
      FROM Allocations
      WHERE fid = ${_fid} OR wallet_address = ${_wallet}
      ORDER BY timestamp DESC
      LIMIT 1
    `;
};

export const getLatestTxTimestampForAUser = async function (
  _fid: number,
  _wallet: string
) {
  const resp = await sql`
  SELECT timestamp
  FROM Allocations
  WHERE fid = '${_fid}' OR wallet_address = '${_wallet}'
  ORDER BY timestamp DESC
  LIMIT 1;
`;
  return (resp.rows[0]?.timestamp as number) ?? 0;
};

export const getLatestTxHashForAUser = async function (
  _fid: number,
  _wallet: string
) {
  const resp = await sql`
  SELECT tx_hash
  FROM Allocations
  WHERE fid = ${_fid} OR wallet_address = ${_wallet}
  ORDER BY timestamp DESC
  LIMIT 1
`;
  return (resp.rows[0]?.tx_hash as string) ?? "";
};

export const setClaimTimestamp = async function (
  _fid: number,
  _wallet: string,
  _timestamp: string,
  _tokenAddress: string,
  _amount: string,
  _tx_hash: string
) {
  log(
    "insert in db: ",
    `('${_timestamp}', '${_wallet}', '${_fid}', '${_amount}', '${_tx_hash}', '${_tokenAddress}')`
  );
  const result = await sql`
    INSERT INTO Allocations (timestamp, wallet_address, fid, amount_redeemed, tx_hash, token_address)
    VALUES ('${_timestamp}', '${_wallet}', '${_fid}', '${_amount}', '${_tx_hash}', '${_tokenAddress}');
  `;

  log("Inserted Data: ", result);
};
