CREATE TABLE `password_history` (
    `id` text PRIMARY KEY NOT NULL,
    `user_id` text NOT NULL,
    `password_hash` text NOT NULL,
    `created_at_ms` integer NOT NULL,
    `created_at` integer DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `idx_password_history_user_id` ON `password_history` (`user_id`);
