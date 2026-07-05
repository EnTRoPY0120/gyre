<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone =
		| 'gray'
		| 'green'
		| 'blue'
		| 'red'
		| 'yellow'
		| 'cyan'
		| 'teal'
		| 'purple'
		| 'orange'
		| 'indigo'
		| 'violet'
		| 'emerald'
		| 'sky'
		| 'amber';

	interface Props {
		label: string;
		tone?: Tone;
		size?: 'xs' | 'sm';
		icon?: Snippet;
		class?: string;
	}

	let { label, tone = 'gray', size = 'xs', icon, class: className = '' }: Props = $props();

	const toneClasses: Record<Tone, string> = {
		gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
		green: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
		blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
		red: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
		yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
		cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300',
		teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300',
		purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
		orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
		indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
		violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300',
		emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
		sky: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
		amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
	};

	const sizeClasses = $derived(
		size === 'sm'
			? 'gap-1.5 px-2.5 py-1 text-sm'
			: icon
				? 'gap-1 px-2 py-1 text-xs'
				: 'px-2 py-0.5 text-xs'
	);
</script>

<span
	class="inline-flex items-center rounded-md font-medium {sizeClasses} {toneClasses[tone]} {className}"
>
	{#if icon}
		{@render icon()}
	{/if}
	{label}
</span>
