import { browser } from '$app/environment';

export interface DashboardWidget {
	id: string;
	dashboardId: string;
	type: 'metric' | 'list' | 'chart' | 'log' | 'markdown';
	title: string;
	resourceType?: string | null;
	query?: string | null;
	config?: string | null;
	position?: string | null;
	createdAt: string;
}

export interface Dashboard {
	id: string;
	name: string;
	description?: string | null;
	isDefault: boolean;
	isShared: boolean;
	ownerId?: string | null;
	layout?: string | null;
	widgets: DashboardWidget[];
	createdAt: string;
	updatedAt: string;
}

class DashboardStore {
	dashboards = $state<Dashboard[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);

	async fetchDashboards() {
		if (!browser) return;
		
		this.loading = true;
		this.error = null;
		
		try {
			const res = await fetch('/api/dashboards');
			if (!res.ok) throw new Error('Failed to fetch dashboards');
			
			const data = await res.json();
			this.dashboards = data;
		} catch (err: any) {
			console.error('Error fetching dashboards:', err);
			this.error = err.message || 'Failed to load dashboards';
		} finally {
			this.loading = false;
		}
	}

	async createDashboard(dashboard: Partial<Dashboard>) {
		this.loading = true;
		try {
			const res = await fetch('/api/dashboards', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(dashboard)
			});
			
			if (!res.ok) {
				const error = await res.json();
				throw new Error(error.message || 'Failed to create dashboard');
			}
			
			const newDashboard = await res.json();
			this.dashboards = [newDashboard, ...this.dashboards];
			return newDashboard;
		} catch (err: any) {
			console.error('Error creating dashboard:', err);
			this.error = err.message;
			throw err;
		} finally {
			this.loading = false;
		}
	}

	async deleteDashboard(id: string) {
		try {
			const res = await fetch(`/api/dashboards/${id}`, {
				method: 'DELETE'
			});
			
			if (!res.ok) throw new Error('Failed to delete dashboard');
			
			this.dashboards = this.dashboards.filter(d => d.id !== id);
		} catch (err: any) {
			console.error('Error deleting dashboard:', err);
			throw err;
		}
	}
}

export const dashboardStore = new DashboardStore();
