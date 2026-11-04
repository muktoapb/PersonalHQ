ALTER TABLE `notes` ADD `position` real DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Start from the old order: most recently edited first.
UPDATE `notes` SET `position` = (SELECT count(*) FROM `notes` n2 WHERE n2.`updated_at` > `notes`.`updated_at`);
