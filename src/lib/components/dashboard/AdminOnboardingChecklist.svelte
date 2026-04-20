<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { AdminReadinessStatus, AdminReadinessSummary } from '$lib/types/admin-readiness';

	interface Props {
		adminReadiness?: AdminReadinessSummary;
	}

	let { adminReadiness }: Props = $props();

	function badgeClasses(status: AdminReadinessStatus): string {
		if (status === 'ready') {
			return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600';
		}
		if (status === 'attention') {
			return 'border-amber-500/30 bg-amber-500/10 text-amber-600';
		}
		return 'border-destructive/30 bg-destructive/10 text-destructive';
	}

	function cardClasses(status: AdminReadinessStatus): string {
		if (status === 'ready') {
			return 'border-emerald-500/25 bg-emerald-500/5';
		}
		if (status === 'attention') {
			return 'border-amber-500/25 bg-amber-500/5';
		}
		return 'border-destructive/25 bg-destructive/5';
	}

	function summaryText(summary: AdminReadinessSummary): string {
		if (summary.actionRequiredCount > 0) {
			return `${summary.actionRequiredCount} step${summary.actionRequiredCount === 1 ? '' : 's'} require action now.`;
		}
		if (summary.attentionCount > 0) {
			return `${summary.attentionCount} step${summary.attentionCount === 1 ? '' : 's'} need attention.`;
		}
		return 'All readiness checks are healthy.';
	}

	function badgeLabel(status: AdminReadinessStatus): string {
		if (status === 'action-required') {
			return 'Action Required';
		}
		if (status === 'attention') {
			return 'Attention';
		}
		return 'Ready';
	}
</script>

{#if adminReadiness}
	<section
		class="overflow-hidden rounded-[2rem] border border-border bg-card/90 shadow-sm backdrop-blur-xl"
		aria-labelledby="admin-readiness-title"
	>
		<div class="border-b border-border/60 px-6 py-5 md:px-8">
			<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div class="flex items-start gap-4">
					<div
						class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
					>
						<Icon name="shield-check" size={22} />
					</div>
					<div>
						<p class="text-[11px] font-black tracking-[0.24em] text-primary uppercase">
							Admin Readiness
						</p>
						<h2 id="admin-readiness-title" class="mt-1 text-xl font-bold text-foreground">
							System setup status
						</h2>
						<p class="mt-2 max-w-2xl text-sm text-muted-foreground">
							{summaryText(adminReadiness)}
						</p>
					</div>
				</div>
				<div class="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
					{adminReadiness.readyCount} ready · {adminReadiness.attentionCount} attention ·
					{adminReadiness.actionRequiredCount} action required
				</div>
			</div>
		</div>

		<div class="grid gap-4 p-6 md:p-8 xl:grid-cols-2">
			{#each adminReadiness.steps as step (step.id)}
				<div class={`rounded-[1.5rem] border px-5 py-4 transition-colors ${cardClasses(step.status)}`}>
					<div class="flex h-full flex-col gap-4">
						<div class="flex items-start gap-3">
							<div class={`mt-0.5 rounded-full border px-2 py-1 text-xs font-semibold ${badgeClasses(step.status)}`}>
								{badgeLabel(step.status)}
							</div>
							<div class="min-w-0">
								<h3 class="font-semibold text-foreground">{step.title}</h3>
								<p class="mt-1 text-sm text-muted-foreground">{step.description}</p>
							</div>
						</div>

						<div class="mt-auto">
							<a
								href={step.href}
								data-sveltekit-preload-data="hover"
								class="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
							>
								{step.ctaLabel}
								<Icon name="arrow-right" size={15} />
							</a>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/if}
