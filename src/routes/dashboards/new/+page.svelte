<script lang="ts">
	import { dashboardStore } from '$lib/stores/dashboards.svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { ArrowLeft, Save } from 'lucide-svelte';

	let name = $state('');
	let description = $state('');
	let isShared = $state(false);
	let isDefault = $state(false);
	let error = $state<string | null>(null);
	let saving = $state(false);

	async function handleSubmit() {
		if (!name) return;

		saving = true;
		error = null;

		try {
			const newDashboard = await dashboardStore.createDashboard({
				name,
				description,
				isShared,
				isDefault,
				layout: null
			});

			// Redirect to the new dashboard
			goto(`/dashboards/${newDashboard.id}`);
		} catch (err: any) {
			error = err.message;
		} finally {
			saving = false;
		}
	}
</script>

<div class="mx-auto max-w-2xl py-8">
	<div class="mb-8 flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/dashboards">
			<ArrowLeft class="size-4" />
		</Button>
		<h1 class="text-2xl font-bold">Create New Dashboard</h1>
	</div>

	<div class="rounded-xl border border-border bg-card p-6 shadow-sm">
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
			class="space-y-6"
		>
			<div class="space-y-2">
				<Label for="name">Name</Label>
				<Input id="name" bind:value={name} placeholder="e.g. Production Overview" required />
			</div>

			<div class="space-y-2">
				<Label for="description">Description</Label>
				<Textarea
					id="description"
					bind:value={description}
					placeholder="Describe the purpose of this dashboard"
					rows={3}
				/>
			</div>

			<div class="flex items-center space-x-2">
				<Checkbox id="shared" bind:checked={isShared} />
				<Label for="shared" class="cursor-pointer font-normal">
					Share with other users
					<span class="block text-xs text-muted-foreground"
						>Allow other users to view this dashboard</span
					>
				</Label>
			</div>

			{#if error}
				<div class="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
					{error}
				</div>
			{/if}

			<div class="flex justify-end gap-3 pt-4">
				<Button type="button" variant="outline" href="/dashboards">Cancel</Button>
				<Button type="submit" disabled={saving || !name}>
					{#if saving}
						Saving...
					{:else}
						<Save class="mr-2 size-4" />
						Create Dashboard
					{/if}
				</Button>
			</div>
		</form>
	</div>
</div>
