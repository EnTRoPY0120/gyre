CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`resource_type` text,
	`resource_name` text,
	`namespace` text,
	`cluster_id` text,
	`details` text,
	`success` integer DEFAULT true NOT NULL,
	`ip_address` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `auth_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`client_id` text NOT NULL,
	`client_secret_encrypted` text NOT NULL,
	`issuer_url` text,
	`authorization_url` text,
	`token_url` text,
	`user_info_url` text,
	`jwks_url` text,
	`auto_provision` integer DEFAULT true NOT NULL,
	`default_role` text DEFAULT 'viewer' NOT NULL,
	`role_mapping` text,
	`role_claim` text DEFAULT 'groups' NOT NULL,
	`username_claim` text DEFAULT 'preferred_username' NOT NULL,
	`email_claim` text DEFAULT 'email' NOT NULL,
	`use_pkce` integer DEFAULT true NOT NULL,
	`scopes` text DEFAULT 'openid profile email' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_providers_name_unique` ON `auth_providers` (`name`);--> statement-breakpoint
CREATE TABLE `cluster_contexts` (
	`id` text PRIMARY KEY NOT NULL,
	`cluster_id` text NOT NULL,
	`context_name` text NOT NULL,
	`is_current` integer DEFAULT false NOT NULL,
	`server` text,
	`namespace_restrictions` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cluster_id`) REFERENCES `clusters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `clusters` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`kubeconfig_encrypted` text,
	`is_active` integer DEFAULT true NOT NULL,
	`is_local` integer DEFAULT false NOT NULL,
	`context_count` integer DEFAULT 1 NOT NULL,
	`last_connected_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clusters_name_unique` ON `clusters` (`name`);--> statement-breakpoint
CREATE TABLE `dashboard_widgets` (
	`id` text PRIMARY KEY NOT NULL,
	`dashboard_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`resource_type` text,
	`query` text,
	`config` text,
	`position` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dashboards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_default` integer DEFAULT false NOT NULL,
	`is_shared` integer DEFAULT false NOT NULL,
	`owner_id` text,
	`layout` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `rbac_bindings` (
	`user_id` text NOT NULL,
	`policy_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `policy_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`policy_id`) REFERENCES `rbac_policies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rbac_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`role` text NOT NULL,
	`resource_type` text,
	`action` text NOT NULL,
	`namespace_pattern` text,
	`cluster_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`cluster_id`) REFERENCES `clusters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rbac_policies_name_unique` ON `rbac_policies` (`name`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_providers` (
	`user_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `provider_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_id`) REFERENCES `auth_providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`email` text,
	`role` text DEFAULT 'viewer' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`is_local` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
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

ALTER TABLE `users` ADD `preferences` text;
-- Add OAuth token storage columns to user_providers
-- Tokens are encrypted at rest (AES-256-GCM) to support future token refresh flows
ALTER TABLE `user_providers` ADD `access_token_encrypted` text;--> statement-breakpoint
ALTER TABLE `user_providers` ADD `refresh_token_encrypted` text;--> statement-breakpoint
ALTER TABLE `user_providers` ADD `token_expires_at` integer;
