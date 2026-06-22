-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('TEXT', 'CHECKLIST', 'LINK', 'API_KEY', 'IMAGE', 'FILE');

-- AlterTable (Safe conversion of Column from VARCHAR/TEXT to Enum)
ALTER TABLE "Card" ALTER COLUMN "type" TYPE "CardType" USING ("type"::text::"CardType");

-- CreateIndex (Plain index creation, preferred for this table size)
CREATE INDEX "Card_userId_order_idx" ON "Card"("userId", "order");
CREATE INDEX "Card_categoryId_order_idx" ON "Card"("categoryId", "order");
CREATE INDEX "Category_userId_order_idx" ON "Category"("userId", "order");
