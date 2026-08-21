<script lang="ts">
	import { Check, X } from '@lucide/svelte';

	let { password }: { password: string } = $props();

	const requirements = $derived([
		{ label: '8+ characters', met: password.length >= 8 },
		{ label: 'Uppercase letter', met: /[A-Z]/.test(password) },
		{ label: 'Lowercase letter', met: /[a-z]/.test(password) },
		{ label: 'Number', met: /[0-9]/.test(password) },
		{ label: 'Special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) }
	]);

	const score = $derived(requirements.filter((requirement) => requirement.met).length);
	const color = $derived.by(() => {
		if (score <= 2) return 'bg-red-500';
		if (score <= 4) return 'bg-amber-500';
		return 'bg-emerald-500';
	});

	const text = $derived.by(() => {
		if (score === 0) return 'Very Weak';
		if (score <= 2) return 'Weak';
		if (score <= 4) return 'Medium';
		return 'Strong';
	});
</script>

{#if password.length > 0}
	<div class="strength-indicator">
		<div class="strength-header">
			<span>Strength: {text}</span>
			<span class={score >= 4 ? 'text-emerald-400' : 'text-slate-500'}>{score}/5</span>
		</div>
		<div class="strength-bars">
			{#each Array(5) as _, i (i)}
				<div class="strength-bar {i < score ? color : 'bg-slate-700'}"></div>
			{/each}
		</div>
		<div class="requirements-list">
			{#each requirements as requirement (requirement.label)}
				<div class="requirement-item">
					{#if requirement.met}
						<div class="req-icon met"><Check size={10} /></div>
					{:else}
						<div class="req-icon unmet"><X size={10} /></div>
					{/if}
					<span class={requirement.met ? 'text-slate-300' : 'text-slate-500'}>
						{requirement.label}
					</span>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.strength-indicator {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.strength-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.4);
	}

	.strength-bars {
		display: flex;
		height: 4px;
		gap: 4px;
	}

	.strength-bar {
		flex: 1;
		border-radius: 99px;
		transition: background-color 0.5s ease;
	}

	.requirements-list {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.25rem 1rem;
		margin-top: 0.25rem;
	}

	.requirement-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.requirement-item span {
		font-size: 0.625rem;
	}

	.req-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		border-radius: 99px;
	}

	.req-icon.met {
		background: rgba(16, 185, 129, 0.2);
		color: #10b981;
	}

	.req-icon.unmet {
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.4);
	}
</style>
