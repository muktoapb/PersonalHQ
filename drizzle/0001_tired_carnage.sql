ALTER TABLE `settings` DROP COLUMN `donation_percent`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `investment_percent`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `alloc_expense`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `alloc_donation`;--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `alloc_investment`;