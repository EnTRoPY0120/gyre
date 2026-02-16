CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reconciliation_history` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_type` text NOT NULL,
	`namespace` text NOT NULL,
	`name` text NOT NULL,
	`cluster_id` text DEFAULT 'in-cluster' NOT NULL,
	`revision` text,
	`previous_revision` text,
	`status` text NOT NULL,
	`ready_status` text,
	`ready_reason` text,
	`ready_message` text,
	`reconcile_started_at` integer,
	`reconcile_completed_at` integer NOT NULL,
	`duration_ms` integer,
	`spec_snapshot` text,
	`metadata_snapshot` text,
	`trigger_type` text DEFAULT 'automatic' NOT NULL,
	`triggered_by_user` text,
	`error_message` text,
	`stalled_reason` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`triggered_by_user`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_resource_lookup` ON `reconciliation_history` (`resource_type`,`namespace`,`name`,`cluster_id`);--> statement-breakpoint
CREATE INDEX `idx_cluster_time` ON `reconciliation_history` (`cluster_id`,`reconcile_completed_at`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `reconciliation_history` (`status`);
