CREATE TABLE `customer_password_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customer_password_resets_customer_idx` ON `customer_password_resets` (`customer_id`);