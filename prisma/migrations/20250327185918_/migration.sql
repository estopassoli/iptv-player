/*
  Warnings:

  - You are about to drop the column `epg` on the `Channel` table. All the data in the column will be lost.
  - You are about to drop the column `channelCount` on the `Metadata` table. All the data in the column will be lost.
  - You are about to drop the column `seriesCount` on the `Metadata` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `Metadata` table. All the data in the column will be lost.
  - You are about to drop the column `query` on the `SearchCache` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `SearchCache` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,name]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,key]` on the table `Metadata` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,term,category]` on the table `SearchCache` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Channel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `key` to the `Metadata` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Metadata` table without a default value. This is not possible if the table is not empty.
  - Added the required column `value` to the `Metadata` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `SearchCache` table without a default value. This is not possible if the table is not empty.
  - Added the required column `term` to the `SearchCache` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Category_name_userId_key";

-- DropIndex
DROP INDEX "Channel_group_idx";

-- DropIndex
DROP INDEX "Metadata_userId_key";

-- DropIndex
DROP INDEX "SearchCache_query_userId_key";

-- DropIndex
DROP INDEX "SearchCache_timestamp_idx";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Channel" DROP COLUMN "epg",
ADD COLUMN     "categories" TEXT[],
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "group" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Metadata" DROP COLUMN "channelCount",
DROP COLUMN "seriesCount",
DROP COLUMN "timestamp",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "value" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SearchCache" DROP COLUMN "query",
DROP COLUMN "timestamp",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "term" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
ADD COLUMN     "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

-- CreateIndex
CREATE INDEX "Channel_name_idx" ON "Channel"("name");

-- CreateIndex
CREATE INDEX "Metadata_userId_idx" ON "Metadata"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Metadata_userId_key_key" ON "Metadata"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SearchCache_userId_term_category_key" ON "SearchCache"("userId", "term", "category");
