CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#7262ea' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_labels` (
	`task_id` text NOT NULL,
	`label_id` text NOT NULL,
	PRIMARY KEY(`task_id`, `label_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_labels_label` ON `task_labels` (`label_id`);--> statement-breakpoint
ALTER TABLE `task_groups` ADD `icon` text DEFAULT 'checklist' NOT NULL;--> statement-breakpoint
ALTER TABLE `task_groups` ADD `view` text DEFAULT 'list' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `group_id` text REFERENCES task_groups(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `parent_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `due_time` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `remind_offset` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `remind_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `reminded_at` text;--> statement-breakpoint
CREATE INDEX `idx_tasks_group` ON `tasks` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_parent` ON `tasks` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_remind` ON `tasks` (`remind_at`);--> statement-breakpoint
-- Lists are going away: each list becomes a group of its own (same id, name
-- and view; colour from its old group), and its tasks follow it.
INSERT INTO `task_groups` (`id`, `name`, `color`, `icon`, `view`, `created_at`)
SELECT l.`id`, l.`name`, g.`color`, 'checklist', l.`view`, l.`created_at`
FROM `task_lists` l JOIN `task_groups` g ON g.`id` = l.`group_id`;--> statement-breakpoint
UPDATE `tasks` SET `group_id` = `list_id`;
