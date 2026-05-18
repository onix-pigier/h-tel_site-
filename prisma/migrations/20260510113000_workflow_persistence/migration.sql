ALTER TABLE `reservations`
    ADD COLUMN `workflow_kind` ENUM('web', 'direct', 'comptoir', 'appel') NOT NULL DEFAULT 'web' AFTER `source`,
    ADD COLUMN `date_depart_original` DATE NULL AFTER `date_arrivee_original`;

UPDATE `reservations`
SET `workflow_kind` = CASE
        WHEN `source` = 'web' THEN 'web'
        ELSE 'comptoir'
    END,
    `date_arrivee_original` = COALESCE(`date_arrivee_original`, `date_arrivee`),
    `date_depart_original` = COALESCE(`date_depart_original`, `date_depart`);

CREATE INDEX `reservations_workflow_kind_status_date_arrivee_idx`
    ON `reservations`(`workflow_kind`, `status`, `date_arrivee`);

ALTER TABLE `sejours`
    ADD COLUMN `workflow_kind` ENUM('web', 'direct', 'comptoir', 'appel') NOT NULL DEFAULT 'direct' AFTER `source`,
    ADD COLUMN `planned_start_at` DATETIME(3) NULL AFTER `custom_offer_label`,
    ADD COLUMN `planned_end_at` DATETIME(3) NULL AFTER `planned_start_at`,
    ADD COLUMN `planned_start_at_original` DATETIME(3) NULL AFTER `planned_end_at`,
    ADD COLUMN `planned_end_at_original` DATETIME(3) NULL AFTER `planned_start_at_original`;

UPDATE `sejours`
SET `workflow_kind` = CASE
        WHEN `code` LIKE 'SEJ_WEB_%' THEN 'web'
        WHEN `code` LIKE 'SEJ_CPT_%' THEN 'comptoir'
        WHEN `code` LIKE 'SEJ_APL_%' THEN 'appel'
        WHEN `code` LIKE 'SEJ_DIR_%' THEN 'direct'
        WHEN `source` = 'web' THEN 'web'
        ELSE 'direct'
    END,
    `planned_start_at` = COALESCE(`planned_start_at`, `started_at`),
    `planned_end_at` = COALESCE(`planned_end_at`, `current_end_at`),
    `planned_start_at_original` = COALESCE(`planned_start_at_original`, `planned_start_at`, `started_at`),
    `planned_end_at_original` = COALESCE(`planned_end_at_original`, `planned_end_at`, `current_end_at`);

CREATE INDEX `sejours_workflow_kind_status_started_at_idx`
    ON `sejours`(`workflow_kind`, `status`, `started_at`);

CREATE TABLE `discount_requests` (
    `id` VARCHAR(191) NOT NULL,
    `stay_id` VARCHAR(191) NOT NULL,
    `requested_by_id` VARCHAR(191) NOT NULL,
    `reviewed_by_id` VARCHAR(191) NULL,
    `status` ENUM('en_attente', 'approuvee', 'refusee', 'annulee') NOT NULL DEFAULT 'en_attente',
    `discount_type` ENUM('none', 'percent', 'fixed') NOT NULL,
    `discount_value` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `approved_discount_type` ENUM('none', 'percent', 'fixed') NULL,
    `approved_discount_value` DECIMAL(10, 2) NULL,
    `reason` TEXT NOT NULL,
    `review_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `reviewed_at` DATETIME(3) NULL,

    INDEX `discount_requests_stay_id_status_idx`(`stay_id`, `status`),
    INDEX `discount_requests_requested_by_id_status_idx`(`requested_by_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `discount_requests`
    ADD CONSTRAINT `discount_requests_stay_id_fkey` FOREIGN KEY (`stay_id`) REFERENCES `sejours`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `discount_requests_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `discount_requests_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `stay_deposits` (
    `id` VARCHAR(191) NOT NULL,
    `stay_id` VARCHAR(191) NOT NULL,
    `type` ENUM('caution_generale', 'caution_villa') NOT NULL DEFAULT 'caution_generale',
    `status` ENUM('en_attente', 'encaissee', 'restituee', 'conservee') NOT NULL DEFAULT 'en_attente',
    `expected_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `held_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `returned_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `method` ENUM('especes', 'mobile_money', 'carte', 'virement', 'autre') NULL,
    `notes` TEXT NULL,
    `held_at` DATETIME(3) NULL,
    `returned_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stay_deposits_stay_id_status_idx`(`stay_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `stay_deposits`
    ADD CONSTRAINT `stay_deposits_stay_id_fkey` FOREIGN KEY (`stay_id`) REFERENCES `sejours`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
