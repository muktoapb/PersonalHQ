CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`color` text DEFAULT '#6366f1' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`display_name` text,
	`currency` text DEFAULT 'USD' NOT NULL,
	`locale` text DEFAULT 'en-US' NOT NULL,
	`password_hash` text NOT NULL,
	`session_secret` text NOT NULL,
	`pin_hash` text,
	`manage_donation` integer DEFAULT true NOT NULL,
	`manage_investment` integer DEFAULT true NOT NULL,
	`donation_percent` real DEFAULT 2.5 NOT NULL,
	`investment_percent` real DEFAULT 5 NOT NULL,
	`mcp_token_hash` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`date` text NOT NULL,
	`amount` integer NOT NULL,
	`description` text,
	`category_id` text,
	`alloc_expense` integer DEFAULT 0 NOT NULL,
	`alloc_donation` integer DEFAULT 0 NOT NULL,
	`alloc_investment` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_kind_date` ON `transactions` (`kind`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`date`);