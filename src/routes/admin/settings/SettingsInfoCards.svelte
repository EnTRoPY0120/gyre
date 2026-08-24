<div class="grid gap-6 md:grid-cols-2">
	<div
		class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20"
	>
		<h3 class="font-semibold text-blue-900 dark:text-blue-100">Local Login</h3>
		<p class="mt-2 text-sm text-blue-800 dark:text-blue-200">
			When disabled, users can only authenticate via configured OAuth providers. The local login form
			will be hidden from the login page.
		</p>
	</div>

	<div
		class="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-900/20"
	>
		<h3 class="font-semibold text-purple-900 dark:text-purple-100">OAuth Signup</h3>
		<p class="mt-2 text-sm text-purple-800 dark:text-purple-200">
			When disabled, only existing users can log in via OAuth. New users will see an error message.
			Useful for invitation-only systems.
		</p>
	</div>

	<div
		class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20"
	>
		<h3 class="font-semibold text-amber-900 dark:text-amber-100">Audit Retention</h3>
		<p class="mt-2 text-sm text-amber-800 dark:text-amber-200">
			Audit logs are automatically cleaned up to prevent database growth. The cleanup job runs daily
			at 3 AM.
		</p>
	</div>
</div>
