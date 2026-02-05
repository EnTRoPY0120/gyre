import type { ReactNode } from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type ScreenshotItem = {
	title: string;
	description: string;
	imageSrc: string;
	imageAlt: string;
};

const ScreenshotList: ScreenshotItem[] = [
	{
		title: 'Dashboard Overview',
		description:
			'Get a complete view of all your FluxCD resources with real-time health monitoring across multiple clusters.',
		imageSrc: '/gyre/img/screenshots/placeholder-dashboard.svg',
		imageAlt: 'Gyre Dashboard Overview - Coming Soon'
	},
	{
		title: 'Resource Management',
		description:
			'View, filter, and manage all FluxCD resources including Kustomizations, HelmReleases, Sources, and more.',
		imageSrc: '/gyre/img/screenshots/placeholder-resources.svg',
		imageAlt: 'Gyre Resource Management - Coming Soon'
	},
	{
		title: 'Detailed Insights',
		description:
			'Drill down into individual resources with YAML viewing, status conditions, events, and action controls.',
		imageSrc: '/gyre/img/screenshots/placeholder-detail.svg',
		imageAlt: 'Gyre Resource Detail View - Coming Soon'
	}
];

function Screenshot({ title, description, imageSrc, imageAlt }: ScreenshotItem) {
	return (
		<div className={clsx('col col--4')}>
			<div className={styles.screenshotCard}>
				<div className={styles.screenshotImageWrapper}>
					<img src={imageSrc} alt={imageAlt} className={styles.screenshotImage} />
					<div className={styles.placeholderOverlay}>
						<span className={styles.placeholderText}>Screenshot Coming Soon</span>
					</div>
				</div>
				<div className={styles.screenshotContent}>
					<Heading as="h3" className={styles.screenshotTitle}>
						{title}
					</Heading>
					<p className={styles.screenshotDescription}>{description}</p>
				</div>
			</div>
		</div>
	);
}

export default function HomepageScreenshots(): ReactNode {
	return (
		<section className={styles.screenshots}>
			<div className="container">
				<div className={styles.sectionHeader}>
					<Heading as="h2" className={styles.sectionTitle}>
						See it in Action
					</Heading>
					<p className={styles.sectionDescription}>
						Experience the power of Gyre with an intuitive interface designed for FluxCD resource
						management.
					</p>
				</div>
				<div className="row">
					{ScreenshotList.map((props, idx) => (
						<Screenshot key={idx} {...props} />
					))}
				</div>
				<div className={styles.screenshotNote}>
					<p>
						📸 Screenshots coming soon! Check the{' '}
						<a href="https://github.com/entropy0120/gyre/tree/main/documentation/SCREENSHOTS_NEEDED.md">
							screenshot requirements
						</a>{' '}
						if you want to contribute.
					</p>
				</div>
			</div>
		</section>
	);
}
