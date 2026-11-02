CREATE TABLE `admin_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` integer,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` integer,
	`target_label` text,
	`details` text,
	`ip` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `admin_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `admin_audit_log_created_idx` ON `admin_audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `admin_audit_log_actor_idx` ON `admin_audit_log` (`actor_id`);--> statement-breakpoint
ALTER TABLE `admin_users` ADD `role` text DEFAULT 'viewer' NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_users` ADD `permissions` text;--> statement-breakpoint
ALTER TABLE `admin_users` ADD `active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_users` ADD `must_change_password` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_users` ADD `last_login_at` integer;--> statement-breakpoint
ALTER TABLE `admin_users` ADD `last_seen_at` integer;--> statement-breakpoint
ALTER TABLE `admin_users` ADD `password_changed_at` integer;--> statement-breakpoint
ALTER TABLE `customers` ADD `disabled_at` integer;--> statement-breakpoint
ALTER TABLE `customers` ADD `last_login_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `created_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `last_seen_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `ip` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `user_agent` text;--> statement-breakpoint
UPDATE `admin_users` SET `role` = 'owner';
