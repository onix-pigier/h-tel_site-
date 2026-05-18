DROP TABLE `attributions`;

ALTER TABLE `clients`
    DROP COLUMN `age`;

ALTER TABLE `reservations`
    DROP COLUMN `document_number`,
    DROP COLUMN `document_type`,
    DROP COLUMN `birth_date`,
    DROP COLUMN `age`;
