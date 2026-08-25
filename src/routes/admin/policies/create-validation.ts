import { isValidNamespacePattern } from '$lib/server/rbac';

export interface PolicyCreateInput {
	name: string;
	role: string;
	action: string;
	namespacePattern: string;
}

/** Validate the fields accepted by the admin policy-create action. */
export function validatePolicyCreateInput(input: PolicyCreateInput): string | null {
	const { name, role, action, namespacePattern } = input;

	if (!name || !role || !action) {
		return 'Name, role, and action are required';
	}

	if (name.length < 3) {
		return 'Policy name must be at least 3 characters';
	}

	if (name.length > 100) {
		return 'Policy name must be at most 100 characters';
	}

	if (namespacePattern && !isValidNamespacePattern(namespacePattern)) {
		return 'Invalid namespace pattern: must contain only lowercase alphanumeric characters, hyphens, and wildcards (* ?)';
	}

	return null;
}
