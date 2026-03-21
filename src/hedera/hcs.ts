import { TopicMessageSubmitTransaction } from "@hashgraph/sdk";
import { randomUUID } from "crypto";
import { client } from "./client";

export interface Iso20022Message {
  MsgId?: string;
  CreDtTm?: string;
  MsgType: "MINT" | "BURN" | "TRANSFER" | "RESERVE_PROOF";
  InstdAmt: { value: number; currency: "MXN" };
  DbtrAcct: string | null;
  CdtrAcct: string | null;
  TxRef: string | null;
  PrtclFee: { value: number; collector: string } | null;
  // Campos extra para pruebas de reserva
  TotalMxnh?: number;
  TotalMxnReserve?: number;
  CollateralRatio?: string;
}

/**
 * Publica un mensaje JSON en HCS y devuelve el número de secuencia (Message ID)
 */
export async function logTransaction(data: Iso20022Message): Promise<string> {
  try {
    const topicId = process.env.HEDERA_HCS_TOPIC_ID;

    if (!topicId) {
      throw new Error("⚠️ Falta configurar HEDERA_HCS_TOPIC_ID en .env");
    }

    // Auto-completar estándares ISO si no se enviaron
    const payload = {
      MsgId: data.MsgId || randomUUID(),
      CreDtTm: data.CreDtTm || new Date().toISOString(),
      ...data,
    };

    const submitTx = await new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(JSON.stringify(payload))
      .execute(client);

    const receipt = await submitTx.getReceipt(client);
    const sequenceNumber = receipt.topicSequenceNumber!.toString();

    console.log(
      `📝 Log guardado en HCS [Seq: ${sequenceNumber}] - Tipo: ${data.MsgType}`,
    );

    return sequenceNumber;
  } catch (error) {
    console.error("❌ Error en logTransaction (HCS):", error);
    throw error;
  }
}
