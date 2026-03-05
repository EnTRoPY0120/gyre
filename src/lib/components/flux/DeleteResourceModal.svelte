<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { AlertTriangle, Loader2 } from 'lucide-svelte';

	interface Props {
		open: boolean;
		resourceType: string;
		namespace: string;
		name: string;
		onClose: () => void;
	}

	let { open = $bindable(false), resourceType, namespace, name, onClose }: Props = $props();

	let confirmName = $state('');
	let isDeleting = $state(false);
	let error = $state<string | null>(null);

	const canConfirm = $derived(confirmName === name);

	$effect(() => {
		if (open) {
			confirmName = '';
			error = null;
		}
	});

	async function handleDelete() {
		if (!canConfirm) return;

		isDeleting = true;
		error = null;

		try {
			const response = await fetch(`/api/flux/${resourceType}/${namespace}/${name}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'Failed to delete resource');
			}

			open = false;
			await goto(`/resources/${resourceType}`);
		} catch (err) {
			error = (err as Error).message;
		} finally {
			isDeleting = false;
		}
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<div class="flex items-start gap-3">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
					<AlertTriangle class="h-5 w-5 text-red-500" />
				</div>
				<div class="flex-1">
					<AlertDialog.Title>Delete Resource?</AlertDialog.Title>
					<AlertDialog.Description>
						This will permanently delete <span class="font-medium text-foreground">{name}</span> from
						namespace <span class="font-medium text-foreground">{namespace}</span>. This action cannot
						be undone.
					</AlertDialog.Description>
				</div>
			</div>
		</AlertDialog.Header>

		<div class="px-1 py-2">
			<label class="mb-1.5 block text-sm font-medium" for="confirm-name">
				Type <span class="font-mono font-semibold">{name}</span> to confirm
			</label>
			<input
				id="confirm-name"
				type="text"
				bind:value={confirmName}
				placeholder={name}
				disabled={isDeleting}
				onkeydown={(e) => e.key === 'Enter' && canConfirm && handleDelete()}
				class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
			/>
			{#if error}
				<p role="alert" class="mt-2 text-sm text-red-600">{error}</p>
			{/if}
		</div>

		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={onClose} disabled={isDeleting}>Cancel</AlertDialog.Cancel>
			<Button
				variant="destructive"
				disabled={!canConfirm || isDeleting}
				onclick={handleDelete}
			>
				{#if isDeleting}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					Deleting...
				{:else}
					Delete
				{/if}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
