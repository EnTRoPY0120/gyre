export interface ClusterSummary {
	id: string;
	name: string;
	description: string | null;
	isActive: boolean;
	isLocal: boolean;
	contextCount: number;
	lastConnectedAt: Date | null;
	lastError: string | null;
	createdAt: Date;
}
