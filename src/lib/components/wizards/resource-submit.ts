export interface CreatedResource {
	metadata?: { namespace?: string; name?: string };
}

const K8S_NAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function getWizardResourceRedirect(plural: string, resource: CreatedResource): string {
	const namespace = resource.metadata?.namespace;
	const name = resource.metadata?.name;
	if (namespace && name && K8S_NAME_RE.test(namespace) && K8S_NAME_RE.test(name)) {
		return `/resources/${plural}/${namespace}/${name}`;
	}

	return `/resources/${plural}`;
}

/** Create a resource from the wizard manifest and normalize API failures. */
export async function createResourceFromWizard(
	plural: string,
	manifest: Record<string, unknown>,
	csrfToken: string,
	fetcher: typeof fetch = fetch
): Promise<CreatedResource> {
	const response = await fetcher(`/api/v1/flux/${plural}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
		body: JSON.stringify(manifest)
	});

	if (!response.ok) {
		const data = (await response.json().catch(() => null)) as { message?: unknown } | null;
		const message = typeof data?.message === 'string' ? data.message : 'Failed to create resource';
		throw new Error(message);
	}

	return (await response.json()) as CreatedResource;
}
