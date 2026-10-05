ALTER TABLE `decisions` ADD `action` text DEFAULT 'edit' NOT NULL;--> statement-breakpoint
ALTER TABLE `decisions` ADD `proposed_edit` text DEFAULT '{}' NOT NULL;