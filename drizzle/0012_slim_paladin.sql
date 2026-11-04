CREATE TABLE `wallet_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`from_wallet_id` text,
	`to_wallet_id` text,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`note` text,
	`fee_transaction_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_transfers_from` ON `wallet_transfers` (`from_wallet_id`);--> statement-breakpoint
CREATE INDEX `idx_transfers_to` ON `wallet_transfers` (`to_wallet_id`);--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'bank' NOT NULL,
	`color` text DEFAULT '#7262ea' NOT NULL,
	`opening_balance` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `wallet_id` text;--> statement-breakpoint
CREATE INDEX `idx_transactions_wallet` ON `transactions` (`wallet_id`);