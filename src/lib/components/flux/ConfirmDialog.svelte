<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { buttonVariants } from '$lib/components/ui/button';
	import { AlertTriangle, Info } from 'lucide-svelte';

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		variant = 'default',
		onConfirm
	}: {
		open: boolean;
		title: string;
		description: string;
		confirmLabel?: string;
		cancelLabel?: string;
		variant?: 'default' | 'destructive';
		onConfirm: () => void;
	} = $props();

	function handleConfirm() {
		onConfirm();
		open = false;
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<div class="flex items-start gap-3">
				{#if variant === 'destructive'}
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
						<AlertTriangle class="h-5 w-5 text-red-500" />
					</div>
				{:else}
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
						<Info class="h-5 w-5 text-blue-500" />
					</div>
				{/if}
				<div class="flex-1">
					<AlertDialog.Title>{title}</AlertDialog.Title>
					<AlertDialog.Description>
						{description}
					</AlertDialog.Description>
				</div>
			</div>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => (open = false)}>{cancelLabel}</AlertDialog.Cancel>
			<AlertDialog.Action class={buttonVariants({ variant })} onclick={handleConfirm}>
				{confirmLabel}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
