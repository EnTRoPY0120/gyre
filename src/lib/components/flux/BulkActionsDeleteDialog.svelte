<script lang="ts">
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';

	let {
		open = $bindable(),
		selectedCount,
		onConfirm
	}: {
		open: boolean;
		selectedCount: number;
		onConfirm: () => void | Promise<void>;
	} = $props();
</script>

<AlertDialog bind:open>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>Delete {selectedCount} resource(s)?</AlertDialogTitle>
			<AlertDialogDescription>
				This action cannot be undone. This will permanently delete the selected FluxCD resources from
				your cluster.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>Cancel</AlertDialogCancel>
			<AlertDialogAction onclick={onConfirm}>Delete</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
