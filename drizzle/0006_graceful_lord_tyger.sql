CREATE TABLE `task_columns` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `task_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_columns_group` ON `task_columns` (`group_id`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `column_id` text;--> statement-breakpoint
-- Every existing group gets the classic columns (UUID v4 ids, like the app makes).
INSERT INTO `task_columns` (`id`, `group_id`, `name`, `position`, `done`)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
       g.`id`, c.`name`, c.`position`, c.`done`
FROM `task_groups` g
CROSS JOIN (SELECT 'To do' AS `name`, 0 AS `position`, 0 AS `done` UNION ALL SELECT 'Doing', 1, 0 UNION ALL SELECT 'Done', 2, 1) c;--> statement-breakpoint
-- Tasks move to the column matching their old status; status becomes a done flag.
UPDATE `tasks` SET `column_id` = (
  SELECT c.`id` FROM `task_columns` c
  WHERE c.`group_id` = `tasks`.`group_id`
    AND c.`position` = CASE `tasks`.`status` WHEN 'doing' THEN 1 WHEN 'done' THEN 2 ELSE 0 END
) WHERE `parent_id` IS NULL;--> statement-breakpoint
UPDATE `tasks` SET `status` = 'todo' WHERE `status` = 'doing';
