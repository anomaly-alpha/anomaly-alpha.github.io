# Plan 85: Gitpod Configuration

**Problem:** New contributors must manually set up their environment (install Node.js, run npm install, start a server). Gitpod would provide instant cloud development environments.

**Goal:** Add Gitpod configuration for one-click development environment.

---

## Step 1: Create Gitpod config

```yaml
# .gitpod.yml
image: gitpod/workspace-full

tasks:
  - init: npm install
    command: npm run build && npx serve . -p 3000

ports:
  - port: 3000
    onOpen: open-preview

vscode:
  extensions:
    - dbaeumer.vscode-eslint
    - esbenp.prettier-vscode
```

## Step 2: Add Gitpod badge to README

```markdown
[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-908a85?logo=gitpod)](https://gitpod.io/#https://github.com/anomaly-alpha/anomaly-alpha.github.io)
```

## Files Modified
- `.gitpod.yml` — new file
- `README.md` — Gitpod badge

## Verification
```bash
# Click Gitpod badge — should open cloud workspace
# Site should auto-build and preview
```
