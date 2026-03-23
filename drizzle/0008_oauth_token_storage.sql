-- Add OAuth token storage columns to user_providers
-- Tokens are encrypted at rest (AES-256-GCM) to support future token refresh flows
ALTER TABLE `user_providers` ADD `access_token_encrypted` text;--> statement-breakpoint
ALTER TABLE `user_providers` ADD `refresh_token_encrypted` text;--> statement-breakpoint
ALTER TABLE `user_providers` ADD `token_expires_at` integer;
