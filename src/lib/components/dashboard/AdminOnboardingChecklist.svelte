<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import Icon from '$lib/components/ui/Icon.svelte';
	import {
		ADMIN_ONBOARDING_CHECKLIST_ITEMS,
		getAdminChecklistState,
		type AdminOnboardingChecklistId
	} from '$lib/user-preferences';
	import { toast } from 'svelte-sonner';

	let completedItems = $state<AdminOnboardingChecklistId[]>([]);
	let dismissed = $state(false);
	let isSaving = $state(false);

	const isAdmin = $derived($page.data.user?.role === 'admin');
	const checklistState = $derived(getAdminChecklistState($page.data.user?.preferences));
	const completedSet = $derived(new Set(completedItems));
	const allCompleted = $derived(
		ADMIN_ONBOARDING_CHECKLIST_ITEMS.every((item) => completedSet.has(item.id))
	);
	const hiddenReason = $derived(dismissed ? 'dismissed' : allCompleted ? 'completed' : null);

	$effect(() => {
		completedItems = [...checklistState.completedItems];
		dismissed = checklistState.dismissed;
	});

	async function saveChecklistState(next: {
		adminChecklistCompletedItems: AdminOnboardingChecklistId[];
		adminChecklistDismissed: boolean;
	}) {
		isSaving = true;

		try {
			const response = await fetch('/api/v1/user/preferences', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					onboarding: next
				})
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'Failed to save onboarding checklist');
			}

			await invalidate('gyre:layout');
		} finally {
			isSaving = false;
		}
	}

	async function toggleChecklistItem(id: AdminOnboardingChecklistId) {
		const previousCompletedItems = [...completedItems];
		const previousDismissed = dismissed;
		const nextCompletedItems = completedSet.has(id)
			? completedItems.filter((itemId) => itemId !== id)
			: [...completedItems, id];

		completedItems = nextCompletedItems;
		dismissed = false;

		try {
			await saveChecklistState({
				adminChecklistCompletedItems: nextCompletedItems,
				adminChecklistDismissed: false
			});
		} catch (err) {
			completedItems = previousCompletedItems;
			dismissed = previousDismissed;
			toast.error(err instanceof Error ? err.message : 'Failed to update onboarding checklist');
		}
	}

	async function dismissChecklist() {
		const previousDismissed = dismissed;
		dismissed = true;

		try {
			await saveChecklistState({
				adminChecklistCompletedItems: completedItems,
				adminChecklistDismissed: true
			});
		} catch (err) {
			dismissed = previousDismissed;
			toast.error(err instanceof Error ? err.message : 'Failed to dismiss onboarding checklist');
		}
	}

	async function resetChecklist() {
		const previousCompletedItems = [...completedItems];
		const previousDismissed = dismissed;
		completedItems = [];
		dismissed = false;

		try {
			await saveChecklistState({
				adminChecklistCompletedItems: [],
				adminChecklistDismissed: false
			});
		} catch (err) {
			completedItems = previousCompletedItems;
			dismissed = previousDismissed;
			toast.error(err instanceof Error ? err.message : 'Failed to reset onboarding checklist');
		}
	}
</script>

{#if isAdmin}
	{#if hiddenReason}
		<div
			class="rounded-[1.75rem] border border-border bg-card/80 p-4 shadow-sm backdrop-blur-xl md:px-6"
		>
			<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div class="flex items-start gap-3">
					<div
						class="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-background/60 text-primary"
					>
						<Icon name={hiddenReason === 'completed' ? 'check-circle' : 'circle-off'} size={18} />
					</div>
					<div>
						<p class="text-sm font-semibold text-foreground">
							Admin onboarding checklist {hiddenReason}
						</p>
						<p class="text-sm text-muted-foreground">
							Reset it any time if you want the guided recovery and setup links back on the
							dashboard.
						</p>
					</div>
				</div>
				<Button variant="outline" onclick={resetChecklist} disabled={isSaving}>
					<Icon name="rotate-ccw" size={16} class="mr-2" />
					Reset checklist
				</Button>
			</div>
		</div>
	{:else}
		<section
			class="overflow-hidden rounded-[2rem] border border-border bg-card/90 shadow-sm backdrop-blur-xl"
			aria-labelledby="admin-onboarding-title"
		>
			<div class="border-b border-border/60 px-6 py-5 md:px-8">
				<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<div class="flex items-start gap-4">
						<div
							class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
						>
							<Icon name="settings" size={22} />
						</div>
						<div>
							<p class="text-[11px] font-black tracking-[0.24em] text-primary uppercase">
								Admin Onboarding
							</p>
							<h2 id="admin-onboarding-title" class="mt-1 text-xl font-bold text-foreground">
								Finish the critical setup path
							</h2>
							<p class="mt-2 max-w-2xl text-sm text-muted-foreground">
								These actions stay visible until you explicitly complete them or dismiss the
								checklist for this account.
							</p>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<div class="rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
							{completedItems.length} / {ADMIN_ONBOARDING_CHECKLIST_ITEMS.length} complete
						</div>
						<Button variant="ghost" onclick={dismissChecklist} disabled={isSaving}>
							Dismiss
						</Button>
					</div>
				</div>
			</div>

			<div class="grid gap-4 p-6 md:p-8 xl:grid-cols-2">
				{#each ADMIN_ONBOARDING_CHECKLIST_ITEMS as item (item.id)}
					<div
						class="rounded-[1.5rem] border px-5 py-4 transition-colors {completedSet.has(item.id)
							? 'border-emerald-500/30 bg-emerald-500/5'
							: 'border-border bg-background/40'}"
					>
						<div class="flex h-full flex-col gap-4">
							<div class="flex items-start gap-3">
								<div
									class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl border {completedSet.has(item.id)
										? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
										: 'border-border bg-card text-muted-foreground'}"
								>
									<Icon
										name={completedSet.has(item.id) ? 'check' : 'arrow-right'}
										size={18}
									/>
								</div>
								<div class="min-w-0">
									<h3 class="font-semibold text-foreground">{item.title}</h3>
									<p class="mt-1 text-sm text-muted-foreground">{item.description}</p>
								</div>
							</div>

							<div class="mt-auto flex flex-wrap items-center gap-2">
								<a
									href={item.href}
									data-sveltekit-preload-data="hover"
									class="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
								>
									Open
									<Icon name="arrow-right" size={15} />
								</a>
								<Button
									variant={completedSet.has(item.id) ? 'outline' : 'secondary'}
									onclick={() => toggleChecklistItem(item.id)}
									disabled={isSaving}
									aria-pressed={completedSet.has(item.id)}
								>
									{completedSet.has(item.id) ? 'Mark incomplete' : 'Mark complete'}
								</Button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
{/if}
