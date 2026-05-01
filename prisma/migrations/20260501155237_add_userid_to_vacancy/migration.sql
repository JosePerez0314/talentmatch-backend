/*
  Warnings:

  - Added the required column `userId` to the `Vacancy` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Vacancy` ADD COLUMN `userId` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `Candidate_userId_createdAt_idx` ON `Candidate`(`userId`, `createdAt`);

-- CreateIndex
CREATE INDEX `MatchResult_candidateId_idx` ON `MatchResult`(`candidateId`);

-- CreateIndex
CREATE INDEX `Position_userId_createdAt_idx` ON `Position`(`userId`, `createdAt`);

-- CreateIndex
CREATE INDEX `Vacancy_userId_status_idx` ON `Vacancy`(`userId`, `status`);

-- CreateIndex
CREATE INDEX `Vacancy_status_idx` ON `Vacancy`(`status`);

-- RenameIndex
ALTER TABLE `Candidate` RENAME INDEX `Candidate_positionId_fkey` TO `Candidate_positionId_idx`;

-- RenameIndex
ALTER TABLE `MatchResult` RENAME INDEX `MatchResult_vacancyId_fkey` TO `MatchResult_vacancyId_idx`;

-- RenameIndex
ALTER TABLE `Vacancy` RENAME INDEX `Vacancy_positionId_fkey` TO `Vacancy_positionId_idx`;
