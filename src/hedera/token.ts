import {
  TokenMintTransaction,
  TokenBurnTransaction,
  TokenGrantKycTransaction,
  AccountBalanceQuery,
  TransferTransaction,
  AccountId
} from '@hashgraph/sdk';
import { client, treasuryId, treasuryKey, complianceKey, tokenId } from './client';

/**
 * Acuña MXNH y opcionalmente lo transfiere a un usuario.
 */
export async function mintMXNH(amount: number, receiverAccountId?: string): Promise<string> {
  try {
    // Multiplicamos por 100 porque nuestro token tiene 2 decimales
    const amountInSmallestUnit = Math.round(amount * 100);

    // 1. Acuñar en la cuenta de Tesorería
    const mintTx = await new TokenMintTransaction()
      .setTokenId(tokenId)
      .setAmount(amountInSmallestUnit)
      .freezeWith(client);

    const signTx = await mintTx.sign(treasuryKey);
    const txResponse = await signTx.execute(client);
    await txResponse.getReceipt(client);
    let finalTxId = txResponse.transactionId.toString();

    // 2. Si hay un receptor, transferir desde Tesorería al receptor
    if (receiverAccountId && receiverAccountId !== treasuryId.toString()) {
      const transferTx = await new TransferTransaction()
        .addTokenTransfer(tokenId, treasuryId, -amountInSmallestUnit)
        .addTokenTransfer(tokenId, AccountId.fromString(receiverAccountId), amountInSmallestUnit)
        .freezeWith(client);

      const transferSign = await transferTx.sign(treasuryKey);
      const transferResponse = await transferSign.execute(client);
      await transferResponse.getReceipt(client);
      finalTxId = transferResponse.transactionId.toString();
    }

    return finalTxId;
  } catch (error) {
    console.error('❌ Error en mintMXNH:', error);
    throw error;
  }
}

/**
 * Quema MXNH. Si se pasa un accountId distinto a la tesorería,
 * primero devuelve los fondos a tesorería y luego quema.
 */
export async function burnMXNH(amount: number, accountId?: string): Promise<string> {
  try {
    const amountInSmallestUnit = Math.round(amount * 100);
    let currentTxId = '';

    // Si el MXNH está en la cuenta de un usuario, lo regresamos a Tesorería primero
    if (accountId && accountId !== treasuryId.toString()) {
      const returnTx = await new TransferTransaction()
        .addTokenTransfer(tokenId, AccountId.fromString(accountId), -amountInSmallestUnit)
        .addTokenTransfer(tokenId, treasuryId, amountInSmallestUnit)
        .execute(client); // Asume que el usuario firmó o el operador paga
      await returnTx.getReceipt(client);
      currentTxId = returnTx.transactionId.toString();
    }

    // Quemar desde la Tesorería
    const burnTx = await new TokenBurnTransaction()
      .setTokenId(tokenId)
      .setAmount(amountInSmallestUnit)
      .freezeWith(client);

    const signTx = await burnTx.sign(treasuryKey);
    const txResponse = await signTx.execute(client);
    await txResponse.getReceipt(client);
    
    return txResponse.transactionId.toString();
  } catch (error) {
    console.error('❌ Error en burnMXNH:', error);
    throw error;
  }
}

/**
 * Otorga KYC a una cuenta para que pueda recibir MXNH
 */
export async function enableKYC(accountId: string): Promise<string> {
  try {
    const kycTx = await new TokenGrantKycTransaction()
      .setTokenId(tokenId)
      .setAccountId(AccountId.fromString(accountId))
      .freezeWith(client);

    const signTx = await kycTx.sign(complianceKey);
    const txResponse = await signTx.execute(client);
    await txResponse.getReceipt(client);

    return txResponse.transactionId.toString();
  } catch (error) {
    console.error('❌ Error en enableKYC:', error);
    throw error;
  }
}

/**
 * Consulta el balance de MXNH de una cuenta
 */
export async function getBalance(accountId: string): Promise<number> {
  try {
    const balanceQuery = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(accountId))
      .execute(client);

    const tokenBalance = balanceQuery.tokens?.get(tokenId) || 0;
    // Dividimos entre 100 para devolver el formato legible
    return Number(tokenBalance) / 100;
  } catch (error) {
    console.error('❌ Error en getBalance:', error);
    throw error;
  }
}
