/*
  Warnings:

  - You are about to drop the column `vacancyId` on the `Candidate` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `Candidate` DROP FOREIGN KEY `Candidate_vacancyId_fkey`;

-- DropForeignKey
ALTER TABLE `Vacancy` DROP FOREIGN KEY `Vacancy_positionId_fkey`;

-- DropForeignKey
ALTER TABLE `Vacancy` DROP FOREIGN KEY `Vacancy_userId_fkey`;

-- DropIndex
DROP INDEX `Candidate_vacancyId_idx` ON `Candidate`;

-- DropIndex
DROP INDEX `Vacancy_status_idx` ON `Vacancy`;

-- AlterTable
ALTER TABLE `Candidate` DROP COLUMN `vacancyId`,
    ADD COLUMN `status` ENUM('DISPONIBLE', 'CONTRATADO') NOT NULL DEFAULT 'DISPONIBLE';

-- CreateTable
CREATE TABLE `Application` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` ENUM('PENDIENTE', 'EN_PROCESO', 'SELECCIONADO', 'RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
    `candidateId` INTEGER NOT NULL,
    `vacancyId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Application_vacancyId_status_idx`(`vacancyId`, `status`),
    INDEX `Application_candidateId_idx`(`candidateId`),
    UNIQUE INDEX `Application_candidateId_vacancyId_key`(`candidateId`, `vacancyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Candidate_status_idx` ON `Candidate`(`status`);

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_vacancyId_fkey` FOREIGN KEY (`vacancyId`) REFERENCES `Vacancy`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vacancy` ADD CONSTRAINT `Vacancy_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `Position`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vacancy` ADD CONSTRAINT `Vacancy_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
