ALTER TABLE `user_roles`
    MODIFY `role` ENUM('admin', 'manager', 'user', 'gerant') NOT NULL;

UPDATE `user_roles`
SET `role` = 'gerant'
WHERE `role` IN ('manager', 'user');

ALTER TABLE `user_roles`
    MODIFY `role` ENUM('admin', 'gerant') NOT NULL;

ALTER TABLE `reservations`
    MODIFY `status` ENUM('en_attente', 'validee', 'convertie', 'acceptee', 'refusee', 'annulee', 'reportee', 'confirmee') NOT NULL DEFAULT 'en_attente';

UPDATE `reservations`
SET `status` = 'confirmee'
WHERE `status` IN ('validee', 'acceptee');

ALTER TABLE `reservations`
    MODIFY `status` ENUM('en_attente', 'confirmee', 'convertie', 'refusee', 'annulee', 'reportee') NOT NULL DEFAULT 'en_attente',
    ADD COLUMN `nationality` VARCHAR(100) NULL AFTER `phone`,
    ADD COLUMN `gender` ENUM('homme', 'femme', 'autre') NULL AFTER `nationality`,
    ADD COLUMN `guest_count` INTEGER NULL AFTER `gender`;

ALTER TABLE `clients`
    ADD COLUMN `nationality` VARCHAR(100) NULL AFTER `phone`,
    ADD COLUMN `gender` ENUM('homme', 'femme', 'autre') NULL AFTER `nationality`;

ALTER TABLE `sejours`
    ADD COLUMN `guest_count` INTEGER NULL AFTER `offer`;

ALTER TABLE `chambres`
    MODIFY `status` ENUM('disponible', 'occupee', 'attente_nettoyage', 'maintenance') NOT NULL DEFAULT 'disponible';
