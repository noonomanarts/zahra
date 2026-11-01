CREATE TABLE `finance_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `finance_entries_date_idx` ON `finance_entries` (`date`);--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`files` text DEFAULT '[]' NOT NULL,
	`estimate` real,
	`admin_notes` text DEFAULT '' NOT NULL,
	`customer_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_requests_number_unique` ON `service_requests` (`number`);--> statement-breakpoint
CREATE INDEX `service_requests_status_idx` ON `service_requests` (`status`);--> statement-breakpoint
CREATE TABLE `workshop_grants` (
	`customer_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`customer_id`, `product_id`),
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `order_items` ADD `unit_cost` real;--> statement-breakpoint
ALTER TABLE `orders` ADD `customer_id` integer REFERENCES customers(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`);--> statement-breakpoint
ALTER TABLE `products` ADD `kind` text DEFAULT 'product' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `unit_cost` real;--> statement-breakpoint
ALTER TABLE `products` ADD `workshop_videos` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `workshop_files` text DEFAULT '[]' NOT NULL;