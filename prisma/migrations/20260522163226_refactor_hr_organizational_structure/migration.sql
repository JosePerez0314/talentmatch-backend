/*
  Warnings:

  - You are about to drop the column `education` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `positionId` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `education` on the `Position` table. All the data in the column will be lost.
  - You are about to drop the column `closeDate` on the `Vacancy` table. All the data in the column will be lost.
  - You are about to drop the column `openDate` on the `Vacancy` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `Vacancy` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(1))` to `Enum(EnumId(2))`.
  - Added the required column `educationArea` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `educationLevel` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vacancyId` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departmentId` to the `Position` table without a default value. This is not possible if the table is not empty.
  - Added the required column `educationArea` to the `Position` table without a default value. This is not possible if the table is not empty.
  - Added the required column `educationLevel` to the `Position` table without a default value. This is not possible if the table is not empty.
  - Added the required column `availableSlots` to the `Vacancy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departmentId` to the `Vacancy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endDate` to the `Vacancy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `Vacancy` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Candidate` DROP FOREIGN KEY `Candidate_positionId_fkey`;

-- DropForeignKey
ALTER TABLE `MatchResult` DROP FOREIGN KEY `MatchResult_vacancyId_fkey`;

-- DropIndex
DROP INDEX `Candidate_positionId_idx` ON `Candidate`;

-- AlterTable
ALTER TABLE `Candidate` DROP COLUMN `education`,
    DROP COLUMN `positionId`,
    ADD COLUMN `educationArea` VARCHAR(191) NOT NULL,
    ADD COLUMN `educationLevel` ENUM('NONE', 'HIGH_SCHOOL', 'BACHELOR', 'MASTER', 'DOCTORATE') NOT NULL,
    ADD COLUMN `vacancyId` INTEGER NOT NULL,
    MODIFY `description` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `Position` DROP COLUMN `education`,
    ADD COLUMN `departmentId` INTEGER NOT NULL,
    ADD COLUMN `educationArea` VARCHAR(191) NOT NULL,
    ADD COLUMN `educationLevel` ENUM('NONE', 'HIGH_SCHOOL', 'BACHELOR', 'MASTER', 'DOCTORATE') NOT NULL,
    ADD COLUMN `positionPdfUrl` VARCHAR(191) NULL,
    MODIFY `description` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `Vacancy` DROP COLUMN `closeDate`,
    DROP COLUMN `openDate`,
    ADD COLUMN `availableSlots` INTEGER NOT NULL,
    ADD COLUMN `departmentId` INTEGER NOT NULL,
    ADD COLUMN `endDate` DATETIME(3) NOT NULL,
    ADD COLUMN `startDate` DATETIME(3) NOT NULL,
    MODIFY `status` ENUM('ACTIVE', 'PAUSED', 'CLOSED') NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE `Department` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Department_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Candidate_vacancyId_idx` ON `Candidate`(`vacancyId`);

-- CreateIndex
CREATE INDEX `Position_departmentId_idx` ON `Position`(`departmentId`);

-- CreateIndex
CREATE INDEX `Vacancy_departmentId_idx` ON `Vacancy`(`departmentId`);

-- AddForeignKey
ALTER TABLE `Department` ADD CONSTRAINT `Department_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Position` ADD CONSTRAINT `Position_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vacancy` ADD CONSTRAINT `Vacancy_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Candidate` ADD CONSTRAINT `Candidate_vacancyId_fkey` FOREIGN KEY (`vacancyId`) REFERENCES `Vacancy`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MatchResult` ADD CONSTRAINT `MatchResult_vacancyId_fkey` FOREIGN KEY (`vacancyId`) REFERENCES `Vacancy`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
