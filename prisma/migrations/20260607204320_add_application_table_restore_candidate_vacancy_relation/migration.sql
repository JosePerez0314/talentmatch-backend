/*
  Warnings:

  - Added the required column `vacancyId` to the `Candidate` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Candidate` ADD COLUMN `vacancyId` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `Candidate_vacancyId_idx` ON `Candidate`(`vacancyId`);

-- AddForeignKey
ALTER TABLE `Candidate` ADD CONSTRAINT `Candidate_vacancyId_fkey` FOREIGN KEY (`vacancyId`) REFERENCES `Vacancy`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
