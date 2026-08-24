<script lang="ts">
	import SidebarCreateResourceDisabled from './SidebarCreateResourceDisabled.svelte';
	import SidebarCreateResourceLink from './SidebarCreateResourceLink.svelte';

	let {
		isOpen,
		canCreate,
		onCloseMobile,
		currentPath
	}: {
		isOpen: boolean;
		canCreate: boolean;
		onCloseMobile: () => void;
		currentPath: string;
	} = $props();
</script>

{#if canCreate}
	<SidebarCreateResourceLink {isOpen} {currentPath} {onCloseMobile} />
{:else}
	<SidebarCreateResourceDisabled {isOpen} />
{/if}
