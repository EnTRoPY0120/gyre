# Resource Creation Wizard

The Gyre Resource Creation Wizard provides a guided, user-friendly interface for creating any of the 13 supported FluxCD resource types. It bridges the gap between manual YAML editing and high-level resource management.

## Accessing the Wizard

You can access the Resource Creation Wizard in several ways:

1. **Global "Create" Button**: Click the "+" or "Create Resource" button in the sidebar or top navigation.
2. **Resource List Pages**: On any resource list page (e.g., GitRepositories), click the "Create" button in the header.
3. **Command Palette**: Press `Ctrl+K` (or `Cmd+K` on macOS) and type "Create [Resource Type]".

## Guided Workflow

When you select a resource type, the wizard initializes with a default template.

### Form Mode (Default)

Form mode provides a structured, validated way to configure your resource:

- **Sections**: Fields are grouped into logical sections (Basic, Source, Authentication, etc.).
- **Smart Validation**: Fields validate in real-time (e.g., K8s name patterns, sync intervals).
- **Conditional Visibility**: Fields only appear when relevant (e.g., SSH fields only show when using an SSH URL).
- **Tooltips**: Hover over the "?" icon next to any field for detailed explanations and links to official documentation.

### YAML Mode

For power users, Gyre integrates a full **Monaco Editor** (the same editor powering VS Code):

- **Live Sync**: Changes in the form reflect immediately in the YAML, and vice versa.
- **Syntax Highlighting**: Full YAML syntax highlighting and error detection.
- **Comments Preservation**: Gyre preserves your custom YAML comments when switching between modes.
- **Copy Manifest**: Easily copy the generated YAML to your clipboard for use elsewhere.

## Advanced Features

### Dynamic Field Visibility

The wizard uses `showIf` logic to reduce clutter. For example, in a **GitRepository** template:

- Selecting "Branch" as the reference type shows the "Branch" field and hides "Tag" or "Commit".
- Setting a URL that starts with `ssh://` can trigger the visibility of authentication secrets.

### Array and Object Management

Gyre handles complex Kubernetes structures:

- **Dynamic Lists**: Add or remove items from arrays (e.g., `dependsOn` or `patches`) with a single click.
- **Nested Objects**: Configure complex nested specifications through sub-forms.

### Persistence

The wizard remembers your progress. If you navigate away or refresh the page, your current form values are saved in **LocalStorage** and restored when you return to that specific template.

## Common Configurations

### GitRepository with SSH Authentication

To use a private Git repository with SSH:

1. Select the **GitRepository** template.
2. In **Source Configuration**, enter your SSH URL (e.g., `ssh://git@github.com/org/repo`).
3. In the **Authentication** section, provide the name of the Kubernetes Secret containing your SSH private key in the **Secret Name** field.
4. Gyre will automatically generate the `spec.secretRef` in the YAML.

### Kustomization with Dependencies

To deploy a resource that depends on another:

1. Select the **Kustomization** template.
2. In **Deployment Settings**, find the **Dependencies** (dependsOn) field.
3. Click **Add Item** to add a new dependency.
4. Enter the `name` and `namespace` of the Kustomization that must be ready first.

### Setting up Image Automation

Image automation typically involves three resources:

1. **ImageRepository**: Point Gyre to your container registry.
2. **ImagePolicy**: Define which tags to select (e.g., semver range `1.x`).
3. **ImageUpdateAutomation**: Link the policy to your GitRepository and define the path to update.
   Use the wizard to create each of these in order, ensuring the `policyRef` in the automation resource matches your `ImagePolicy` name.

## Resource Field Reference

Gyre supports all 13 FluxCD resource types. Click on a resource type below for detailed information on its specific fields, or refer to the official FluxCD documentation.

| Resource Type             | FluxCD Component        | Internal Reference                              | Official Docs                                                               |
| ------------------------- | ----------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| **GitRepository**         | Source Controller       | [Local Docs](./resources/GitRepository)         | [Official](https://fluxcd.io/flux/components/source/gitrepositories/)       |
| **HelmRepository**        | Source Controller       | [Local Docs](./resources/HelmRepository)        | [Official](https://fluxcd.io/flux/components/source/helmrepositories/)      |
| **HelmChart**             | Source Controller       | [Local Docs](./resources/HelmChart)             | [Official](https://fluxcd.io/flux/components/source/helmcharts/)            |
| **Bucket**                | Source Controller       | [Local Docs](./resources/Bucket)                | [Official](https://fluxcd.io/flux/components/source/buckets/)               |
| **OCIRepository**         | Source Controller       | [Local Docs](./resources/OCIRepository)         | [Official](https://fluxcd.io/flux/components/source/ocirepositories/)       |
| **Kustomization**         | Kustomize Controller    | [Local Docs](./resources/Kustomization)         | [Official](https://fluxcd.io/flux/components/kustomize/kustomizations/)     |
| **HelmRelease**           | Helm Controller         | [Local Docs](./resources/HelmRelease)           | [Official](https://fluxcd.io/flux/components/helm/helmreleases/)            |
| **Alert**                 | Notification Controller | [Local Docs](./resources/Alert)                 | [Official](https://fluxcd.io/flux/components/notification/alerts/)          |
| **Provider**              | Notification Controller | [Local Docs](./resources/Provider)              | [Official](https://fluxcd.io/flux/components/notification/providers/)       |
| **Receiver**              | Notification Controller | [Local Docs](./resources/Receiver)              | [Official](https://fluxcd.io/flux/components/notification/receivers/)       |
| **ImageRepository**       | Image Automation        | [Local Docs](./resources/ImageRepository)       | [Official](https://fluxcd.io/flux/components/image/imagerepositories/)      |
| **ImagePolicy**           | Image Automation        | [Local Docs](./resources/ImagePolicy)           | [Official](https://fluxcd.io/flux/components/image/imagepolicies/)          |
| **ImageUpdateAutomation** | Image Automation        | [Local Docs](./resources/ImageUpdateAutomation) | [Official](https://fluxcd.io/flux/components/image/imageupdateautomations/) |
