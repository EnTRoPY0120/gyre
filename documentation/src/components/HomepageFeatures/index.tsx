import type { ReactNode } from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
	title: string;
	description: ReactNode;
	icon: string;
};

const FeatureList: FeatureItem[] = [
	{
		title: 'Real-time Monitoring',
		icon: '📊',
		description: (
			<>
				Live updates via WebSocket provide instant visibility into your FluxCD resources. Watch
				reconciliations happen in real-time and get immediate feedback on resource status changes.
			</>
		)
	},
	{
		title: 'Multi-Cluster Management',
		icon: '🌐',
		description: (
			<>
				Manage multiple Kubernetes clusters from a single interface. Seamlessly switch between
				environments and maintain consistent visibility across your entire infrastructure.
			</>
		)
	},
	{
		title: 'Built-in RBAC',
		icon: '🔐',
		description: (
			<>
				Fine-grained access control with role-based permissions. Control who can view, edit, or
				manage resources across namespaces and clusters with flexible policies.
			</>
		)
	},
	{
		title: 'Complete FluxCD Support',
		icon: '⚡',
		description: (
			<>
				Full support for all FluxCD resources including Kustomizations, HelmReleases, Sources,
				Notifications, and Image Automation. Everything you need in one place.
			</>
		)
	},
	{
		title: 'Modern UI',
		icon: '🎨',
		description: (
			<>
				Built with SvelteKit and TailwindCSS for a fast, responsive, and beautiful user experience.
				Dark mode included for comfortable viewing in any environment.
			</>
		)
	},
	{
		title: 'Easy Installation',
		icon: '🚀',
		description: (
			<>
				Get up and running in minutes with our Helm chart. Simple configuration, automatic setup,
				and production-ready defaults make deployment a breeze.
			</>
		)
	}
];

function Feature({ title, icon, description }: FeatureItem) {
	return (
		<div className={clsx('col col--4')}>
			<div className={styles.featureCard}>
				<div className={styles.featureIcon}>{icon}</div>
				<div className={styles.featureContent}>
					<Heading as="h3" className={styles.featureTitle}>
						{title}
					</Heading>
					<p className={styles.featureDescription}>{description}</p>
				</div>
			</div>
		</div>
	);
}

export default function HomepageFeatures(): ReactNode {
	return (
		<section className={styles.features}>
			<div className="container">
				<div className={styles.sectionHeader}>
					<Heading as="h2" className={styles.sectionTitle}>
						Why Gyre?
					</Heading>
					<p className={styles.sectionDescription}>
						A powerful WebUI designed specifically for FluxCD, bringing modern GitOps workflows to
						your fingertips.
					</p>
				</div>
				<div className="row">
					{FeatureList.map((props, idx) => (
						<Feature key={idx} {...props} />
					))}
				</div>
			</div>
		</section>
	);
}
