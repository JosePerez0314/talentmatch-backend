-- DropForeignKey
ALTER TABLE `Application` DROP FOREIGN KEY `Application_candidateId_fkey`;

-- DropForeignKey
ALTER TABLE `Application` DROP FOREIGN KEY `Application_vacancyId_fkey`;

-- DropIndex
DROP INDEX `Candidate_hash_key` ON `Candidate`;

-- CreateIndex
CREATE UNIQUE INDEX `Candidate_userId_hash_key` ON `Candidate`(`userId`, `hash`);

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_vacancyId_fkey` FOREIGN KEY (`vacancyId`) REFERENCES `Vacancy`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
