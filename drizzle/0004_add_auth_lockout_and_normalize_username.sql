-- Update users table to use COLLATE NOCASE for username and lowercase existing usernames
PRAGMA foreign_keys=OFF;

-- Create temporary table for users
CREATE TABLE `users_new` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL COLLATE NOCASE,
	`password_hash` text NOT NULL,
	`email` text,
	`role` text DEFAULT 'viewer' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`is_local` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`preferences` text
);

-- Copy data and lowercase usernames with collision resolution
INSERT INTO `users_new` (id, username, password_hash, email, role, active, is_local, created_at, updated_at, preferences)
WITH cte AS (
    SELECT 
        id, 
        password_hash, 
        email, 
        role, 
        active, 
        is_local, 
        created_at, 
        updated_at, 
        preferences,
        LOWER(TRIM(username)) AS norm,
        ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(username)) ORDER BY id) AS rn
    FROM users
)
SELECT 
    id, 
    CASE WHEN rn > 1 THEN norm || '_' || (rn - 1) ELSE norm END,
    password_hash, 
    email, 
    role, 
    active, 
    is_local, 
    created_at, 
    updated_at, 
    preferences
FROM cte;

-- Drop old table and rename new one
DROP TABLE `users`;
ALTER TABLE `users_new` RENAME TO `users`;

-- Re-create unique index
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);

-- Create login_lockouts table
CREATE TABLE `login_lockouts` (
	`username` text PRIMARY KEY NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

-- Set migration flag to prevent redundant runtime normalization
INSERT OR REPLACE INTO `app_settings` (key, value, updated_at) 
VALUES ('migrations.users_lowercased', 'true', (unixepoch()));

PRAGMA foreign_keys=ON;
