-- CreateTable
CREATE TABLE `SmartSearch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rol` VARCHAR(191) NOT NULL,
    `yearsExperience` INTEGER NOT NULL,
    `hardSkills` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Candidate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fullName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `matchCore` INTEGER NOT NULL,
    `createAT` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `searchID` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Candidate` ADD CONSTRAINT `Candidate_searchID_fkey` FOREIGN KEY (`searchID`) REFERENCES `SmartSearch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
