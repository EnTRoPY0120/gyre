import { describe, expect, test } from 'bun:test';
import { mergeUserPreferences, preferencesSchema } from '../lib/server/user-preferences.js';

describe('preferencesSchema', () => {
	test('accepts onboarding fields', () => {
		const parsed = preferencesSchema.safeParse({
			onboarding: {
				adminChecklistDismissed: true,
				adminChecklistCompletedItems: ['clusters', 'settings']
			}
		});

		expect(parsed.success).toBe(true);
	});
});

describe('mergeUserPreferences', () => {
	test('merges onboarding updates without deleting existing preferences', () => {
		const merged = mergeUserPreferences(
			{
				theme: 'dark',
				notifications: {
					enabled: true,
					resourceTypes: ['GitRepository'],
					events: ['success']
				},
				onboarding: {
					adminChecklistCompletedItems: ['clusters']
				}
			},
			{
				onboarding: {
					adminChecklistDismissed: true,
					adminChecklistCompletedItems: ['clusters', 'settings']
				}
			}
		);

		expect(merged).toEqual({
			theme: 'dark',
			notifications: {
				enabled: true,
				resourceTypes: ['GitRepository'],
				events: ['success']
			},
			onboarding: {
				adminChecklistDismissed: true,
				adminChecklistCompletedItems: ['clusters', 'settings']
			}
		});
	});
});
