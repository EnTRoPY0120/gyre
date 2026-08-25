<script lang="ts">
	const LEVEL_OPTIONS = ['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
	const LEVEL_ACTIVE_CLASS: Record<string, string> = {
		ALL: 'bg-white text-gray-800 shadow-sm dark:bg-gray-600 dark:text-gray-100',
		ERROR: 'bg-red-100 text-red-700 shadow-sm dark:bg-red-900/50 dark:text-red-300',
		WARN: 'bg-yellow-100 text-yellow-700 shadow-sm dark:bg-yellow-900/50 dark:text-yellow-300',
		INFO: 'bg-green-100 text-green-700 shadow-sm dark:bg-green-900/50 dark:text-green-300',
		DEBUG: 'bg-blue-100 text-blue-700 shadow-sm dark:bg-blue-900/50 dark:text-blue-300'
	};
	const LEVEL_INACTIVE_CLASS =
		'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';

	let {
		showRawLogs,
		loading,
		onRefresh,
		onToggleRaw,
		searchQuery = $bindable(''),
		levelFilter = $bindable('ALL'),
		useRegex = $bindable(false),
		regexError
	}: {
		showRawLogs: boolean;
		loading: boolean;
		onRefresh: () => void;
		onToggleRaw: (value: boolean) => void;
		searchQuery?: string;
		levelFilter?: string;
		useRegex?: boolean;
		regexError: string | null;
	} = $props();

	function getLevelButtonClass(level: string, isActive: boolean) {
		return isActive ? (LEVEL_ACTIVE_CLASS[level] ?? LEVEL_ACTIVE_CLASS.DEBUG) : LEVEL_INACTIVE_CLASS;
	}
</script>

<div class="mb-4 flex flex-col gap-3">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Controller Logs</h3>

		<div class="flex items-center gap-3">
			<label
				class="flex cursor-pointer items-center gap-2 text-sm text-gray-500 transition-colors select-none hover:text-gray-700 dark:hover:text-gray-300"
			>
				<input
					type="checkbox"
					class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					checked={showRawLogs}
					onchange={(event) => onToggleRaw(event.currentTarget.checked)}
				/>
				Raw JSON
			</label>
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
				onclick={onRefresh}
				disabled={loading}
				aria-label="Refresh logs"
			>
				<svg
					class="h-4 w-4 {loading ? 'animate-spin' : ''}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
				Refresh
			</button>
		</div>
	</div>

	{#if !showRawLogs}
		<div class="flex flex-wrap items-center gap-3">
			<div class="relative flex-1 sm:max-w-xs">
				<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
					<svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
				</div>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder={useRegex ? 'Regex pattern...' : 'Search logs...'}
					aria-label="Search logs"
					aria-invalid={regexError ? 'true' : undefined}
					aria-describedby={regexError ? 'search-regex-error' : undefined}
					class="block w-full rounded-md border-gray-300 pl-10 pr-3 text-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 {regexError ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}"
				/>
				{#if regexError}
					<p id="search-regex-error" class="mt-1 text-xs text-red-500">{regexError}</p>
				{/if}
			</div>

			<div role="group" aria-label="Log level filter" class="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-1 dark:border-gray-600 dark:bg-gray-700/50">
				{#each LEVEL_OPTIONS as level}
					<button
						type="button"
						onclick={() => (levelFilter = level)}
						aria-pressed={levelFilter === level}
						class="rounded px-2.5 py-1 text-xs font-medium transition-colors {getLevelButtonClass(level, levelFilter === level)}"
					>
						{level}
					</button>
				{/each}
			</div>

			<label
				class="flex cursor-pointer items-center gap-1.5 text-sm text-gray-500 transition-colors select-none hover:text-gray-700 dark:hover:text-gray-300"
				title="Enable regular expression search"
			>
				<input
					type="checkbox"
					class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					bind:checked={useRegex}
				/>
				<span class="font-mono text-xs">.*</span>
				Regex
			</label>
		</div>
	{/if}
</div>
