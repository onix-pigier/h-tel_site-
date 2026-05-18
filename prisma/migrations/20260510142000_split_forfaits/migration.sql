ALTER TABLE `reservations`
    MODIFY `offer` ENUM('nuitee', 'forfait', 'forfait_semaine', 'forfait_weekend', 'passage', 'villa_1ch', 'villa_2ch', 'longue_duree', 'personnalise') NULL;

UPDATE `reservations`
SET `offer` = CASE
    WHEN DAYOFWEEK(COALESCE(`date_arrivee`, `date_arrivee_original`, DATE(`created_at`))) IN (1, 6, 7) THEN 'forfait_weekend'
    ELSE 'forfait_semaine'
END
WHERE `offer` = 'forfait';

ALTER TABLE `reservations`
    MODIFY `offer` ENUM('nuitee', 'forfait_semaine', 'forfait_weekend', 'passage', 'villa_1ch', 'villa_2ch', 'longue_duree', 'personnalise') NULL;

ALTER TABLE `sejours`
    MODIFY `offer` ENUM('nuitee', 'forfait', 'forfait_semaine', 'forfait_weekend', 'passage', 'villa_1ch', 'villa_2ch', 'longue_duree', 'personnalise') NOT NULL;

UPDATE `sejours`
SET `offer` = CASE
    WHEN DAYOFWEEK(`started_at`) IN (1, 6, 7) THEN 'forfait_weekend'
    ELSE 'forfait_semaine'
END
WHERE `offer` = 'forfait';

ALTER TABLE `sejours`
    MODIFY `offer` ENUM('nuitee', 'forfait_semaine', 'forfait_weekend', 'passage', 'villa_1ch', 'villa_2ch', 'longue_duree', 'personnalise') NOT NULL;

ALTER TABLE `sejour_extensions`
    MODIFY `offer` ENUM('nuitee', 'forfait', 'forfait_semaine', 'forfait_weekend', 'passage', 'villa_1ch', 'villa_2ch', 'longue_duree', 'personnalise') NOT NULL;

UPDATE `sejour_extensions`
SET `offer` = CASE
    WHEN DAYOFWEEK(`started_at`) IN (1, 6, 7) THEN 'forfait_weekend'
    ELSE 'forfait_semaine'
END
WHERE `offer` = 'forfait';

ALTER TABLE `sejour_extensions`
    MODIFY `offer` ENUM('nuitee', 'forfait_semaine', 'forfait_weekend', 'passage', 'villa_1ch', 'villa_2ch', 'longue_duree', 'personnalise') NOT NULL;
