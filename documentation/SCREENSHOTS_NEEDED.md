# Screenshots Needed for Documentation

This document lists all screenshots needed for the Gyre documentation website.

## Homepage Hero Section

### 1. Dashboard Overview

- **Purpose:** Main hero banner visual
- **Content:** Full dashboard showing resource summaries, cluster health, recent events
- **Theme:** Dark mode (preferred)
- **Resolution:** 1920x1080 or larger
- **File:** `hero-dashboard.png`
- **Priority:** HIGH

## Features Section

### 2. Real-time Monitoring

- **Purpose:** Show WebSocket live updates in action
- **Content:** Resource list showing status changes (Ready/Not Ready)
- **Theme:** Dark mode
- **Resolution:** 1200x800 minimum
- **File:** `feature-realtime.png`
- **Priority:** HIGH
- **Note:** If possible, capture during a reconciliation showing status change

### 3. Multi-Cluster Management

- **Purpose:** Show cluster switching capability
- **Content:** Dashboard with cluster dropdown/selector visible
- **Theme:** Dark mode
- **Resolution:** 1200x800 minimum
- **File:** `feature-multicluster.png`
- **Priority:** MEDIUM

### 4. Resource Detail View

- **Purpose:** Show comprehensive resource information
- **Content:** Single Kustomization or HelmRelease detail page
- **Theme:** Dark mode
- **Resolution:** 1200x800 minimum
- **File:** `feature-resourcedetail.png`
- **Priority:** HIGH
- **Elements to show:** YAML tab, Status/Conditions, Events, Action buttons

### 5. RBAC/User Management

- **Purpose:** Show access control features
- **Content:** Users list or RBAC policies page
- **Theme:** Dark mode
- **Resolution:** 1200x800 minimum
- **File:** `feature-rbac.png`
- **Priority:** MEDIUM

## Getting Started Section

### 6. Login Screen

- **Purpose:** First impression for new users
- **Content:** Login page with Gyre branding
- **Theme:** Dark mode
- **Resolution:** 1920x1080
- **File:** `login-screen.png`
- **Priority:** LOW

### 7. Installation Success

- **Purpose:** Show post-installation dashboard
- **Content:** Dashboard showing healthy resources after install
- **Theme:** Dark mode
- **Resolution:** 1920x1080
- **File:** `installed-dashboard.png`
- **Priority:** MEDIUM

## Mobile Responsive

### 8. Mobile Dashboard

- **Purpose:** Show mobile responsiveness
- **Content:** Dashboard viewed on mobile device
- **Theme:** Dark mode
- **Resolution:** 750x1334 (iPhone) or similar
- **File:** `mobile-dashboard.png`
- **Priority:** LOW

## Theme Comparison

### 9. Light vs Dark Mode

- **Purpose:** Show theme toggle functionality
- **Content:** Same view (dashboard or resource list) in both themes
- **Theme:** Both light and dark
- **Resolution:** 1200x800 each (side by side in one image)
- **File:** `theme-comparison.png`
- **Priority:** LOW

## Technical Specifications

### Format Requirements

- **Format:** PNG or WebP (WebP preferred for smaller file size)
- **Quality:** High quality, but optimized for web (< 500KB per image)
- **Browser:** Chrome or Firefox, no visible bookmarks bar
- **Data:** Use sanitized/demo data (no sensitive cluster names, IPs, etc.)
- **Annotations:** No arrows or text overlays needed (we'll add those in code)

### Naming Convention

```
gyre-[section]-[description]-[theme].[ext]

Examples:
- gyre-hero-dashboard-dark.webp
- gyre-feature-realtime-dark.png
- gyre-mobile-dashboard-dark.webp
```

### Directory Structure

```
documentation/
└── static/
    └── img/
        └── screenshots/
            ├── hero-dashboard.webp
            ├── feature-realtime.webp
            ├── feature-multicluster.webp
            ├── feature-resourcedetail.webp
            ├── feature-rbac.webp
            ├── login-screen.webp
            ├── installed-dashboard.webp
            ├── mobile-dashboard.webp
            └── theme-comparison.webp
```

## Priority Order

1. **HIGH:** Dashboard Overview (Hero)
2. **HIGH:** Resource Detail View
3. **HIGH:** Real-time Monitoring
4. **MEDIUM:** Multi-Cluster Management
5. **MEDIUM:** RBAC/User Management
6. **MEDIUM:** Installation Success
7. **LOW:** Login Screen
8. **LOW:** Mobile Dashboard
9. **LOW:** Theme Comparison

## Tips for Taking Screenshots

1. **Browser Setup:**
   - Use Chrome or Firefox
   - Hide bookmarks bar (Ctrl+Shift+B)
   - Zoom to 100%
   - Use full-screen mode if possible

2. **Data Preparation:**
   - Create a demo cluster with sample Flux resources
   - Use fake cluster names (demo-cluster, staging, etc.)
   - Ensure resources show different statuses (Ready, Progressing, Failed)

3. **Capture Method:**
   - Use built-in screenshot tools (Cmd+Shift+4 on Mac, Win+Shift+S on Windows)
   - Or browser dev tools (F12 → Capture screenshot)
   - Avoid browser extensions that add overlays

4. **Optimization:**
   - Run through TinyPNG or ImageOptim before committing
   - Target < 500KB per image
   - WebP format saves ~50% file size vs PNG

## Current Status

- [ ] Dashboard Overview
- [ ] Real-time Monitoring
- [ ] Multi-Cluster Management
- [ ] Resource Detail View
- [ ] RBAC/User Management
- [ ] Login Screen
- [ ] Installation Success
- [ ] Mobile Dashboard
- [ ] Theme Comparison

---

**Last Updated:** 2025-02-05
**Next Review:** When screenshots are ready for integration
