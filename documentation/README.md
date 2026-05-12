# Gyre Documentation

This directory contains the Docusaurus-based documentation site for Gyre.

## Quick Start

```bash
pnpm install
pnpm --dir documentation start
```

Open http://localhost:3000/gyre/ to view the documentation.

## Available Scripts

- `pnpm --dir documentation start` - Start development server
- `pnpm --dir documentation typecheck` - Validate docs TypeScript configuration
- `pnpm --dir documentation build` - Build for production
- `pnpm --dir documentation serve` - Serve built site locally
- `pnpm --dir documentation deploy` - Deploy to GitHub Pages

From repo root, run `pnpm docs:check` to typecheck and build docs in one step.

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
