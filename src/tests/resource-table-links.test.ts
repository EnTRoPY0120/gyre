import { mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false, dev: false }));
vi.mock('$env/dynamic/public', () => ({ env: {} }));
import ResourceTable from '../lib/components/flux/ResourceTable.svelte';
import type { FluxResource } from '../lib/types/flux';
import { preferences } from '../lib/stores/preferences.svelte';

class TestResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

const mounted: Array<ReturnType<typeof mount>> = [];

beforeEach(() => {
	vi.stubGlobal('ResizeObserver', TestResizeObserver);
	// jsdom has no layout; give the table deterministic row measurements for virtualization.
	vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(
		function (this: HTMLElement) {
			return this.parentElement ? Array.from(this.parentElement.children).indexOf(this) * 57 : 0;
		}
	);
});

afterEach(() => {
	for (const component of mounted.splice(0)) unmount(component);
	preferences.resetViewPrefs();
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function makeResources(count: number): FluxResource[] {
	return Array.from({ length: count }, (_, index) => ({
		apiVersion: 'source.toolkit.fluxcd.io/v1',
		kind: 'GitRepository',
		metadata: {
			uid: `resource-${index}`,
			name: `repo-${index}`,
			namespace: 'flux-system',
			creationTimestamp: '2026-01-01T00:00:00Z'
		},
		spec: {},
		status: { conditions: [] }
	}));
}

function renderTable(count: number, onRowClick: ReturnType<typeof vi.fn>) {
	const target = document.createElement('div');
	document.body.append(target);
	mounted.push(
		mount(ResourceTable, {
			target,
			props: {
				resources: makeResources(count),
				getResourceUrl: (resource: FluxResource) =>
					`/base/resources/gitrepositories/${resource.metadata.namespace}/${resource.metadata.name}`,
				onRowClick
			}
		})
	);
	return target;
}

describe('resource table detail links', () => {
	test('renders navigable anchors and leaves anchor, modifier, and checkbox interaction alone', async () => {
		preferences.setItemsPerPage(10);
		const onRowClick = vi.fn();
		const target = renderTable(11, onRowClick);
		await tick();

		const firstLink = target.querySelector<HTMLAnchorElement>(
			'a[href="/base/resources/gitrepositories/flux-system/repo-0"]'
		);
		expect(firstLink?.textContent?.trim()).toBe('repo-0');
		expect(firstLink?.tabIndex).toBe(0);
		const row = target.querySelector<HTMLTableRowElement>('tr.group');
		row
			?.querySelector('td:nth-child(2)')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(onRowClick).toHaveBeenCalledTimes(1);
		firstLink?.dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })
		);
		expect(onRowClick).toHaveBeenCalledTimes(1);

		const checkbox = row?.querySelector<HTMLInputElement>('input[type="checkbox"]');
		checkbox?.click();
		await tick();
		expect(onRowClick).toHaveBeenCalledTimes(1);

		target.querySelector<HTMLButtonElement>('[aria-label="Next page"]')?.click();
		await tick();
		expect(target.querySelector('a[href$="repo-10"]')).not.toBeNull();
	});

	test('renders detail links for virtualized rows as the list scrolls', async () => {
		const target = renderTable(40, vi.fn());
		Array.from(target.querySelectorAll<HTMLButtonElement>('button'))
			.find((button) => button.textContent?.trim() === 'All')
			?.click();
		await tick();
		const scrollContainer = target.querySelector<HTMLElement>('div.scrollbar-thin');
		expect(target.querySelector('a[href$="repo-0"]')).not.toBeNull();
		expect(scrollContainer).not.toBeNull();
		if (!scrollContainer) throw new Error('Resource table scroll container did not render');
		scrollContainer.scrollTop = 1200;
		scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
		await tick();
		expect(target.querySelector('a[href$="repo-20"]')).not.toBeNull();
	});
});
