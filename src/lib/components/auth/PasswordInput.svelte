<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';

	let {
		id,
		label,
		value = $bindable('')
	}: {
		id: string;
		label: string;
		value: string;
	} = $props();

	let visible = $state(false);
</script>

<div class="field">
	<label for={id}>{label}</label>
	<div class="password-wrap">
		<input
			{id}
			type={visible ? 'text' : 'password'}
			bind:value
			placeholder="••••••••"
			required
		/>
		<button
			type="button"
			onclick={() => (visible = !visible)}
			class="eye-toggle"
			aria-label={visible ? 'Hide password' : 'Show password'}
		>
			{#if visible}
				<EyeOff size={16} />
			{:else}
				<Eye size={16} />
			{/if}
		</button>
	</div>
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.field label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.6);
		letter-spacing: 0.01em;
	}

	.field input {
		width: 100%;
		padding: 0.625rem 0.875rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.5rem;
		color: #fff;
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
		box-sizing: border-box;
	}

	.field input::placeholder {
		color: rgba(255, 255, 255, 0.2);
	}

	.field input:focus {
		border-color: rgba(251, 191, 36, 0.5);
		box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.08);
	}

	.password-wrap {
		position: relative;
	}

	.password-wrap input {
		padding-right: 2.5rem;
	}

	.eye-toggle {
		position: absolute;
		top: 50%;
		right: 0.75rem;
		transform: translateY(-50%);
		background: none;
		border: none;
		cursor: pointer;
		color: rgba(255, 255, 255, 0.3);
		display: flex;
		align-items: center;
		padding: 0;
		transition: color 0.15s ease;
	}

	.eye-toggle:hover {
		color: rgba(255, 255, 255, 0.6);
	}

	input:-webkit-autofill,
	input:-webkit-autofill:hover,
	input:-webkit-autofill:focus,
	input:-webkit-autofill:active {
		-webkit-box-shadow: 0 0 0 30px #111114 inset !important;
		-webkit-text-fill-color: #fff !important;
		transition: background-color 5000s ease-in-out 0s;
	}
</style>
