<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import VirtualList from '$lib/components/ui/VirtualList.svelte';

	interface Props {
		logs: string;
		formattedLogs: Array<{ ts: string; level: string; msg: string; full: string }>;
		loading: boolean;
		error: string | null;
		showRawLogs: boolean;
		onRefresh: () => void;
		onToggleRaw: (value: boolean) => void;
		logContainer: HTMLDivElement | null;
	}

	let {
		logs,
		formattedLogs,
		loading,
		error,
		showRawLogs,
		onRefresh,
		onToggleRaw,
		logContainer = $bindable()
	}: Props = $props();

	let searchQuery = $state('');
	let levelFilter = $state<string>('ALL');
	let useRegex = $state(false);

	const LEVEL_OPTIONS = ['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR'] as const;

	// Derive regex and error synchronously so filtering is always consistent
	const compiledRegex = $derived.by<RegExp | null>(() => {
		if (!useRegex || !searchQuery) return null;
		try {
			return new RegExp(searchQuery, 'i');
		} catch {
			return null;
		}
	});

	const regexError = $derived.by<string | null>(() => {
		if (!useRegex || !searchQuery) return null;
		try {
			new RegExp(searchQuery, 'i');
			return null;
		} catch {
			return 'Invalid regular expression';
		}
	});

	const filteredFormattedLogs = $derived.by(() => {
		let result = formattedLogs;

		if (levelFilter !== 'ALL') {
			result = result.filter(
				(line) =>
					line.level === levelFilter ||
					(levelFilter === 'WARN' && line.level === 'WARNING') ||
					(levelFilter === 'ERROR' && line.level === 'FATAL')
			);
		}

		if (searchQuery) {
			if (useRegex) {
				if (compiledRegex) {
					result = result.filter(
						(line) => compiledRegex.test(line.msg) || compiledRegex.test(line.level)
					);
				}
				// compiledRegex is null when pattern is invalid — leave result unfiltered by text
			} else {
				const q = searchQuery.toLowerCase();
				result = result.filter(
					(line) =>
						line.msg.toLowerCase().includes(q) || line.level.toLowerCase().includes(q)
				);
			}
		}

		return result;
	});

	const LEVEL_ACTIVE_CLASS: Record<string, string> = {
		ALL: 'bg-white text-gray-800 shadow-sm dark:bg-gray-600 dark:text-gray-100',
		ERROR: 'bg-red-100 text-red-700 shadow-sm dark:bg-red-900/50 dark:text-red-300',
		WARN: 'bg-yellow-100 text-yellow-700 shadow-sm dark:bg-yellow-900/50 dark:text-yellow-300',
		INFO: 'bg-green-100 text-green-700 shadow-sm dark:bg-green-900/50 dark:text-green-300',
		DEBUG: 'bg-blue-100 text-blue-700 shadow-sm dark:bg-blue-900/50 dark:text-blue-300'
	};
	const LEVEL_INACTIVE_CLASS = 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';

	function getLevelButtonClass(level: string, isActive: boolean) {
		return isActive ? (LEVEL_ACTIVE_CLASS[level] ?? LEVEL_ACTIVE_CLASS.DEBUG) : LEVEL_INACTIVE_CLASS;
	}

	function getLevelClass(level: string) {
		switch (level) {
			case 'ERROR':
			case 'FATAL':
				return 'text-red-400 font-bold';
			case 'WARN':
			case 'WARNING':
				return 'text-yellow-400 font-bold';
			case 'DEBUG':
				return 'text-blue-400';
			default:
				return 'text-green-400';
		}
	}
</script>

<div
	class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
>
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
						onchange={(e) => onToggleRaw(e.currentTarget.checked)}
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
						<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

	{#if loading && !logs}
		<div class="space-y-3 rounded-lg bg-gray-950 p-4">
			{#each Array(8) as _}
				<div class="flex gap-3">
					<Skeleton class="h-4 w-20 bg-gray-800" />
					<Skeleton class="h-4 w-12 bg-gray-800" />
					<Skeleton class="h-4 flex-1 bg-gray-800" />
				</div>
			{/each}
		</div>
	{:else if error}
		<div
			class="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-900/20"
		>
			<svg class="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<h3 class="mt-2 text-sm font-medium text-red-800 dark:text-red-300">Failed to load logs</h3>
			<p class="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
			<div class="mt-4">
				<button
					type="button"
					class="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-800"
					onclick={onRefresh}
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					Try Again
				</button>
			</div>
		</div>
	{:else if !logs && !loading}
		<div class="py-12 text-center text-gray-500 dark:text-gray-400">
			No relevant logs found in the controller for this resource.
		</div>
	{:else}
		<div class="relative rounded-lg bg-gray-950 shadow-inner overflow-hidden">
			{#if showRawLogs}
				<div
					bind:this={logContainer}
					class="scrollbar-thin scrollbar-track-gray-900 scrollbar-thumb-gray-700 max-h-[600px] overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-300"
				>
					<code>{logs}</code>
				</div>
			{:else}
				<div class="h-[600px] w-full">
					{#if filteredFormattedLogs.length === 0}
						<div class="py-8 text-center text-gray-500">No logs match your search.</div>
					{:else}
						<VirtualList items={filteredFormattedLogs} itemHeight={36} buffer={5} class="h-full px-4 py-2 font-mono text-xs leading-relaxed text-gray-300" bind:scrollContainer={logContainer}>
							{#snippet children(line)}
								<div class="flex gap-3 overflow-hidden py-0.5">
									<span class="shrink-0 text-gray-500">[{line.ts}]</span>
									<span class="shrink-0 {getLevelClass(line.level)}">{line.level.padEnd(5)}</span>
									<span class="min-w-0 truncate">{line.msg}</span>
								</div>
							{/snippet}
						</VirtualList>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
