# Plan 86: .nvmrc File

**Problem:** No Node.js version is specified. Different contributors may use different Node versions, leading to inconsistent build results.

**Goal:** Add `.nvmrc` to specify the required Node.js version.

---

## Step 1: Create .nvmrc

```
# .nvmrc
20
```

## Step 2: Document in README

```markdown
## Node.js Version

This project requires Node.js 20 LTS. Use [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm use
```
```

## Step 3: Add to CI

```yaml
# .github/workflows/ci.yml — ensure Node version matches
- uses: actions/setup-node@v4
  with:
    node-version-file: '.nvmrc'
```

## Files Modified
- `.nvmrc` — new file
- `README.md` — version documentation
- `.github/workflows/ci.yml` — node-version-file

## Verification
```bash
nvm use
node --version  # Should show v20.x.x
```
