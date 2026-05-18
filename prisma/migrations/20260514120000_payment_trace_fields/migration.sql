ALTER TABLE `payments`
  ADD COLUMN `operator` VARCHAR(80) NULL,
  ADD COLUMN `payer_phone` VARCHAR(30) NULL,
  ADD COLUMN `transaction_reference` VARCHAR(120) NULL;

CREATE INDEX `payments_transaction_reference_idx` ON `payments`(`transaction_reference`);
