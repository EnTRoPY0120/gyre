<script lang="ts">
	import { filterFormattedLogs, getLogRegexState } from './logs-tab-filters';
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

	const regexState = $derived.by(() => getLogRegexState(searchQuery, useRegex));
	const compiledRegex = $derived(regexState.regex);
	const regexError = $derived(regexState.error);
	const filteredFormattedLogs = $derived(
		filterFormattedLogs(formattedLogs, {
			levelFilter,
			searchQuery,
			useRegex,
			regex: compiledRegex
		})
	);
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
