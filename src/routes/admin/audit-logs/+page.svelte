<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { formatDistanceToNow } from 'date-fns';
	import { ChevronDown, ChevronLeft, ChevronRight, Filter, Search } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import AuditLogTable from '$lib/components/admin/AuditLogTable.svelte';
	import { filterAuditLogs } from './page-filters';
	import type { AuditLog } from './audit-log-types';

	let { data } = $props<{
		data: {
			logs: AuditLog[];
			total: number;
			limit: number;
			offset: number;
			sortBy: 'date' | 'action';
			sortOrder: 'asc' | 'desc';
			successFilter: string;
		};
	}>();

	let searchQuery = $state('');
	let debouncedQuery = $state('');

	const actionColorRules = [
		{
			matches: (action: string) => action.startsWith('write'),
			className: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
		},
		{
			matches: (action: string) => action.startsWith('delete') || action.startsWith('rbac:delete'),
			className: 'text-red-400 bg-red-500/10 border-red-500/20'
		},
		{
			matches: (action: string) => action === 'login',
			className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
		},
		{
			matches: (action: string) => action.startsWith('user:'),
			className: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
		}
	];

	$effect(() => {
		const query = searchQuery;
		if (query === '') {
			debouncedQuery = '';
			return;
		}
		const timeoutId = setTimeout(() => {
			debouncedQuery = query;
		}, 300);
		return () => clearTimeout(timeoutId);
	});

	const filteredLogs = $derived.by(() => filterAuditLogs<AuditLog>(data.logs, debouncedQuery));
	let expandedLogId = $state<string | null>(null);

	function toggleExpand(id: string) {
		expandedLogId = expandedLogId === id ? null : id;
	}

	function getActionColor(action: string) {
		return (
			actionColorRules.find((rule) => rule.matches(action))?.className ??
			'text-slate-400 bg-slate-500/10 border-slate-500/20'
		);
	}

	function formatTimestamp(date: Date) {
		return formatDistanceToNow(new Date(date), { addSuffix: true });
	}

	function buildUrl(params: Record<string, string | number | undefined>) {
		const current = new URL($page.url);
		for (const [key, value] of Object.entries(params)) {
			if (value === undefined || value === '') current.searchParams.delete(key);
			else current.searchParams.set(key, String(value));
		}
		return current.pathname + current.search;
	}

	function navigate(params: Record<string, string | number | undefined>) {
		void goto(buildUrl(params));
	}

	function goToPage(newOffset: number) {
		navigate({ offset: newOffset });
	}

	function setSort(column: 'date' | 'action') {
		const newOrder =
			data.sortBy === column ? (data.sortOrder === 'desc' ? 'asc' : 'desc') : 'desc';
		navigate({ sortBy: column, sortOrder: newOrder, offset: 0 });
	}

	function setStatusFilter(value: string) {
		navigate({ success: value === 'all' ? undefined : value, offset: 0 });
	}

	function setLimit(newLimit: number) {
		navigate({ limit: newLimit, offset: 0 });
	}

	const currentPage = $derived(Math.floor(data.offset / data.limit) + 1);
	const totalPages = $derived(Math.ceil(data.total / data.limit));
</script>

<div class="space-y-6">
	<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
		<div>
			<h1 class="text-2xl font-bold text-white">Audit Logs</h1>
			<p class="text-slate-400">Track all system activities and security events</p>
		</div>
		<div class="flex gap-2">
			<div class="relative">
				<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search current page..."
					aria-label="Search logs"
					class="h-10 w-full rounded-lg border border-slate-700 bg-slate-800/50 pr-4 pl-10 text-sm text-white placeholder-slate-500 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 focus:outline-none sm:w-64"
				/>
			</div>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger
					class={cn(
						'flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/50 text-slate-400 transition-colors hover:bg-slate-700/50',
						data.successFilter !== 'all' && 'border-amber-500/50 text-amber-500'
					)}
				>
					<Filter size={18} />
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-48">
					<DropdownMenu.Label>Filter by Status</DropdownMenu.Label>
					<DropdownMenu.Separator />
					<DropdownMenu.RadioGroup
						value={data.successFilter}
						onValueChange={setStatusFilter}
					>
						<DropdownMenu.RadioItem value="all">All Logs</DropdownMenu.RadioItem>
						<DropdownMenu.RadioItem value="true">Successful</DropdownMenu.RadioItem>
						<DropdownMenu.RadioItem value="false">Failed</DropdownMenu.RadioItem>
					</DropdownMenu.RadioGroup>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>

	<AuditLogTable
		logs={filteredLogs}
		expandedLogId={expandedLogId}
		actionColor={getActionColor}
		relativeTimestamp={formatTimestamp}
		onToggleExpand={toggleExpand}
		onSort={setSort}
		sortBy={data.sortBy}
		sortOrder={data.sortOrder}
	/>

	{#if data.total > 0}
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-2 text-sm text-slate-400">
				<span>
					Showing {data.offset + 1}–{Math.min(data.offset + data.limit, data.total)} of {data.total} logs
				</span>
				<span class="text-slate-600">|</span>
				<span>Rows per page:</span>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="flex h-7 items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-2 text-xs text-white hover:bg-slate-700/50"
					>
						{data.limit}
						<ChevronDown size={12} />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="start" class="w-20">
						{#each [25, 50, 100, 200] as size}
							<DropdownMenu.Item onclick={() => setLimit(size)} class={data.limit === size ? 'font-bold' : ''}>
								{size}
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>

			<div class="flex items-center gap-1">
				<button
					onclick={() => goToPage(0)}
					disabled={data.offset === 0}
					class="flex h-8 w-8 items-center justify-center rounded border border-slate-700 bg-slate-800/50 text-slate-400 transition-colors hover:bg-slate-700/50 disabled:cursor-not-allowed disabled:opacity-40"
					aria-label="First page"
				>
					<ChevronLeft size={14} />
				</button>
				<button
					onclick={() => goToPage(Math.max(0, data.offset - data.limit))}
					disabled={data.offset === 0}
					class="flex h-8 items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-2 text-sm text-slate-400 transition-colors hover:bg-slate-700/50 disabled:cursor-not-allowed disabled:opacity-40"
					aria-label="Previous page"
				>
					<ChevronLeft size={14} />
					Prev
				</button>
				<span class="px-3 text-sm text-slate-400">Page {currentPage} of {totalPages}</span>
				<button
					onclick={() => goToPage(data.offset + data.limit)}
					disabled={data.offset + data.limit >= data.total}
					class="flex h-8 items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-2 text-sm text-slate-400 transition-colors hover:bg-slate-700/50 disabled:cursor-not-allowed disabled:opacity-40"
					aria-label="Next page"
				>
					Next
					<ChevronRight size={14} />
				</button>
				<button
					onclick={() => goToPage((totalPages - 1) * data.limit)}
					disabled={data.offset + data.limit >= data.total}
					class="flex h-8 w-8 items-center justify-center rounded border border-slate-700 bg-slate-800/50 text-slate-400 transition-colors hover:bg-slate-700/50 disabled:cursor-not-allowed disabled:opacity-40"
					aria-label="Last page"
				>
					<ChevronRight size={14} />
				</button>
			</div>
		</div>
	{/if}
</div>
