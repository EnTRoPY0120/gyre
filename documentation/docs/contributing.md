---
sidebar_position: 6
---

# Contributing

We welcome contributions to Gyre! This guide will help you get started.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) 1.1+
- [Node.js](https://nodejs.org/) 20+ (for documentation)
- Kubernetes cluster with FluxCD (for testing)
- kubectl configured

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/entropy0120/gyre.git
cd gyre

# Install dependencies
bun install

# Start development server
bun run dev
```

## Project Structure

```
gyre/
├── src/
│   ├── routes/          # SvelteKit routes
│   ├── lib/
│   │   ├── components/  # Svelte components
│   │   ├── server/      # Server-only code
│   │   ├── stores/      # Svelte stores
│   │   └── utils/       # Utilities
│   └── app.html
├── documentation/       # Docusaurus docs
├── charts/             # Helm chart
└── .github/workflows/  # CI/CD
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

- Follow existing code style
- Add tests if applicable
- Update documentation

### 3. Test Locally

```bash
# Run type checks
bun run check

# Run linting
bun run lint

# Format code
bun run format

# Test in browser
bun run dev
```

### 4. Commit

```bash
git add .
git commit -m "feat: add my feature"
```

Use [conventional commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance

### 5. Push and Create PR

```bash
git push origin feature/my-feature
```

Create a Pull Request on GitHub.

## Code Style

### TypeScript

- Use strict mode
- Prefer explicit types
- Document public APIs

### Svelte

- Use Svelte 5 Runes API
- Prefer `$state()`, `$derived()`, `$effect()`
- No legacy reactive syntax

### CSS/Tailwind

- Use Tailwind classes
- Follow existing color scheme
- Dark mode first

### Example

```svelte
<script lang="ts">
	let count = $state(0);
	let doubled = $derived(count * 2);

	function increment() {
		count++;
	}
</script>

<button class="rounded bg-primary px-4 py-2 text-white" onclick={increment}>
	Count: {count} (doubled: {doubled})
</button>
```

## Adding New Features

### Adding Flux Resource Support

1. **Define Types**

   ```typescript
   // src/lib/server/kubernetes/flux/types.ts
   export interface MyResource {
   	// ... type definition
   }
   ```

2. **Add Resource Utilities**

   ```typescript
   // src/lib/server/kubernetes/flux/resources.ts
   export async function getMyResources(...) {
     // ... implementation
   }
   ```

3. **Create API Routes**

   ```typescript
   // src/routes/api/flux/myresource/+server.ts
   export async function GET({ locals }) {
   	// ... handler
   }
   ```

4. **Add UI Components**

   ```svelte
   <!-- src/lib/components/flux/resources/MyResource.svelte -->
   ```

5. **Update Navigation**
   - Add to sidebar in `src/routes/+layout.svelte`

## Documentation

Update documentation for any changes:

- Update relevant `.md` files in `/documentation/docs/`
- Add examples if applicable
- Update API docs

To preview docs locally:

```bash
cd documentation
npm install
npm run start
```

## Testing

### Manual Testing

Test in a real Kubernetes cluster:

```bash
# Create test cluster
kind create cluster --name gyre-test

# Install FluxCD
flux install

# Build and load image
docker build -t gyre:test .
kind load docker-image gyre:test --name gyre-test

# Install via Helm
helm install gyre charts/gyre \
  --set image.tag=test \
  --set image.pullPolicy=Never

# Port forward
kubectl port-forward -n flux-system svc/gyre 3000:80
```

### Test Checklist

- [ ] Feature works as expected
- [ ] No console errors
- [ ] Responsive on mobile
- [ ] Dark mode works
- [ ] Authentication works
- [ ] RBAC permissions respected

## Reporting Issues

When reporting bugs, include:

1. **Description** - What happened?
2. **Steps to Reproduce** - How to trigger it?
3. **Expected Behavior** - What should happen?
4. **Actual Behavior** - What actually happened?
5. **Environment** - Version, browser, cluster info
6. **Logs** - Relevant error messages

## Security

Report security vulnerabilities privately:

- Email: security@entropy0120.dev (example)
- Do NOT open public issues

## Code of Conduct

- Be respectful
- Welcome newcomers
- Focus on constructive feedback
- Respect different viewpoints

## Questions?

- Open a [GitHub Discussion](https://github.com/entropy0120/gyre/discussions)
- Join our community (coming soon)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
