import { browser } from '$app/environment';
import type {
	Dashboard as DbDashboard,
	DashboardWidget as DbDashboardWidget
} from '$lib/server/db/schema';

// Client-side types with Date converted to string for JSON serialization
export interface DashboardWidget extends Omit<DbDashboardWidget, 'createdAt'> {
	createdAt: string;
	[key: string]: unknown;
}

export interface Dashboard extends Omit<DbDashboard, 'createdAt' | 'updatedAt'> {
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
		} catch (err: unknown) {
			console.error('Error fetching dashboards:', err);
			this.error = err instanceof Error ? err.message : 'Failed to load dashboards';
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
		} catch (err: unknown) {
			console.error('Error creating dashboard:', err);
			this.error = err instanceof Error ? err.message : 'Unknown error';
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

			this.dashboards = this.dashboards.filter((d) => d.id !== id);
		} catch (err: unknown) {
			console.error('Error deleting dashboard:', err);
			throw err;
		}
	}

	async addWidget(dashboardId: string, widget: Partial<DashboardWidget>) {
		try {
			const res = await fetch(`/api/dashboards/${dashboardId}/widgets`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(widget)
			});

			if (!res.ok) {
				const error = await res.json();
				throw new Error(error.message || 'Failed to add widget');
			}

			const newWidget = await res.json();

			// Update local state if the dashboard is in the list
			this.dashboards = this.dashboards.map((d) => {
				if (d.id === dashboardId) {
					return { ...d, widgets: [...(d.widgets || []), newWidget] };
				}
				return d;
			});

			return newWidget;
		} catch (err: unknown) {
			console.error('Error adding widget:', err);
			throw err;
		}
	}

	async deleteWidget(dashboardId: string, widgetId: string) {
		try {
			const res = await fetch(`/api/dashboards/${dashboardId}/widgets/${widgetId}`, {
				method: 'DELETE'
			});

			if (!res.ok) throw new Error('Failed to delete widget');

			// Update local state
			this.dashboards = this.dashboards.map((d) => {
				if (d.id === dashboardId) {
					return { ...d, widgets: (d.widgets || []).filter((w) => w.id !== widgetId) };
				}
				return d;
			});
		} catch (err: unknown) {
			console.error('Error deleting widget:', err);
			throw err;
		}
	}

	async updateDashboard(id: string, updates: Partial<Dashboard>) {
		this.loading = true;
		try {
			const res = await fetch(`/api/dashboards/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updates)
			});

			if (!res.ok) {
				const error = await res.json();
				throw new Error(error.message || 'Failed to update dashboard');
			}

			const updatedDashboard = await res.json();
			this.dashboards = this.dashboards.map((d) => (d.id === id ? updatedDashboard : d));
			return updatedDashboard;
		} catch (err: unknown) {
			console.error('Error updating dashboard:', err);
			this.error = err instanceof Error ? err.message : 'Unknown error';
			throw err;
		} finally {
			this.loading = false;
		}
	}
}

export const dashboardStore = new DashboardStore();
