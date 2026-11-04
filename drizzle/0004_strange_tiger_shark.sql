DROP TABLE `task_lists`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`parent_id` text,
	`title` text NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`due` text,
	`due_time` text,
	`remind_offset` integer,
	`remind_at` text,
	`reminded_at` text,
	`completed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`group_id`) REFERENCES `task_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "group_id", "parent_id", "title", "status", "due", "due_time", "remind_offset", "remind_at", "reminded_at", "completed_at", "created_at", "updated_at") SELECT "id", "group_id", "parent_id", "title", "status", "due", "due_time", "remind_offset", "remind_at", "reminded_at", "completed_at", "created_at", "updated_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_tasks_group` ON `tasks` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_parent` ON `tasks` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_due` ON `tasks` (`due`);--> statement-breakpoint
CREATE INDEX `idx_tasks_remind` ON `tasks` (`remind_at`);