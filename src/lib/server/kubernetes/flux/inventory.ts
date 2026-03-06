/**
 * Parses a Flux inventory ID into Kubernetes resource coordinates.
 * Format: <namespace>_<name>_<group>_<kind>
 *
 * Examples:
 * - "default_my-service__Service" -> { namespace: "default", name: "my-service", group: "", kind: "Service", version: "" }
 * - "flux-system_source-controller_apps_Deployment" -> { namespace: "flux-system", name: "source-controller", group: "apps", kind: "Deployment", version: "" }
 */
export interface InventoryResource {
	id: string;
	namespace: string;
	name: string;
	group: string;
	kind: string;
	version: string;
}

export function parseInventory(
	entries: Array<{ id: string; v: string }> = []
): InventoryResource[] {
	return entries
		.map((entry) => {
			const parsed = parseInventoryId(entry.id);
			if (!parsed) return null;
			return { ...parsed, version: entry.v, id: entry.id };
		})
		.filter((r): r is InventoryResource => r !== null);
}

export function parseInventoryId(id: string): Omit<InventoryResource, 'version' | 'id'> | null {
	// Split by '_'
	// The problem is that namespace or name might contain underscores?
	// Actually, Kubernetes namespaces and names CANNOT contain underscores (DNS-1123).
	// So splitting by '_' is safe for valid K8s resources.

	const parts = id.split('_');
	if (parts.length < 4) return null;

	// The format is: namespace_name_group_kind
	// But wait, group can be empty (double underscore)

	// Let's look at the suffix. The last part is Kind. The second to last is Group.
	// Everything before that is namespace_name.
	// Since namespace/name can't have underscores, parts[0] is namespace, parts[1] is name?
	// NO. Flux inventory ID documentation says:
	// "The inventory ID is a concatenation of <namespace>_<name>_<group>_<kind>."
	// Since names/namespaces must be DNS protocols (hyphens allowed, underscores NOT allowed),
	// simply splitting by '_' should result in exactly 4 parts if group is present, or empty group part.

	// Example: default_redis__Service
	// parts = ["default", "redis", "", "Service"] -> length 4.

	// Example: default_redis_apps_Deployment
	// parts = ["default", "redis", "apps", "Deployment"] -> length 4.

	if (parts.length === 4) {
		return {
			namespace: parts[0],
			name: parts[1],
			group: parts[2],
			kind: parts[3]
		};
	}

	// Fallback? If somehow we have more parts (shouldn't happen with valid K8s names)
	// We can assume the last two are group/kind.
	const kind = parts.pop()!;
	const group = parts.pop()!;
	const name = parts.pop()!;
	const namespace = parts.join('_'); // This handles if namespace somehow had underscores (illegal but defensive)

	return { namespace, name, group, kind };
}
