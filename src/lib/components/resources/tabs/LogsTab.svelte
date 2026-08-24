<script lang="ts">
	import type { FormattedLogLine } from './logs-tab-types';
	import LogsContent from './LogsContent.svelte';
	import LogsToolbar from './LogsToolbar.svelte';

	interface Props {
		logs: string;
		formattedLogs: FormattedLogLine[];
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

	const REDOS_HEURISTIC =
		/\([^)]*[+*][^)]*\)[+*?]|\([^)]*\)[+*]\s*[+*]|\((?:\?(?::|<[^>]*>))?(?![^)]*[*+?{])[^)]*\|[^)]*\)[+*?]/;

	function isSafePattern(pattern: string): boolean {
		return !REDOS_HEURISTIC.test(pattern.replace(/\\./g, ''));
	}

	const compiledRegex = $derived.by<RegExp | null>(() => {
		if (!useRegex || !searchQuery) return null;
		if (!isSafePattern(searchQuery)) return null;
		try {
			return new RegExp(searchQuery, 'i');
		} catch {
			return null;
		}
	});

	const regexError = $derived.by<string | null>(() => {
		if (!useRegex || !searchQuery) return null;
		if (!isSafePattern(searchQuery)) return 'Pattern may cause performance issues';
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
			} else {
				const query = searchQuery.toLowerCase();
				result = result.filter(
					(line) =>
						line.msg.toLowerCase().includes(query) || line.level.toLowerCase().includes(query)
				);
			}
		}

		return result;
	});
</script>

<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
	<LogsToolbar
		{showRawLogs}
		{loading}
		{onRefresh}
		{onToggleRaw}
		bind:searchQuery
		bind:levelFilter
		bind:useRegex
		{regexError}
	/>
	<LogsContent
		{logs}
		{filteredFormattedLogs}
		{loading}
		{error}
		{showRawLogs}
		{onRefresh}
		bind:logContainer
	/>
</div>
