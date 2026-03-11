<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { formatDistanceToNow } from 'date-fns';
	import {
		Shield,
		User,
		Globe,
		CheckCircle2,
		XCircle,
		Search,
		Filter,
		ChevronDown,
		ChevronUp,
		ChevronLeft,
		ChevronRight,
		ArrowUpDown,
		ArrowUp,
		ArrowDown
	} from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	interface AuditLog {
		id: string;
		userId: string | null;
		action: string;
		resourceType: string | null;
		resourceName: string | null;
		namespace: string | null;
		clusterId: string | null;
		details: Record<string, unknown> | null;
		success: boolean;
		ipAddress: string | null;
		createdAt: Date;
		user: {
			username: string;
			email: string | null;
		} | null;
	}

	let { data } = $props<{
		data: {
			logs: AuditLog[];
			total: number;
			limit: number;
			offset: number;
			sortBy: 'date' | 'action' | 'user';
			sortOrder: 'asc' | 'desc';
			successFilter: string;
		};
	}>();

	let searchQuery = $state('');
	let debouncedQuery = $state('');

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

	let filteredLogs = $derived.by(() => {
		if (!debouncedQuery) return data.logs;
		const q = debouncedQuery.toLowerCase();
		return data.logs.filter(
			(log: AuditLog) =>
				log.action.toLowerCase().includes(q) ||
				(log.resourceName && log.resourceName.toLowerCase().includes(q)) ||
				(log.resourceType && log.resourceType.toLowerCase().includes(q)) ||
				(log.namespace && log.namespace.toLowerCase().includes(q)) ||
				(log.user?.username && log.user.username.toLowerCase().includes(q)) ||
				(log.ipAddress && log.ipAddress.toLowerCase().includes(q))
		);
	});

	let expandedLogId = $state<string | null>(null);

	function toggleExpand(id: string) {
		expandedLogId = expandedLogId === id ? null : id;
	}

	function getActionColor(action: string) {
		if (action.startsWith('write')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
		if (action.startsWith('delete') || action.startsWith('rbac:delete'))
			return 'text-red-400 bg-red-500/10 border-red-500/20';
		if (action === 'login') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
		if (action.startsWith('user:')) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
		return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
	}

	function formatTimestamp(date: Date) {
		return formatDistanceToNow(new Date(date), { addSuffix: true });
	}

	function buildUrl(params: Record<string, string | number | undefined>) {
		const current = new URL($page.url);
		for (const [key, value] of Object.entries(params)) {
			if (value === undefined || value === '') {
				current.searchParams.delete(key);
			} else {
				current.searchParams.set(key, String(value));
			}
		}
		return current.pathname + current.search;
	}

	function navigate(params: Record<string, string | number | undefined>) {
		goto(buildUrl(params));
	}

	function goToPage(newOffset: number) {
		navigate({ offset: newOffset });
	}

	function setSort(col: 'date' | 'action' | 'user') {
		const newOrder =
			data.sortBy === col ? (data.sortOrder === 'desc' ? 'asc' : 'desc') : 'desc';
		navigate({ sortBy: col, sortOrder: newOrder, offset: 0 });
	}

	function setStatusFilter(value: string) {
		navigate({ success: value === 'all' ? undefined : value, offset: 0 });
	}

	function setLimit(newLimit: number) {
		navigate({ limit: newLimit, offset: 0 });
	}

	let currentPage = $derived(Math.floor(data.offset / data.limit) + 1);
	let totalPages = $derived(Math.ceil(data.total / data.limit));

	function SortIcon(col: 'date' | 'action' | 'user') {
		if (data.sortBy !== col) return ArrowUpDown;
		return data.sortOrder === 'asc' ? ArrowUp : ArrowDown;
	}

	const dateSortIcon = $derived(SortIcon('date'));
	const userSortIcon = $derived(SortIcon('user'));
	const actionSortIcon = $derived(SortIcon('action'));
</script>

<div class="space-y-6">
	<!-- Header -->
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
						onValueChange={(v) => setStatusFilter(v)}
					>
						<DropdownMenu.RadioItem value="all">All Logs</DropdownMenu.RadioItem>
						<DropdownMenu.RadioItem value="true">Successful</DropdownMenu.RadioItem>
						<DropdownMenu.RadioItem value="false">Failed</DropdownMenu.RadioItem>
					</DropdownMenu.RadioGroup>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>

	<!-- Logs Table -->
	<div class="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="border-b border-slate-700/50 bg-slate-900/30">
						<th class="px-4 py-3 font-medium text-slate-400">
							<button
								onclick={() => setSort('date')}
								class="flex items-center gap-1 hover:text-white transition-colors"
							>
								Time
								<dateSortIcon size={13}></dateSortIcon>
							</button>
						</th>
						<th class="px-4 py-3 font-medium text-slate-400">
							<button
								onclick={() => setSort('user')}
								class="flex items-center gap-1 hover:text-white transition-colors"
							>
								User
								<userSortIcon size={13}></userSortIcon>
							</button>
						</th>
						<th class="px-4 py-3 font-medium text-slate-400">
							<button
								onclick={() => setSort('action')}
								class="flex items-center gap-1 hover:text-white transition-colors"
							>
								Action
								<actionSortIcon size={13}></actionSortIcon>
							</button>
						</th>
						<th class="px-4 py-3 font-medium text-slate-400">Resource</th>
						<th class="hidden px-4 py-3 font-medium text-slate-400 lg:table-cell">Context</th>
						<th class="px-4 py-3 font-medium text-slate-400">Status</th>
						<th class="w-10 px-4 py-3"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-700/50">
					{#each filteredLogs as log (log.id)}
						<tr
							class={cn(
								'transition-colors hover:bg-slate-700/30',
								expandedLogId === log.id && 'bg-slate-700/20'
							)}
						>
							<td class="px-4 py-3 whitespace-nowrap text-slate-300">
								<div class="flex flex-col">
									<span class="font-medium text-white"
										>{new Date(log.createdAt).toLocaleTimeString()}</span
									>
									<span class="text-[10px] text-slate-500 uppercase"
										>{formatTimestamp(log.createdAt)}</span
									>
								</div>
							</td>
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									<div class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700">
										<User size={12} class="text-slate-400" />
									</div>
									<span class="font-medium text-slate-200">{log.user?.username || 'System'}</span>
								</div>
							</td>
							<td class="px-4 py-3">
								<span
									class={cn(
										'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase',
										getActionColor(log.action)
									)}
								>
									{log.action}
								</span>
							</td>
							<td class="px-4 py-3">
								{#if log.resourceType}
									<div class="flex flex-col">
										<span class="font-medium text-white">{log.resourceName || '-'}</span>
										<span class="text-[10px] text-slate-500 uppercase">{log.resourceType}</span>
									</div>
								{:else}
									<span class="text-slate-500">-</span>
								{/if}
							</td>
							<td class="hidden px-4 py-3 lg:table-cell">
								<div class="flex flex-col text-[11px]">
									{#if log.namespace}
										<div class="flex items-center gap-1 text-slate-400">
											<Globe size={10} />
											<span>{log.namespace}</span>
										</div>
									{/if}
									{#if log.clusterId}
										<div class="flex items-center gap-1 text-slate-500">
											<Shield size={10} />
											<span>{log.clusterId}</span>
										</div>
									{/if}
									{#if !log.namespace && !log.clusterId}
										<span class="text-slate-600">Global</span>
									{/if}
								</div>
							</td>
							<td class="px-4 py-3">
								{#if log.success}
									<CheckCircle2 size={16} class="text-emerald-500" />
								{:else}
									<XCircle size={16} class="text-red-500" />
								{/if}
							</td>
							<td class="px-4 py-3 text-right">
								<button
									onclick={() => toggleExpand(log.id)}
									class="text-slate-500 transition-colors hover:text-white"
									aria-expanded={expandedLogId === log.id}
									aria-controls={`log-details-${log.id}`}
									aria-label={expandedLogId === log.id
										? 'Collapse log details'
										: 'Expand log details'}
								>
									{#if expandedLogId === log.id}
										<ChevronUp size={16} />
									{:else}
										<ChevronDown size={16} />
									{/if}
								</button>
							</td>
						</tr>
						{#if expandedLogId === log.id}
							<tr class="bg-slate-900/40" id={`log-details-${log.id}`}>
								<td colspan="7" class="px-6 py-4">
									<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
										<div class="space-y-4">
											<div>
												<h4 class="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
													Event Details
												</h4>
												<div
													class="max-h-64 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-amber-400/80"
												>
													<pre>{JSON.stringify(log.details, null, 2)}</pre>
												</div>
											</div>
										</div>
										<div class="space-y-4">
											<div>
												<h4 class="mb-2 text-xs font-bold tracking-widest text-slate-500 uppercase">
													Metadata
												</h4>
												<div class="space-y-2">
													<div class="flex justify-between border-b border-slate-800 pb-1">
														<span class="text-slate-400">Log ID</span>
														<span class="font-mono text-[10px] text-slate-200">{log.id}</span>
													</div>
													<div class="flex justify-between border-b border-slate-800 pb-1">
														<span class="text-slate-400">IP Address</span>
														<span class="text-slate-200">{log.ipAddress || 'Internal'}</span>
													</div>
													<div class="flex justify-between border-b border-slate-800 pb-1">
														<span class="text-slate-400">User Email</span>
														<span class="text-slate-200">{log.user?.email || 'N/A'}</span>
													</div>
													<div class="flex justify-between border-b border-slate-800 pb-1">
														<span class="text-slate-400">Full Timestamp</span>
														<span class="text-slate-200"
															>{new Date(log.createdAt).toISOString()}</span
														>
													</div>
												</div>
											</div>
										</div>
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

		{#if data.logs.length === 0}
			<div class="flex flex-col items-center justify-center py-20 text-slate-500">
				<Shield size={48} class="mb-4 opacity-20" />
				<p>No audit logs found</p>
			</div>
		{/if}
	</div>

	<!-- Pagination -->
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
						{#each [25, 50, 100, 200] as n}
							<DropdownMenu.Item onclick={() => setLimit(n)} class={data.limit === n ? 'font-bold' : ''}>
								{n}
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

				<span class="px-3 text-sm text-slate-400">
					Page {currentPage} of {totalPages}
				</span>

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
