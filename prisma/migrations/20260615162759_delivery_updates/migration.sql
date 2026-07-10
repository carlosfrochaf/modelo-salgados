/*
  Warnings:

  - You are about to drop the column `tableNumber` on the `Order` table. All the data in the column will be lost.
  - Added the required column `deliveryType` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerName" TEXT NOT NULL,
    "deliveryType" TEXT NOT NULL,
    "deliveryAddress" TEXT,
    "deliveryFee" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "total" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Order" ("createdAt", "customerName", "id", "status", "total", "updatedAt") SELECT "createdAt", "customerName", "id", "status", "total", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
