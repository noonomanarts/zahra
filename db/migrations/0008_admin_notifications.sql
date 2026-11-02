CREATE TABLE `admin_notification_reads` (
	`notification_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	PRIMARY KEY(`notification_id`, `user_id`),
	FOREIGN KEY (`notification_id`) REFERENCES `admin_notifications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `admin_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`params` text NOT NULL,
	`href` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_notifications_kind_idx` ON `admin_notifications` (`kind`);--> statement-breakpoint
ALTER TABLE `admin_users` ADD `last_read_notification_id` integer DEFAULT 0 NOT NULL;