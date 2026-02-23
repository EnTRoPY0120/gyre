<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { invalidateAll } from '$app/navigation';
	import { resourceGroups } from '$lib/config/resources';

	// Helper to find primary route for a group name
	function getRoute(groupName: string, fallback: string): string {
		const group = resourceGroups.find((g) => g.name === groupName);
		return group?.primaryRoute ? `/resources/${group.primaryRoute}` : fallback;
	}
</script>

<!-- System Shortcuts -->
<div
	class="group relative overflow-hidden rounded-[2rem] border border-border bg-card/20 p-6 shadow-sm backdrop-blur-xl md:rounded-[2.5rem] md:p-10"
>
	<div
		class="absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-transparent to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100"
	></div>

	<div
		class="relative z-10 flex flex-col justify-between gap-6 md:gap-10 xl:flex-row xl:items-center"
	>
		<div>
			<h2 class="font-display text-2xl font-black tracking-tight text-foreground md:text-3xl">
				System Core
			</h2>
			<p class="mt-2 max-w-md text-sm font-medium text-muted-foreground">
				Immediate administrative access to cluster source controllers and orchestration engines.
			</p>
		</div>
		<div class="flex flex-wrap gap-3 md:gap-4">
			<a
				href={getRoute('Sources', '/resources/gitrepositories')}
				class="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-black tracking-widest text-primary-foreground uppercase shadow-2xl shadow-primary/20 transition-all hover:translate-y-[-4px] hover:shadow-primary/40 active:scale-95 md:gap-3 md:rounded-2xl md:px-8 md:py-4 md:text-sm"
			>
				<Icon name="git-branch" size={18} />
				Sources
			</a>
			<a
				href={getRoute('Kustomize', '/resources/kustomizations')}
				class="inline-flex items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar px-4 py-3 text-xs font-black tracking-widest text-foreground uppercase transition-all hover:translate-y-[-4px] hover:bg-muted active:scale-95 md:gap-3 md:rounded-2xl md:px-8 md:py-4 md:text-sm"
			>
				<Icon name="file-cog" size={18} />
				Kustomize
			</a>
			<a
				href={getRoute('Helm', '/resources/helmreleases')}
				class="inline-flex items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar px-4 py-3 text-xs font-black tracking-widest text-foreground uppercase transition-all hover:translate-y-[-4px] hover:bg-muted active:scale-95 md:gap-3 md:rounded-2xl md:px-8 md:py-4 md:text-sm"
			>
				<Icon name="ship" size={18} />
				Helm
			</a>
			<button
				type="button"
				class="group/btn inline-flex items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar px-4 py-3 text-xs font-black tracking-widest text-foreground uppercase transition-all hover:translate-y-[-4px] hover:bg-muted active:scale-95 md:gap-3 md:rounded-2xl md:px-8 md:py-4 md:text-sm"
				onclick={() => invalidateAll()}
			>
				<Icon
					name="refresh-cw"
					size={18}
					class="transition-transform duration-700 group-hover/btn:rotate-180"
				/>
				Sync
			</button>
		</div>
	</div>
</div>
