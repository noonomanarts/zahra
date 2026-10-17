ALTER TABLE `categories` ADD `name_ar` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `display_currency` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `display_rate` real;--> statement-breakpoint
ALTER TABLE `orders` ADD `locale` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `title_ar` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `pages` ADD `description_ar` text;--> statement-breakpoint
ALTER TABLE `products` ADD `name_ar` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `description_ar` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tags` ADD `name_ar` text DEFAULT '' NOT NULL;