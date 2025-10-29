/*
  Warnings:

  - You are about to drop the column `token` on the `Account` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Account" DROP COLUMN "token",
ADD COLUMN     "accessExpiresAt" TIMESTAMP(3),
ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';
