import { logger } from '$lib/server/logger.js';
import { error } from '@sveltejs/kit';
import { getFluxResource, getKubeConfig, type ReqCache } from '$lib/server/kubernetes/client';
import { validateFluxArtifactUrl } from '$lib/server/kubernetes/flux/artifact-url-security';
import { FLUX_RESOURCES, type FluxResourceType } from '$lib/server/kubernetes/flux/resources';
import type { FluxResource } from '$lib/server/kubernetes/flux/types';
import * as k8s from '@kubernetes/client-node';
import * as yaml from 'js-yaml';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface FluxDiffEntry {
	kind: string;
	name: string;
	namespace: string;
	desired: string;
	live: string | null;
	error?: string;
}

export interface FluxResourceDiffResult {
	diffs: FluxDiffEntry[];
	timestamp: number;
	revision?: string | null;
}

interface SourceRef {
	kind: string;
	name: string;
	namespace?: string;
}

export interface RunFluxResourceDiffParams {
	clusterId: string | undefined;
	fluxNamespace: string;
	name: string;
	namespace: string;
	reqCache?: ReqCache;
	resourceType: FluxResourceType;
}

export function getDiffCacheControl(forceRefresh: boolean): string {
	return forceRefresh ? 'no-store, private' : 'max-age=60, private';
}

export function assertKustomizationSourceRef(resource: FluxResource): SourceRef {
	const sourceRef = resource.spec?.sourceRef;
	if (!sourceRef || typeof sourceRef !== 'object') {
		throw error(400, { message: 'Kustomization has no sourceRef', code: 'BadRequest' });
	}

	const ref = sourceRef as Partial<SourceRef>;
	if (typeof ref.kind !== 'string' || typeof ref.name !== 'string') {
		throw error(400, { message: 'Kustomization has no sourceRef', code: 'BadRequest' });
	}

	return {
		kind: ref.kind,
		name: ref.name,
		namespace: typeof ref.namespace === 'string' ? ref.namespace : undefined
	};
}

export function assertReadySourceArtifact(
	source: FluxResource,
	sourceRef: SourceRef,
	fluxNamespace: string
) {
	const sourceReadyCondition = source.status?.conditions?.find(
		(condition) => condition.type === 'Ready'
	);
	if (!sourceReadyCondition || sourceReadyCondition.status !== 'True') {
		const reason = sourceReadyCondition?.reason || 'Unknown';
		const message = sourceReadyCondition?.message || '';
		const detail = sourceReadyCondition
			? `(${reason}: ${message})`
			: '(Ready condition not yet reported — reconciliation may be pending)';
		throw error(400, {
			message:
				`Source ${sourceRef.kind}/${sourceRef.name} is not ready ${detail}. ` +
				'Wait for the source to reconcile successfully before checking drift.',
			code: 'BadRequest'
		});
	}

	const artifactUrl = source.status?.artifact?.url;
	if (!artifactUrl) {
		throw error(400, {
			message:
				`Source ${sourceRef.kind}/${sourceRef.name} has no artifact URL. ` +
				'Ensure the source is ready and has reconciled successfully.',
			code: 'BadRequest'
		});
	}

	try {
		return validateFluxArtifactUrl(artifactUrl, fluxNamespace);
	} catch (artifactUrlError) {
		logger.warn(
			{ error: (artifactUrlError as Error).message, url: artifactUrl },
			'Rejected untrusted Flux artifact URL'
		);
		throw error(400, {
			message: 'Source artifact URL is not trusted',
			code: 'BadRequest'
		});
	}
}

export function validateKustomizationArtifactPath(tempDir: string, specPath: unknown): string {
	const path = typeof specPath === 'string' && specPath ? specPath : './';
	if (path.startsWith('/') || path.includes('..')) {
		throw new Error(`Invalid path: ${path}. Path must be relative and cannot contain ".."`);
	}

	const kustomizePath = join(tempDir, path);
	if (!kustomizePath.startsWith(tempDir)) {
		throw new Error(`Path traversal detected: ${path}`);
	}

	return kustomizePath;
}

export function cleanDiffObject(obj: unknown): unknown {
	if (!obj) return null;
	const cleaned = JSON.parse(JSON.stringify(obj));
	if (cleaned.metadata) {
		const metadataFields = [
			'managedFields',
			'generation',
			'resourceVersion',
			'uid',
			'creationTimestamp',
			'selfLink'
		];
		for (const field of metadataFields) {
			delete cleaned.metadata[field];
		}

		if (cleaned.metadata.annotations) {
			const annotationFields = [
				'kubectl.kubernetes.io/last-applied-configuration',
				'deployment.kubernetes.io/revision',
				'kustomize.toolkit.fluxcd.io/reconcile'
			];
			for (const annotation of annotationFields) {
				delete cleaned.metadata.annotations[annotation];
			}
			if (Object.keys(cleaned.metadata.annotations).length === 0) {
				delete cleaned.metadata.annotations;
			}
		}

		if (cleaned.metadata.labels) {
			delete cleaned.metadata.labels['kustomize.toolkit.fluxcd.io/name'];
			delete cleaned.metadata.labels['kustomize.toolkit.fluxcd.io/namespace'];
			if (Object.keys(cleaned.metadata.labels).length === 0) {
				delete cleaned.metadata.labels;
			}
		}
	}
	delete cleaned.status;
	return cleaned;
}

function pluralForKind(kind: string): string {
	const fluxDefs = Object.values(FLUX_RESOURCES) as Array<{ kind: string; plural: string }>;
	const fluxDef = fluxDefs.find((resource) => resource.kind === kind);
	if (fluxDef) return fluxDef.plural;

	let plural = `${kind.toLowerCase()}s`;
	if (kind.toLowerCase().endsWith('y')) plural = `${kind.toLowerCase().slice(0, -1)}ies`;
	else if (kind.toLowerCase().endsWith('s')) plural = `${kind.toLowerCase()}es`;
	if (kind === 'Ingress') plural = 'ingresses';
	if (kind === 'Endpoints') plural = 'endpoints';
	return plural;
}

export async function downloadArtifact(url: string, timeoutMs = 15000): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const parsedUrl = new URL(url);
		const client = parsedUrl.protocol === 'https:' ? https : http;
		const chunks: Buffer[] = [];
		let totalBytes = 0;

		const request = client.get(
			url,
			{
				timeout: timeoutMs,
				headers: {
					Accept: 'application/gzip, application/x-gzip, application/x-tar',
					'User-Agent': 'gyre-drift-detector'
				}
			},
			(response) => {
				if (response.statusCode !== 200) {
					let errorBody = '';
					response.on('data', (chunk) => {
						errorBody += chunk.toString();
					});
					response.on('end', () => {
						reject(
							new Error(
								`HTTP ${response.statusCode}: ${response.statusMessage}. Body: ${errorBody.slice(0, 200)}`
							)
						);
					});
					return;
				}

				response.on('data', (chunk: Buffer) => {
					chunks.push(chunk);
					totalBytes += chunk.length;
					if (totalBytes > 100 * 1024 * 1024) {
						request.destroy();
						reject(new Error('Artifact too large (>100MB)'));
					}
				});
				response.on('end', () => resolve(Buffer.concat(chunks)));
				response.on('error', reject);
			}
		);

		request.on('error', reject);
		request.on('timeout', () => {
			request.destroy();
			reject(new Error(`Request timeout after ${timeoutMs}ms`));
		});
	});
}

async function fetchArtifactViaKubernetes(params: {
	clusterId: string | undefined;
	fluxNamespace: string;
	reqCache: ReqCache;
	trustedPathname: string;
}): Promise<Buffer> {
	const config = await getKubeConfig(params.clusterId, params.reqCache);
	const coreApi = config.makeApiClient(k8s.CoreV1Api);
	const pods = await coreApi.listNamespacedPod({
		namespace: params.fluxNamespace,
		labelSelector: 'app=source-controller'
	});

	if (!pods.items || pods.items.length === 0) {
		throw new Error(`No source-controller pod found in ${params.fluxNamespace} namespace`);
	}

	const podName = pods.items[0].metadata?.name;
	if (!podName) {
		throw new Error('source-controller pod has no name');
	}

	logger.info({ podName }, 'Using source-controller pod');
	const proxyResponse = await coreApi.connectGetNamespacedPodProxy({
		name: `${podName}:9090`,
		namespace: params.fluxNamespace,
		path: params.trustedPathname
	});

	const buffer = Buffer.isBuffer(proxyResponse)
		? proxyResponse
		: Buffer.from(proxyResponse as string, 'binary');

	logger.info({ bytes: buffer.length }, 'K8s pod proxy fetch successful');
	return buffer;
}

async function fetchArtifactWithFallback(params: {
	artifactUrl: string;
	clusterId: string | undefined;
	fluxNamespace: string;
	reqCache: ReqCache;
	sourceNamespace: string;
	sourceRef: SourceRef;
	trustedPathname: string;
}): Promise<Buffer> {
	try {
		const buffer = await downloadArtifact(params.artifactUrl);
		logger.info({ bytes: buffer.length }, 'Artifact download successful');
		return buffer;
	} catch (downloadErr) {
		logger.info({ error: (downloadErr as Error).message }, 'HTTP download failed, trying fallback');

		try {
			return await fetchArtifactViaKubernetes(params);
		} catch (execErr) {
			throw new Error(
				`All fetch methods failed. ` +
					`Direct HTTP: ${(downloadErr as Error).message}. ` +
					`K8s proxy: ${(execErr as Error).message}. ` +
					`\n\nTroubleshooting:\n` +
					`1. Check source-controller is running: kubectl get pod -n ${params.fluxNamespace} -l app=source-controller\n` +
					`2. Verify artifact exists: kubectl get gitrepo -n ${params.sourceNamespace} ${params.sourceRef.name} -o jsonpath='{.status.artifact.url}'\n` +
					`3. Test artifact URL manually: kubectl port-forward -n ${params.fluxNamespace} svc/source-controller 9090:80 && curl http://localhost:9090${params.trustedPathname}`
			);
		}
	}
}

async function extractArtifact(tempDir: string, buffer: Buffer): Promise<void> {
	if (buffer.length < 2) {
		throw new Error(`Downloaded content too small (${buffer.length} bytes)`);
	}

	if (buffer[0] !== 0x1f || buffer[1] !== 0x8b) {
		const text = buffer.toString('utf-8', 0, Math.min(500, buffer.length));
		throw new Error(
			`Downloaded content is not a gzip archive (magic bytes: 0x${buffer[0]?.toString(16)} 0x${buffer[1]?.toString(16)}). ` +
				`Content preview: ${text}`
		);
	}

	const artifactPath = join(tempDir, 'artifact.tar.gz');
	await writeFile(artifactPath, buffer);

	try {
		await execFileAsync('tar', ['-tzf', artifactPath], {
			timeout: 5000,
			maxBuffer: 50 * 1024 * 1024
		});
		logger.info('✓ Tarball validation passed');
	} catch (tarCheckErr) {
		throw new Error(
			`Downloaded file is not a valid tar.gz archive: ${(tarCheckErr as Error).message}`
		);
	}

	await execFileAsync('tar', ['-C', tempDir, '-xzf', artifactPath], {
		timeout: 30000,
		maxBuffer: 50 * 1024 * 1024
	});
	logger.info('✓ Source artifact extracted successfully');
}

async function buildKustomization(tempDir: string, specPath: unknown): Promise<string> {
	const kustomizePath = validateKustomizationArtifactPath(tempDir, specPath);
	logger.info({ path: kustomizePath }, 'Running kustomize build');
	const { stdout } = await execFileAsync('kustomize', ['build', kustomizePath], {
		timeout: 30000,
		maxBuffer: 10 * 1024 * 1024
	});
	logger.info({ bytes: stdout.length }, 'Kustomize build completed');
	return stdout;
}

async function compareDesiredResources(params: {
	buildOutput: string;
	clusterId: string | undefined;
	namespace: string;
	reqCache: ReqCache;
	spec: Record<string, unknown>;
}): Promise<FluxDiffEntry[]> {
	const desiredResources = yaml.loadAll(params.buildOutput) as Array<Record<string, unknown>>;
	const config = await getKubeConfig(params.clusterId, params.reqCache);
	const customApi = config.makeApiClient(k8s.CustomObjectsApi);

	const diffs = await Promise.all(
		desiredResources.map((desired) => compareDesiredResource(desired, params, customApi))
	);

	return diffs.filter((diff): diff is FluxDiffEntry => diff !== null);
}

type DesiredResourceComparison = {
	kind: string;
	name: string;
	namespace: string;
	group: string;
	version: string;
	plural: string;
};

function getDesiredResourceComparison(
	desired: Record<string, unknown>,
	params: { namespace: string; spec: Record<string, unknown> }
): DesiredResourceComparison | null {
	if (!desired || !desired.kind || !desired.metadata) return null;

	const kind = desired.kind as string;
	const metadata = desired.metadata as { name: string; namespace?: string };
	const apiVersion = desired.apiVersion as string;
	const [group, version] = apiVersion.includes('/') ? apiVersion.split('/') : ['', apiVersion];
	return {
		kind,
		name: metadata.name,
		namespace: metadata.namespace || (params.spec.targetNamespace as string) || params.namespace,
		group,
		version,
		plural: pluralForKind(kind)
	};
}

async function getLiveResource(
	customApi: k8s.CustomObjectsApi,
	comparison: DesiredResourceComparison
): Promise<unknown | null> {
	try {
		return await customApi.getNamespacedCustomObject({
			group: comparison.group,
			version: comparison.version,
			namespace: comparison.namespace,
			plural: comparison.plural,
			name: comparison.name
		});
	} catch {
		return null;
	}
}

async function getDryRunResource(
	customApi: k8s.CustomObjectsApi,
	comparison: DesiredResourceComparison,
	desired: Record<string, unknown>
): Promise<unknown> {
	try {
		return await customApi.patchNamespacedCustomObject(
			{
				group: comparison.group,
				version: comparison.version,
				namespace: comparison.namespace,
				plural: comparison.plural,
				name: comparison.name,
				body: desired as object,
				dryRun: 'All',
				fieldManager: 'gyre-drift-check',
				force: true
			},
			{
				headers: { 'Content-Type': 'application/apply-patch+yaml' }
			} as Record<string, unknown>
		);
	} catch {
		return desired;
	}
}

async function compareDesiredResource(
	desired: Record<string, unknown>,
	params: { namespace: string; spec: Record<string, unknown> },
	customApi: k8s.CustomObjectsApi
): Promise<FluxDiffEntry | null> {
	const comparison = getDesiredResourceComparison(desired, params);
	if (!comparison) return null;

	try {
		const [liveState, dryRunState] = await Promise.all([
			getLiveResource(customApi, comparison),
			getDryRunResource(customApi, comparison, desired)
		]);
		return {
			kind: comparison.kind,
			name: comparison.name,
			namespace: comparison.namespace,
			desired: yaml.dump(cleanDiffObject(dryRunState)),
			live: liveState ? yaml.dump(cleanDiffObject(liveState)) : null
		};
	} catch (err) {
		logger.error(err, 'Error diffing resource', { kind: comparison.kind, name: comparison.name });
		return {
			kind: comparison.kind,
			name: comparison.name,
			namespace: comparison.namespace,
			desired: yaml.dump(desired),
			live: null,
			error: (err as Error).message
		};
	}
}

export async function runFluxResourceDiff({
	clusterId,
	fluxNamespace,
	name,
	namespace,
	reqCache = new Map(),
	resourceType
}: RunFluxResourceDiffParams): Promise<FluxResourceDiffResult> {
	const kustomization = (await getFluxResource(
		resourceType,
		namespace,
		name,
		clusterId,
		reqCache
	)) as FluxResource;
	const sourceRef = assertKustomizationSourceRef(kustomization);
	const spec = kustomization.spec ?? {};
	const currentRevision = kustomization.status?.lastAppliedRevision;
	const sourceNamespace = sourceRef.namespace || namespace;

	const source = (await getFluxResource(
		sourceRef.kind as FluxResourceType,
		sourceNamespace,
		sourceRef.name,
		clusterId,
		reqCache
	)) as FluxResource;
	const trustedArtifactUrl = assertReadySourceArtifact(source, sourceRef, fluxNamespace);
	const tempDir = await mkdtemp(join(tmpdir(), 'gyre-diff-'));

	try {
		logger.info({ url: trustedArtifactUrl.url }, 'Fetching artifact');
		const buffer = await fetchArtifactWithFallback({
			artifactUrl: trustedArtifactUrl.url,
			clusterId,
			fluxNamespace,
			reqCache,
			sourceNamespace,
			sourceRef,
			trustedPathname: trustedArtifactUrl.pathname
		});
		await extractArtifact(tempDir, buffer);
		const buildOutput = await buildKustomization(tempDir, spec.path);
		const diffs = await compareDesiredResources({
			buildOutput,
			clusterId,
			namespace,
			reqCache,
			spec
		});

		return {
			diffs,
			timestamp: Date.now(),
			revision: currentRevision
		};
	} finally {
		await rm(tempDir, { recursive: true, force: true }).catch((cleanupErr) => {
			logger.warn({ error: String(cleanupErr) }, 'Failed to cleanup temp dir');
		});
	}
}
