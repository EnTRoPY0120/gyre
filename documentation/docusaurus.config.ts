import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
	title: 'Gyre',
	tagline: 'Modern WebUI for FluxCD',
	favicon: 'img/favicon.svg',

	// Future flags
	future: {
		v4: true
	},

	// GitHub Pages Configuration
	url: 'https://entropy0120.github.io',
	baseUrl: '/gyre/',

	// GitHub Pages deployment config
	organizationName: 'entropy0120',
	projectName: 'gyre',
	deploymentBranch: 'gh-pages',
	trailingSlash: false,

	onBrokenLinks: 'throw',
	onBrokenMarkdownLinks: 'warn',

	i18n: {
		defaultLocale: 'en',
		locales: ['en']
	},

	presets: [
		[
			'classic',
			{
				docs: {
					sidebarPath: './sidebars.ts',
					editUrl: 'https://github.com/entropy0120/gyre/tree/main/documentation/',
					routeBasePath: '/'
				},
				blog: false,
				theme: {
					customCss: './src/css/custom.css'
				}
			} satisfies Preset.Options
		]
	],

	themeConfig: {
		image: 'img/gyre-social-card.jpg',
		colorMode: {
			defaultMode: 'dark',
			respectPrefersColorScheme: true
		},
		navbar: {
			title: 'Gyre',
			logo: {
				alt: 'Gyre Logo',
				src: 'img/logo.svg'
			},
			items: [
				{
					type: 'docSidebar',
					sidebarId: 'tutorialSidebar',
					position: 'left',
					label: 'Documentation'
				},
				{
					href: 'https://github.com/entropy0120/gyre',
					label: 'GitHub',
					position: 'right'
				}
			]
		},
		footer: {
			style: 'dark',
			links: [
				{
					title: 'Documentation',
					items: [
						{
							label: 'Getting Started',
							to: '/getting-started'
						},
						{
							label: 'Installation',
							to: '/installation'
						},
						{
							label: 'Architecture',
							to: '/architecture'
						}
					]
				},
				{
					title: 'Community',
					items: [
						{
							label: 'GitHub Issues',
							href: 'https://github.com/entropy0120/gyre/issues'
						},
						{
							label: 'Contributing',
							to: '/contributing'
						}
					]
				},
				{
					title: 'More',
					items: [
						{
							label: 'GitHub',
							href: 'https://github.com/entropy0120/gyre'
						},
						{
							label: 'Releases',
							href: 'https://github.com/entropy0120/gyre/releases'
						}
					]
				}
			],
			copyright: `Copyright © ${new Date().getFullYear()} Gyre Project. Built with Docusaurus.`
		},
		prism: {
			theme: prismThemes.github,
			darkTheme: prismThemes.dracula
		}
	} satisfies Preset.ThemeConfig
};

export default config;
