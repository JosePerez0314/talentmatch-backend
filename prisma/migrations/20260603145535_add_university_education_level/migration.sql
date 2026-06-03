/*
  Warnings:

  - A unique constraint covering the columns `[title,userId]` on the table `Department` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Candidate` MODIFY `educationLevel` ENUM('NONE', 'HIGH_SCHOOL', 'BACHELOR', 'TECHNICAL', 'UNIVERSITY', 'MASTER', 'DOCTORATE') NOT NULL;

-- AlterTable
ALTER TABLE `Position` MODIFY `educationLevel` ENUM('NONE', 'HIGH_SCHOOL', 'BACHELOR', 'TECHNICAL', 'UNIVERSITY', 'MASTER', 'DOCTORATE') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Department_title_userId_key` ON `Department`(`title`, `userId`);
