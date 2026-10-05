CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`target_id` text,
	`status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
