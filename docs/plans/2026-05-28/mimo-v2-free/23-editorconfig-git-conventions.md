# Plan 23: .editorconfig + Git Conventions

**Problem:** No EditorConfig to ensure consistent indentation across editors. No git commit message convention, leading to inconsistent commit history.

**Goal:** Add EditorConfig, git message template, and commit convention documentation.

---

## Step 1: Create .editorconfig

**File: `.editorconfig`** (root)

```ini
# EditorConfig: https://editorconfig.org
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2

[Makefile]
indent_style = tab
```

---

## Step 2: Create git commit message template

**File: `.gitmessage`** (root)

```
# Subject line (max 50 chars):
#   <type>: <short description>
#
# Types:
#   feat     New feature
#   fix      Bug fix
#   perf     Performance improvement
#   a11y     Accessibility improvement
#   seo      SEO/meta improvement
#   content  Guide/data content update
#   docs     Documentation only
#   chore    Build/config/tooling
#   refactor Code change with no functional change
#
# Body (72 chars per line):
#   - Why this change was made
#   - What it does
#   - Any breaking changes
#
# Examples:
#   feat: add PvP quick compare mode
#   fix: correct login gem total from 993 to 1393
#   perf: lazy-load Chart.js, reduce TBT 240ms→30ms
#   a11y: add focus trapping to card modals

#
```

To use this template:
```bash
git config commit.template .gitmessage
```

---

## Step 3: Document commit conventions in CONTRIBUTING.md

Add to `CONTRIBUTING.md` (from Plan 22):

```md
## Commit Convention

Use structured commit messages:

```
<type>: <short description>

<optional body>
```

| Type | Usage |
|------|-------|
| `feat` | New feature or enhancement |
| `fix` | Bug fix |
| `perf` | Performance improvement |
| `a11y` | Accessibility improvement |
| `seo` | SEO/meta improvement |
| `content` | Game data or guide content update |
| `docs` | Documentation changes |
| `chore` | Build/config/tooling changes |
| `refactor` | Code change with no functional change |

**Subject line:** Max 50 chars, lowercase, no period.
**Body:** Wrap at 72 chars, explain what and why.
```

---

## Step 4: Add .gitignore entries for common artifacts

**In `.gitignore`:**

```
# OS files
.DS_Store
Thumbs.db

# Editor files
.vscode/
.idea/
*.swp
*.swo

# Generated build output
*.min.*
*.map

# Environment
.env
.env.local

# Node
node_modules/
```

Note: Currently `.gitignore` may not exist or may differ. Read the current version first:

```bash
cat .gitignore 2>/dev/null || echo "No .gitignore exists"
```

---

## Step 5: Add .gitattributes for consistent line endings

**File: `.gitattributes`**

```
# Auto detect text files and perform LF normalization
* text=auto

# HTML/JS/CSS/MD should have LF endings
*.html text eol=lf
*.js text eol=lf
*.css text eol=lf
*.md text eol=lf
*.json text eol=lf
*.yml text eol=lf

# Binary files
*.png binary
*.ico binary
*.woff2 binary
```

---

## Step 6: Apply EditorConfig to all files

After creating `.editorconfig`, normalize files:

```bash
# Many editors auto-format on save with EditorConfig plugin.
# Alternatively, use a CLI tool:
npm install -D eclint
npx eclint check "**/*.html" "**/*.js" "**/*.css" "**/*.md"
npx eclint fix "**/*.html" "**/*.js" "**/*.css" "**/*.md"
```

---

## Files Created/Modified

| File | Status |
|------|--------|
| `.editorconfig` | **New** |
| `.gitmessage` | **New** |
| `.gitattributes` | **New** |
| `.gitignore` | Modified (if exists) or **New** |
| `CONTRIBUTING.md` | Add commit convention section |

---

## Verification

```bash
# EditorConfig:
npx eclint check "*.html" "*.css" "*.md"
# Expected: all files pass

# Git template:
git config commit.template
# Expected: path to .gitmessage
```
