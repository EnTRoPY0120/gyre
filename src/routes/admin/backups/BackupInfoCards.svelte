<div class="grid gap-6 md:grid-cols-3">
	<div
		class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20"
	>
		<h3 class="font-semibold text-blue-900 dark:text-blue-100">On-Demand Backups</h3>
		<p class="mt-2 text-sm text-blue-800 dark:text-blue-200">
			Create a snapshot of the current SQLite database at any time. Backups are stored locally and a
			maximum of 10 are retained. Older backups are automatically pruned.
		</p>
	</div>

	<div
		class="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-900/20"
	>
		<h3 class="font-semibold text-purple-900 dark:text-purple-100">Restore from Backup</h3>
		<p class="mt-2 text-sm text-purple-800 dark:text-purple-200">
			Upload a previously downloaded backup file to restore the database. A safety backup is always
			created before restoring. Accepted formats: <code class="font-mono">.db</code> (unencrypted) and
			<code class="font-mono">.db.enc</code> (AES-256-GCM encrypted).
		</p>
	</div>

	<div
		class="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-900/20"
	>
		<h3 class="font-semibold text-emerald-900 dark:text-emerald-100">Encryption at Rest</h3>
		<p class="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
			Set
			<code class="rounded bg-emerald-100 px-1 dark:bg-emerald-900">BACKUP_ENCRYPTION_KEY</code>
			to a 64-character hex string to enable AES-256-GCM encryption. Generate a key with:
			<code class="mt-1 block rounded bg-emerald-100 px-1 dark:bg-emerald-900">openssl rand -hex 32</code>
		</p>
		<p class="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
			⚠️ Changing the key renders existing encrypted backups unreadable. Decrypt and re-encrypt them
			before rotating.
		</p>
	</div>
</div>
