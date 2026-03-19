/*
  Warnings:

  - You are about to drop the column `createAT` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `fileName` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `matchCore` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `searchID` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the `SmartSearch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[email]` on the table `Candidate` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fileUrl]` on the table `Candidate` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `aiAnalysis` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `education` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileUrl` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `languages` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `optionalTechnicalSkills` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `positionId` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `softSkills` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `technicalSkills` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `yearsOfExperience` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Candidate` DROP FOREIGN KEY `Candidate_searchID_fkey`;

-- DropIndex
DROP INDEX `Candidate_searchID_fkey` ON `Candidate`;

-- AlterTable
ALTER TABLE `Candidate` DROP COLUMN `createAT`,
    DROP COLUMN `fileName`,
    DROP COLUMN `matchCore`,
    DROP COLUMN `searchID`,
    ADD COLUMN `aiAnalysis` JSON NOT NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `description` VARCHAR(191) NOT NULL,
    ADD COLUMN `education` VARCHAR(191) NOT NULL,
    ADD COLUMN `fileUrl` VARCHAR(191) NOT NULL,
    ADD COLUMN `languages` VARCHAR(191) NOT NULL,
    ADD COLUMN `optionalTechnicalSkills` VARCHAR(191) NOT NULL,
    ADD COLUMN `positionId` INTEGER NOT NULL,
    ADD COLUMN `role` VARCHAR(191) NOT NULL,
    ADD COLUMN `softSkills` VARCHAR(191) NOT NULL,
    ADD COLUMN `technicalSkills` VARCHAR(191) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `userId` INTEGER NOT NULL,
    ADD COLUMN `yearsOfExperience` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- DropTable
DROP TABLE `SmartSearch`;

-- DropTable
DROP TABLE `user`;

-- CreateTable
CREATE TABLE `Position` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role` VARCHAR(191) NOT NULL,
    `yearsOfExperience` INTEGER NOT NULL,
    `technicalSkills` VARCHAR(191) NOT NULL,
    `optionalTechnicalSkills` VARCHAR(191) NOT NULL,
    `softSkills` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `education` VARCHAR(191) NOT NULL,
    `languages` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vacancy` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `openDate` DATETIME(3) NOT NULL,
    `closeDate` DATETIME(3) NOT NULL,
    `positionId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MatchResult` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `matchScore` INTEGER NOT NULL,
    `candidateId` INTEGER NOT NULL,
    `vacancyId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MatchResult_candidateId_vacancyId_key`(`candidateId`, `vacancyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Candidate_email_key` ON `Candidate`(`email`);

-- CreateIndex
CREATE UNIQUE INDEX `Candidate_fileUrl_key` ON `Candidate`(`fileUrl`);

-- AddForeignKey
ALTER TABLE `Position` ADD CONSTRAINT `Position_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Candidate` ADD CONSTRAINT `Candidate_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Candidate` ADD CONSTRAINT `Candidate_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `Position`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vacancy` ADD CONSTRAINT `Vacancy_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `Position`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MatchResult` ADD CONSTRAINT `MatchResult_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MatchResult` ADD CONSTRAINT `MatchResult_vacancyId_fkey` FOREIGN KEY (`vacancyId`) REFERENCES `Vacancy`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
