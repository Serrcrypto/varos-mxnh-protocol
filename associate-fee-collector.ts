import * as dotenv from "dotenv";
dotenv.config();

import {
  Client,
  AccountId,
  PrivateKey,
  TokenAssociateTransaction,
} from "@hashgraph/sdk";

async function main() {
  const client = Client.forTestnet();

  const feeCollectorId = process.env.HEDERA_FEE_COLLECTOR_ID!;
  const feeCollectorKey = process.env.HEDERA_FEE_COLLECTOR_KEY!;
  const tokenId = process.env.HEDERA_MXNH_TOKEN_ID!;

  console.log(
    `Asociando token ${tokenId} con Fee Collector ${feeCollectorId}...`,
  );

  client.setOperator(
    AccountId.fromString(feeCollectorId),
    PrivateKey.fromStringECDSA(feeCollectorKey),
  );

  const tx = await new TokenAssociateTransaction()
    .setAccountId(AccountId.fromString(feeCollectorId))
    .setTokenIds([tokenId])
    .execute(client);

  const receipt = await tx.getReceipt(client);
  console.log(`✅ Token asociado! Status: ${receipt.status}`);

  client.close();
}

main().catch(console.error);
