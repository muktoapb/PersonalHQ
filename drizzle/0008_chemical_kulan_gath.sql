CREATE TABLE `tracker_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`tracker_id` text NOT NULL,
	`date` text NOT NULL,
	`value` real NOT NULL,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`tracker_id`) REFERENCES `trackers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tracker_entries_tracker_date` ON `tracker_entries` (`tracker_id`,`date`);--> statement-breakpoint
CREATE TABLE `trackers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT 'star' NOT NULL,
	`color` text DEFAULT '#7262ea' NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`mode` text DEFAULT 'latest' NOT NULL,
	`period` text DEFAULT 'all' NOT NULL,
	`start` real,
	`target` real,
	`target_date` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
