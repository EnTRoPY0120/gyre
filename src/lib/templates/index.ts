import type { ResourceTemplate } from './types.js';
import { GIT_REPOSITORY_TEMPLATE } from './git-repository.js';
import { HELM_REPOSITORY_TEMPLATE } from './helm-repository.js';
import { HELM_CHART_TEMPLATE } from './helm-chart.js';
import { BUCKET_TEMPLATE } from './bucket.js';
import { OCI_REPOSITORY_TEMPLATE } from './oci-repository.js';
import { KUSTOMIZATION_TEMPLATE } from './kustomization.js';
import { HELM_RELEASE_TEMPLATE } from './helm-release.js';
import { ALERT_TEMPLATE } from './alert.js';
import { PROVIDER_TEMPLATE } from './provider.js';
import { RECEIVER_TEMPLATE } from './receiver.js';
import { IMAGE_REPOSITORY_TEMPLATE } from './image-repository.js';
import { IMAGE_POLICY_TEMPLATE } from './image-policy.js';
import { IMAGE_UPDATE_AUTOMATION_TEMPLATE } from './image-update-automation.js';

export * from './types.js';
export { GIT_REPOSITORY_TEMPLATE } from './git-repository.js';
export { HELM_REPOSITORY_TEMPLATE } from './helm-repository.js';
export { KUSTOMIZATION_TEMPLATE } from './kustomization.js';
export { HELM_RELEASE_TEMPLATE } from './helm-release.js';
export { HELM_CHART_TEMPLATE } from './helm-chart.js';
export { BUCKET_TEMPLATE } from './bucket.js';
export { OCI_REPOSITORY_TEMPLATE } from './oci-repository.js';
export { ALERT_TEMPLATE } from './alert.js';
export { PROVIDER_TEMPLATE } from './provider.js';
export { RECEIVER_TEMPLATE } from './receiver.js';
export { IMAGE_REPOSITORY_TEMPLATE } from './image-repository.js';
export { IMAGE_POLICY_TEMPLATE } from './image-policy.js';
export { IMAGE_UPDATE_AUTOMATION_TEMPLATE } from './image-update-automation.js';

export const templates: ResourceTemplate[] = [
	GIT_REPOSITORY_TEMPLATE,
	HELM_REPOSITORY_TEMPLATE,
	HELM_CHART_TEMPLATE,
	BUCKET_TEMPLATE,
	OCI_REPOSITORY_TEMPLATE,
	KUSTOMIZATION_TEMPLATE,
	HELM_RELEASE_TEMPLATE,
	ALERT_TEMPLATE,
	PROVIDER_TEMPLATE,
	RECEIVER_TEMPLATE,
	IMAGE_REPOSITORY_TEMPLATE,
	IMAGE_POLICY_TEMPLATE,
	IMAGE_UPDATE_AUTOMATION_TEMPLATE
];

export function getPluralByKind(kind: string): string | undefined {
	return templates.find((t) => t.kind === kind)?.plural;
}
