CREATE TABLE `login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `username` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `recovery_hash` text;