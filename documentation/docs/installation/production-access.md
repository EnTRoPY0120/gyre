---
sidebar_position: 4
---

# Production Access & Ingress Guide

This guide covers the various ways to expose Gyre in a production environment, ensuring secure and reliable access to the dashboard.

## Production Access Patterns

While `port-forward` is useful for development, production deployments require more robust access patterns. The most common methods are:

1. **Ingress Controller** (Recommended)
2. **Service Type: LoadBalancer**
3. **Internal Proxy** (e.g., behind a corporate VPN or SSO proxy)

---

## Ingress Configuration (Recommended)

Using an Ingress Controller allows you to expose Gyre over HTTP/HTTPS with advanced features like SSL termination, path-based routing, and authentication.

### Nginx Ingress Controller

For [ingress-nginx](https://kubernetes.github.io/ingress-nginx/), use the following configuration in your `values.yaml`:

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    # Important for long-lived SSE streaming
    nginx.ingress.kubernetes.io/proxy-read-timeout: '3600'
    nginx.ingress.kubernetes.io/proxy-send-timeout: '3600'
    nginx.ingress.kubernetes.io/proxy-buffering: 'off'
    # Enable SSL redirection
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
    # Ensure large payloads can be sent (e.g., for large kubeconfigs)
    nginx.ingress.kubernetes.io/proxy-body-size: '10m'
  hosts:
    - host: gyre.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: gyre-tls
      hosts:
        - gyre.example.com
```

### Traefik Ingress

For [Traefik](https://doc.traefik.io/traefik/), use the following configuration:

```yaml
ingress:
  enabled: true
  className: traefik
  annotations:
    # Traefik-specific middleware (e.g., for HTTPS redirect)
    traefik.ingress.kubernetes.io/router.middlewares: 'flux-system-redirect-https@kubernetescrd'
    # Route through secure entrypoint
    traefik.ingress.kubernetes.io/router.entrypoints: 'websecure'
  hosts:
    - host: gyre.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: gyre-tls
      hosts:
        - gyre.example.com
```

---

## Kubernetes Gateway API (Future Standard)

The [Kubernetes Gateway API](https://gateway-api.sigs.k8s.io/) is the evolution of the Ingress API, providing more powerful and expressive routing capabilities.

### HTTPRoute Configuration

To use the Gateway API, enable it in your `values.yaml` and reference your existing `Gateway`:

```yaml
origin: https://gyre.example.com

gatewayApi:
  enabled: true
  parentRefs:
    - name: my-gateway
      namespace: gateway-namespace
  # Set this to true when the Gateway terminates TLS so Gyre derives
  # https:// ORIGIN/BETTER_AUTH_URL values.
  tls: true
  hostnames:
    - gyre.example.com
  # Default rule points to the Gyre service, but you can override it:
  # rules:
  #   - matches:
  #       - path: { type: PathPrefix, value: / }
  #     backendRefs:
  #       - name: gyre
  #         port: 80
```

Use `origin` when the public hostname is inherited from the Gateway or listener and is not repeated in chart values. When `origin` is empty, Gyre derives it from ingress first, then `gatewayApi.hostnames`, then falls back to the in-cluster service URL.

**Note:** Ensure your cluster has a Gateway API implementation installed (e.g., GKE Gateway, Istio, Linkerd, or an updated Nginx/Traefik controller with Gateway API support).

---

## Service Type: LoadBalancer

If your Kubernetes environment is in a cloud provider (AWS, GCP, Azure) and you want a dedicated IP address for Gyre without an Ingress Controller, you can use a `LoadBalancer` service.

Update your `values.yaml`:

```yaml
service:
  type: LoadBalancer
  port: 80
  # Cloud provider-specific annotations
  annotations:
    # Example for AWS: Use a Network Load Balancer (NLB)
    service.beta.kubernetes.io/aws-load-balancer-type: 'nlb'
    # Example for GCP: Assign a static IP
    # kubernetes.io/ingress.global-static-ip-name: "gyre-static-ip"
```

**Security Note:** When using a `LoadBalancer` service directly, ensure you manage TLS termination at the application level or use cloud-specific annotations to handle it at the load balancer.

---

## Deploying Behind a Proxy

If Gyre is deployed behind an external proxy (like a corporate firewall or an identity-aware proxy), consider the following:

### Header Support

Gyre relies on standard `X-Forwarded-*` headers to correctly identify the original client protocol and IP address. Ensure your proxy sends these:

- `X-Forwarded-For`
- `X-Forwarded-Proto` (essential for secure cookie handling)
- `X-Forwarded-Host`

### SSL/TLS and Cookies

If Gyre is accessed through a proxy, ensure the public origin is correctly set so callback URLs and auth redirects are generated correctly:

```yaml
origin: https://gyre.example.com
```

### Authentication Considerations

When using an external authentication proxy (like Cloudflare Access or Tailscale Funnel), integrate it with Gyre's current auth config model.

- **SSO/OIDC Integration**: Recommended for production. Configure providers in `auth.providers`.
- **Local Login Toggle**: Control local username/password login with `auth.localLoginEnabled`.

---

## Real-time Monitoring (SSE)

Gyre uses Server-Sent Events (SSE) for real-time monitoring of FluxCD resources. For SSE to work through a proxy/ingress, ensure:

1. **Timeouts**: Increase the proxy's read/write timeouts (as shown in the Nginx example above) to prevent premature connection drops.
2. **Buffering**: Disable proxy buffering for the event stream endpoint (`/api/v1/events`).
