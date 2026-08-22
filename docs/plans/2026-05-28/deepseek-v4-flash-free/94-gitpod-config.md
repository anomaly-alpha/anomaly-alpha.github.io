# Plan 94: Gitpod Configuration

**Problem:** New contributors must clone, install deps, and build locally. There's no one-click dev environment setup.

**Goal:** Add Gitpod configuration so the project opens in a browser-based VS Code with all dependencies pre-installed and the dev server running.

---

## Step 1: Create Gitpod config

**File: `.gitpod.yml`**:

```yaml
tasks:
  - init: npm install && npm run build
    command: npm run dev

ports:
  - port: 3000
    onOpen: open-preview
    visibility: public

vscode:
  extensions:
    - bradlc.vscode-tailwindcss
    - dbaeumer.vscode-eslint
    - esbenp.prettier-vscode
    - ms-playwright.playwright
```

---

## Step 2: Add Gitpod badge to README

```md
[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/anomaly-alpha/anomaly-alpha.github.io)
```

---

## Step 3: Test Gitpod setup

1. Navigate to `https://gitpod.io/#https://github.com/anomaly-alpha/anomaly-alpha.github.io`
2. Verify VS Code opens with extensions installed
3. Verify `npm install && npm run build` completes
4. Verify `npm run dev` starts the server
5. Verify preview pane shows the site

---

## Files Created: `.gitpod.yml`
