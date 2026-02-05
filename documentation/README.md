# Gyre Documentation

This directory contains the Docusaurus-based documentation site for Gyre.

## Quick Start

```bash
cd documentation
npm install
npm run start
```

Open http://localhost:3000/gyre/ to view the documentation.

## Available Scripts

- `npm run start` - Start development server
- `npm run build` - Build for production
- `npm run serve` - Serve built site locally
- `npm run deploy` - Deploy to GitHub Pages

## Project Structure

```
documentation/
├── docs/              # Documentation content (Markdown)
├── src/
│   ├── css/          # Custom CSS styles
│   └── pages/        # Custom React pages
├── static/           # Static assets (images, favicon)
├── docusaurus.config.ts  # Docusaurus configuration
└── sidebars.ts       # Sidebar navigation
```

## Adding Documentation

1. Create a new `.md` file in `docs/`
2. Add frontmatter:
   ```yaml
   ---
   sidebar_position: 1
   ---
   ```
3. Write content in Markdown
4. The file will automatically appear in the sidebar

## Deployment

The documentation is automatically deployed to GitHub Pages when you push to the `main` branch (if documentation files are changed).

Live site: https://entropy0120.github.io/gyre/

## Learn More

- [Docusaurus Documentation](https://docusaurus.io/)
- [Markdown Features](https://docusaurus.io/docs/markdown-features)
