-- DropIndex
DROP INDEX `reservations_workflow_kind_status_date_arrivee_idx` ON `reservations`;

-- DropIndex
DROP INDEX `sejours_workflow_kind_status_started_at_idx` ON `sejours`;

-- AlterTable
ALTER TABLE `reservations` ADD COLUMN `requested_advance_amount` DECIMAL(12, 2) NULL,
    ADD COLUMN `requested_advance_note` TEXT NULL;
