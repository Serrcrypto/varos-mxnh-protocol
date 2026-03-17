import { logTransaction } from './hcs';

/**
 * Publica un reporte periódico en la blockchain demostrando 
 * el respaldo 1:1 de los MXNH emitidos.
 */
export async function publishReserveProof(totalMxnh: number, totalMxnReserve: number): Promise<string> {
  try {
    // Calculamos el ratio. Si es 1.0000 o mayor, el protocolo está saludable.
    const ratio = totalMxnh > 0 ? (totalMxnReserve / totalMxnh).toFixed(4) : '1.0000';

    const hcsMessageId = await logTransaction({
      MsgType: 'RESERVE_PROOF',
      InstdAmt: { value: totalMxnReserve, currency: 'MXN' },
      DbtrAcct: null,
      CdtrAcct: null,
      TxRef: null,
      PrtclFee: null,
      TotalMxnh: totalMxnh,
      TotalMxnReserve: totalMxnReserve,
      CollateralRatio: ratio
    });

    console.log(`🛡️ Prueba de Reserva publicada con éxito. Ratio: ${ratio}`);
    return hcsMessageId;
  } catch (error) {
    console.error('❌ Error en publishReserveProof:', error);
    throw error;
  }
}
