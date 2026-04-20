import { z } from '$lib/server/openapi';
import type { UserPreferences } from '$lib/types/user';
import { ADMIN_ONBOARDING_CHECKLIST_IDS } from '$lib/user-preferences';

export const notificationPreferencesSchema = z
	.object({
		enabled: z.boolean().optional(),
		resourceTypes: z.array(z.string()).optional(),
		namespaces: z.array(z.string()).optional(),
		events: z.array(z.enum(['success', 'failure', 'warning', 'info', 'error'])).optional()
	})
	.optional();

export const onboardingPreferencesSchema = z
	.object({
		// Legacy compatibility fields retained for existing stored preferences.
		adminChecklistDismissed: z.boolean().optional(),
		adminChecklistCompletedItems: z.array(z.enum(ADMIN_ONBOARDING_CHECKLIST_IDS)).optional()
	})
	.optional();

export const preferencesSchema = z.object({
	theme: z.enum(['light', 'dark', 'system']).optional(),
	notifications: notificationPreferencesSchema,
	onboarding: onboardingPreferencesSchema
});

export function mergeUserPreferences(
	existingPreferences: UserPreferences = {},
	newPreferences: Partial<UserPreferences>
): UserPreferences {
	const notifications =
		existingPreferences.notifications || newPreferences.notifications
			? {
					...existingPreferences.notifications,
					...newPreferences.notifications
				}
			: undefined;

	const onboarding =
		existingPreferences.onboarding || newPreferences.onboarding
			? {
					...existingPreferences.onboarding,
					...newPreferences.onboarding
				}
			: undefined;

	return {
		...existingPreferences,
		...newPreferences,
		...(notifications ? { notifications } : {}),
		...(onboarding ? { onboarding } : {})
	};
}
