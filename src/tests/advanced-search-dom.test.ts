import { mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false, dev: false }));
vi.mock('$env/dynamic/public', () => ({ env: {} }));
import AdvancedSearch from '../lib/components/search/AdvancedSearch.svelte';
import ResourceListContent from '../routes/resources/[type]/ResourceListContent.svelte';
import { createAdvancedSearchFilterState } from './advanced-search-state.svelte';

const mounted: Array<ReturnType<typeof mount>> = [];

afterEach(() => {
	for (const component of mounted.splice(0)) unmount(component);
	document.body.replaceChildren();
});

describe('advanced resource search regex feedback', () => {
	test('does not show the no matches explanation while the active regex is invalid', async () => {
		const target = document.createElement('div');
		document.body.append(target);
		mounted.push(
			mount(ResourceListContent, {
				target,
				props: {
					resources: [],
					viewMode: 'table',
					showNamespace: true,
					hasActiveFilters: true,
					invalidSearch: true,
					onClearFilters: () => {},
					onResourceClick: () => {},
					getResourceUrl: () => '/resources'
				}
			})
		);
		await tick();
		expect(target.textContent).not.toContain('No resources match your filters');
		expect(target.textContent).not.toContain('Try adjusting your search or filter criteria');
	});

	test('announces malformed and unsafe patterns, then clears the error after correction', async () => {
		const target = document.createElement('div');
		document.body.append(target);
		const filters = createAdvancedSearchFilterState();
		mounted.push(mount(AdvancedSearch, { target, props: { filters } }));
		await tick();

		target.querySelector<HTMLButtonElement>('button[title="Advanced Search"]')?.click();
		await tick();
		target.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
			if (button.textContent?.trim() === 'Regex') button.click();
		});
		await tick();

		const input = target.querySelector<HTMLInputElement>('#resource-search');
		expect(input).not.toBeNull();
		if (!input) return;
		input.value = '[';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(input.getAttribute('aria-describedby')).toContain('resource-search-regex-error');
		expect(target.textContent).toContain('This regular expression is invalid.');

		input.value = '(a{1,})+';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(target.textContent).toContain('This pattern may cause performance issues.');

		input.value = '^nginx$';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(input.hasAttribute('aria-invalid')).toBe(false);
		expect(target.querySelector('#resource-search-regex-error')).toBeNull();
	});
});

test('removes every namespace alias, retains other filters, notifies the parent and focuses search', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const filters = createAdvancedSearchFilterState();
	filters.search = 'ns:old nginx namespace:default status:ready';
	const onSearch = vi.fn();
	mounted.push(mount(AdvancedSearch, { target, props: { filters, onSearch } }));
	await tick();
	const chip = target.querySelector<HTMLButtonElement>(
		'button[aria-label="Remove namespace filter: default"]'
	)!;
	expect(chip.type).toBe('button');
	chip.focus();
	chip.click();
	await tick();
	expect(filters.search).toBe('nginx status:ready');
	expect(onSearch).toHaveBeenLastCalledWith('nginx status:ready');
	expect(document.activeElement).toBe(target.querySelector('#resource-search'));
	expect(target.querySelectorAll('[aria-label="Query filters"] button')).toHaveLength(1);
});

test('uses the supplied debounced query for tag and regex validation and limits typing', async () => {
	const target = document.createElement('div');
	document.body.append(target);
	const filters = createAdvancedSearchFilterState();
	filters.search = '[';
	filters.useRegex = true;
	mounted.push(
		mount(AdvancedSearch, { target, props: { filters, validationSearch: 'status:invalid' } })
	);
	await tick();
	expect(target.textContent).toContain('Status must be');
	expect(target.textContent).not.toContain('regular expression is invalid');
	const input = target.querySelector<HTMLInputElement>('#resource-search')!;
	expect(input.maxLength).toBe(500);
	expect(input.getAttribute('aria-label')).toBe('Search resources');
	input.value = 'a'.repeat(600);
	input.dispatchEvent(new Event('input', { bubbles: true }));
	await tick();
	expect(filters.search).toHaveLength(500);
	expect(input.value).toHaveLength(500);
});
