import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import LoginCredentialsForm from '../lib/components/auth/LoginCredentialsForm.svelte';
import PasswordChangeForm from '../lib/components/auth/PasswordChangeForm.svelte';
import PasswordInput from '../lib/components/auth/PasswordInput.svelte';

const mounted: Array<ReturnType<typeof mount>> = [];

afterEach(() => {
	for (const component of mounted.splice(0)) unmount(component);
	document.body.replaceChildren();
});

describe('password form DOM behavior', () => {
	test('PasswordInput exposes its label and error and toggles visibility', async () => {
		const target = document.createElement('div');
		document.body.append(target);
		mounted.push(
			mount(PasswordInput, {
				target,
				props: {
					id: 'password',
					label: 'Password',
					autocomplete: 'current-password',
					error: 'Password is required'
				}
			})
		);
		await tick();

		const input = target.querySelector<HTMLInputElement>('#password');
		expect(target.querySelector('label[for="password"]')?.textContent).toBe('Password');
		expect(input?.type).toBe('password');
		expect(input?.autocomplete).toBe('current-password');
		expect(input?.getAttribute('aria-invalid')).toBe('true');
		expect(target.querySelector('#password-error')?.textContent).toBe('Password is required');

		target.querySelector<HTMLButtonElement>('[aria-label="Show password"]')?.click();
		await tick();
		expect(input?.type).toBe('text');
		expect(target.querySelector('[aria-label="Hide password"]')).not.toBeNull();
	});

	test('login form preserves password autocomplete, validation, and loading state', async () => {
		const target = document.createElement('div');
		document.body.append(target);
		const onSubmit = vi.fn();
		mounted.push(
			mount(LoginCredentialsForm, {
				target,
				props: {
					username: '',
					password: '',
					errors: { password: 'Invalid password' },
					loading: true,
					onSubmit
				}
			})
		);
		await tick();

		const password = target.querySelector<HTMLInputElement>('#password');
		const submit = target.querySelector<HTMLButtonElement>('button[type="submit"]');
		expect(password?.autocomplete).toBe('current-password');
		expect(password?.getAttribute('aria-invalid')).toBe('true');
		expect(target.textContent).toContain('Invalid password');
		expect(submit?.disabled).toBe(true);
		expect(submit?.textContent).toContain('Signing in');
	});

	test('password-change form submits all three bound values', async () => {
		const target = document.createElement('div');
		document.body.append(target);
		const onSubmit = vi.fn();
		mounted.push(
			mount(PasswordChangeForm, {
				target,
				props: { isFirstLogin: false, onSubmit }
			})
		);
		await tick();

		const values = {
			currentPassword: 'current-secret',
			newPassword: 'new-secret',
			confirmPassword: 'new-secret'
		};
		for (const [id, value] of Object.entries(values)) {
			const input = target.querySelector<HTMLInputElement>(`#${id}`);
			expect(input).not.toBeNull();
			if (input) {
				input.value = value;
				input.dispatchEvent(new Event('input', { bubbles: true }));
			}
		}
		expect(target.querySelector<HTMLInputElement>('#currentPassword')?.autocomplete).toBe(
			'current-password'
		);
		expect(target.querySelector<HTMLInputElement>('#newPassword')?.autocomplete).toBe(
			'new-password'
		);
		expect(target.querySelector<HTMLInputElement>('#confirmPassword')?.autocomplete).toBe(
			'new-password'
		);

		const form = target.querySelector('form');
		form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		await tick();
		expect(onSubmit).toHaveBeenCalledWith(values);
	});
});
