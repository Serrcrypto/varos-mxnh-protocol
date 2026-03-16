-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'MINTED', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "OffRampType" AS ENUM ('OXXO', 'SPEI');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('ACTIVE', 'REDEEMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "hederaAccountId" TEXT,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverPhone" TEXT NOT NULL,
    "amountUsd" DECIMAL(65,30) NOT NULL,
    "amountMxnh" DECIMAL(65,30) NOT NULL,
    "exchangeRate" DECIMAL(65,30) NOT NULL,
    "protocolFee" DECIMAL(65,30) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "hederaTxId" TEXT,
    "hcsMessageId" TEXT,
    "offRampType" "OffRampType" NOT NULL,
    "voucherCode" TEXT,
    "isoMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "status" "VoucherStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sdk_clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sdk_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserve_proofs" (
    "id" TEXT NOT NULL,
    "totalMxnhCirculating" DECIMAL(65,30) NOT NULL,
    "totalMxnReserve" DECIMAL(65,30) NOT NULL,
    "ratio" DECIMAL(65,30) NOT NULL,
    "hcsMessageId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reserve_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_hederaAccountId_key" ON "users"("hederaAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_hederaTxId_key" ON "transactions"("hederaTxId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_voucherCode_key" ON "transactions"("voucherCode");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_transactionId_key" ON "vouchers"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sdk_clients_apiKey_key" ON "sdk_clients"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "reserve_proofs_hcsMessageId_key" ON "reserve_proofs"("hcsMessageId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
