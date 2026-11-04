CREATE TABLE `oauth_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`redirect_uris` text NOT NULL,
	`secret_hash` text,
	`approved_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_codes` (
	`hash` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`challenge` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`access_hash` text NOT NULL,
	`access_expires_at` integer NOT NULL,
	`refresh_hash` text NOT NULL,
	`refresh_expires_at` integer NOT NULL,
	`last_used_at` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_tokens_access_hash_unique` ON `oauth_tokens` (`access_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_tokens_refresh_hash_unique` ON `oauth_tokens` (`refresh_hash`);