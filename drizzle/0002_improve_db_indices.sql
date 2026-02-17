DROP TABLE `dashboard_widgets`;
--> statement-breakpoint
DROP TABLE `dashboards`;
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_user_id` ON `audit_logs` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_action` ON `audit_logs` (`action`);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_created_at` ON `audit_logs` (`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_rbac_bindings_policy_user` ON `rbac_bindings` (`policy_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);
