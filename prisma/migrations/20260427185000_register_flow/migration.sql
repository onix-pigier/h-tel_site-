-- AlterTable
ALTER TABLE `chambres` ADD COLUMN `categorie` ENUM('standard', 'villa_1ch', 'villa_2ch') NOT NULL DEFAULT 'standard';

-- AlterTable
ALTER TABLE `reservations` ADD COLUMN `age` INTEGER NULL,
    ADD COLUMN `birth_date` DATE NULL,
    ADD COLUMN `client_id` VARCHAR(191) NULL,
    ADD COLUMN `custom_offer_label` VARCHAR(191) NULL,
    ADD COLUMN `document_number` VARCHAR(191) NULL,
    ADD COLUMN `document_type` ENUM('cni', 'passport', 'titre_sejour', 'autre') NULL,
    ADD COLUMN `offer` ENUM('nuitee', 'forfait', 'passage', 'villa_1ch', 'villa_2ch', 'longue_duree', 'personnalise') NULL,
    ADD COLUMN `reference` VARCHAR(191) NULL,
    ADD COLUMN `source` ENUM('web', 'presence') NOT NULL DEFAULT 'web',
    MODIFY `status` ENUM('en_attente', 'validee', 'convertie', 'acceptee', 'refusee', 'annulee') NOT NULL DEFAULT 'en_attente';

-- Backfill existing reservation references
UPDATE `reservations`
SET `reference` = CONCAT('LEGACY-', SUBSTRING(`id`, 1, 8))
WHERE `reference` IS NULL;

-- CreateTable
CREATE TABLE `clients` (
    `id` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `document_number` VARCHAR(191) NULL,
    `document_type` ENUM('cni', 'passport', 'titre_sejour', 'autre') NULL,
    `birth_date` DATE NULL,
    `age` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `clients_email_idx`(`email`),
    INDEX `clients_phone_idx`(`phone`),
    INDEX `clients_document_number_idx`(`document_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sejours` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `chambre_id` VARCHAR(191) NOT NULL,
    `reservation_id` VARCHAR(191) NULL,
    `source` ENUM('web', 'presence') NOT NULL DEFAULT 'presence',
    `status` ENUM('planifie', 'en_cours', 'termine', 'annule') NOT NULL DEFAULT 'en_cours',
    `offer` ENUM('nuitee', 'forfait', 'passage', 'villa_1ch', 'villa_2ch', 'longue_duree', 'personnalise') NOT NULL,
    `custom_offer_label` VARCHAR(191) NULL,
    `started_at` DATETIME(3) NOT NULL,
    `ended_at` DATETIME(3) NOT NULL,
    `current_end_at` DATETIME(3) NOT NULL,
    `base_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `discount_type` ENUM('none', 'percent', 'fixed') NOT NULL DEFAULT 'none',
    `discount_value` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `net_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `amount_paid` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `balance_due` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `payment_arrangement` ENUM('immediat', 'avance_partielle', 'fin_sejour') NOT NULL DEFAULT 'fin_sejour',
    `payment_status` ENUM('solde', 'avance_versee', 'en_attente_paiement', 'solde_en_cours') NOT NULL DEFAULT 'en_attente_paiement',
    `notes` TEXT NULL,
    `checked_in_at` DATETIME(3) NULL,
    `checked_out_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sejours_code_key`(`code`),
    UNIQUE INDEX `sejours_reservation_id_key`(`reservation_id`),
    INDEX `sejours_chambre_id_status_started_at_current_end_at_idx`(`chambre_id`, `status`, `started_at`, `current_end_at`),
    INDEX `sejours_client_id_status_idx`(`client_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sejour_extensions` (
    `id` VARCHAR(191) NOT NULL,
    `stay_id` VARCHAR(191) NOT NULL,
    `started_at` DATETIME(3) NOT NULL,
    `ended_at` DATETIME(3) NOT NULL,
    `offer` ENUM('nuitee', 'forfait', 'passage', 'villa_1ch', 'villa_2ch', 'longue_duree', 'personnalise') NOT NULL,
    `custom_offer_label` VARCHAR(191) NULL,
    `base_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `discount_type` ENUM('none', 'percent', 'fixed') NOT NULL DEFAULT 'none',
    `discount_value` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `net_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `amount_paid` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `balance_due` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `payment_status` ENUM('solde', 'avance_versee', 'en_attente_paiement', 'solde_en_cours') NOT NULL DEFAULT 'en_attente_paiement',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sejour_extensions_stay_id_started_at_ended_at_idx`(`stay_id`, `started_at`, `ended_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `stay_id` VARCHAR(191) NOT NULL,
    `extension_id` VARCHAR(191) NULL,
    `paid_at` DATETIME(3) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `method` ENUM('especes', 'mobile_money', 'carte', 'virement', 'autre') NOT NULL,
    `type` ENUM('acompte', 'partiel', 'solde') NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payments_stay_id_paid_at_idx`(`stay_id`, `paid_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_notes` (
    `id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NOT NULL,
    `stay_id` VARCHAR(191) NULL,
    `moment` ENUM('avant', 'apres') NOT NULL,
    `rating` INTEGER NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `client_notes_client_id_moment_idx`(`client_id`, `moment`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `reservations_reference_key` ON `reservations`(`reference`);

-- CreateIndex
CREATE INDEX `reservations_status_date_arrivee_date_depart_idx` ON `reservations`(`status`, `date_arrivee`, `date_depart`);

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sejours` ADD CONSTRAINT `sejours_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sejours` ADD CONSTRAINT `sejours_chambre_id_fkey` FOREIGN KEY (`chambre_id`) REFERENCES `chambres`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sejours` ADD CONSTRAINT `sejours_reservation_id_fkey` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sejour_extensions` ADD CONSTRAINT `sejour_extensions_stay_id_fkey` FOREIGN KEY (`stay_id`) REFERENCES `sejours`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_stay_id_fkey` FOREIGN KEY (`stay_id`) REFERENCES `sejours`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_extension_id_fkey` FOREIGN KEY (`extension_id`) REFERENCES `sejour_extensions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_notes` ADD CONSTRAINT `client_notes_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_notes` ADD CONSTRAINT `client_notes_stay_id_fkey` FOREIGN KEY (`stay_id`) REFERENCES `sejours`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

