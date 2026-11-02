CREATE TABLE `coupons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`value` real NOT NULL,
	`min_subtotal` real,
	`max_uses` integer,
	`once_per_customer` integer DEFAULT false NOT NULL,
	`starts_on` text,
	`ends_on` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);--> statement-breakpoint
CREATE TABLE `product_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_reviews_once_idx` ON `product_reviews` (`product_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `product_reviews_status_idx` ON `product_reviews` (`status`);--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_gateway` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `gateway_transaction_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `coupon_code` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `stock_reserved` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `stock` integer;