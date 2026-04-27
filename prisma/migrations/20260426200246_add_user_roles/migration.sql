/*
  Warnings:

  - You are about to drop the column `aiAnalysis` on the `Candidate` table. All the data in the column will be lost.
  - You are about to alter the column `languages` on the `Candidate` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `optionalTechnicalSkills` on the `Candidate` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `softSkills` on the `Candidate` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `technicalSkills` on the `Candidate` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `technicalSkills` on the `Position` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `optionalTechnicalSkills` on the `Position` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `softSkills` on the `Position` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `languages` on the `Position` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - A unique constraint covering the columns `[hash]` on the table `Candidate` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `hash` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rawApiPayload` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `educationScore` to the `MatchResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `experienceScore` to the `MatchResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hardSkillsScore` to the `MatchResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `languagesScore` to the `MatchResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `normalizedCandidate` to the `MatchResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roleScore` to the `MatchResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `softSkillsScore` to the `MatchResult` table without a default value. This is not possible if the table is not empty.
  - Added the required column `summary` to the `MatchResult` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Candidate` DROP FOREIGN KEY `Candidate_positionId_fkey`;

-- DropIndex
DROP INDEX `Candidate_email_key` ON `Candidate`;

-- DropIndex
DROP INDEX `Candidate_fileUrl_key` ON `Candidate`;

-- DropIndex
DROP INDEX `Candidate_positionId_fkey` ON `Candidate`;

-- AlterTable
ALTER TABLE `Candidate` DROP COLUMN `aiAnalysis`,
    ADD COLUMN `hash` VARCHAR(191) NOT NULL,
    ADD COLUMN `rawApiPayload` JSON NOT NULL,
    MODIFY `fileUrl` VARCHAR(191) NULL,
    MODIFY `languages` JSON NOT NULL,
    MODIFY `optionalTechnicalSkills` JSON NOT NULL,
    MODIFY `positionId` INTEGER NULL,
    MODIFY `softSkills` JSON NOT NULL,
    MODIFY `technicalSkills` JSON NOT NULL;

-- AlterTable
ALTER TABLE `MatchResult` ADD COLUMN `educationScore` INTEGER NOT NULL,
    ADD COLUMN `experienceScore` INTEGER NOT NULL,
    ADD COLUMN `hardSkillsScore` INTEGER NOT NULL,
    ADD COLUMN `languagesScore` INTEGER NOT NULL,
    ADD COLUMN `normalizedCandidate` JSON NOT NULL,
    ADD COLUMN `redFlags` TEXT NULL,
    ADD COLUMN `roleScore` INTEGER NOT NULL,
    ADD COLUMN `softSkillsScore` INTEGER NOT NULL,
    ADD COLUMN `summary` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `Position` MODIFY `technicalSkills` JSON NOT NULL,
    MODIFY `optionalTechnicalSkills` JSON NOT NULL,
    MODIFY `softSkills` JSON NOT NULL,
    MODIFY `languages` JSON NOT NULL;

-- AlterTable
ALTER TABLE `Vacancy` ADD COLUMN `status` ENUM('OPEN', 'CONTACTING', 'FILLED') NOT NULL DEFAULT 'OPEN';

-- CreateIndex
CREATE UNIQUE INDEX `Candidate_hash_key` ON `Candidate`(`hash`);

-- AddForeignKey
ALTER TABLE `Candidate` ADD CONSTRAINT `Candidate_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `Position`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
