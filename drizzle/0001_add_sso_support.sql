-- Add is_local column to users table (distinguishes local vs SSO users)
ALTER TABLE `users` ADD COLUMN `is_local` integer DEFAULT true NOT NULL;

-- Create auth_providers table for SSO configuration
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
CREATE UNIQUE INDEX `auth_providers_name_unique` ON `auth_providers` (`name`);

-- Create user_providers table to link users to SSO providers
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
