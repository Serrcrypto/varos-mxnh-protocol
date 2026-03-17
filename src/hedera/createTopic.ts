import { TopicCreateTransaction } from '@hashgraph/sdk';
import { client } from './client';

async function createHcsTopic() {
  console.log('⏳ Creando el Topic en Hedera Consensus Service para auditoría ISO 20022...');

  try {
    // 1. Construir y enviar la transacción
    const txResponse = await new TopicCreateTransaction()
      .setTopicMemo('Varos Protocol - Auditoria HCS e ISO 20022')
      .execute(client);

    // 2. Obtener el recibo de la red
    const receipt = await txResponse.getReceipt(client);
    const topicId = receipt.topicId;

    console.log(`\n🎉 ¡Topic creado con éxito!`);
    console.log(`📝 HCS Topic ID: ${topicId}`);
    console.log(`🔍 Verifica en Hashscan: https://hashscan.io/testnet/topic/${topicId}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando el Topic:', error);
    process.exit(1);
  }
}

createHcsTopic();
