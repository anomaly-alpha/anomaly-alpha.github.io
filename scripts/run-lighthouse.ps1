param(
  [string]$OutputDir = "./lighthouse-reports",
  # Point this at a local server (e.g. http://127.0.0.1:8123) to audit the working tree
  # before pushing. GitHub Pages only serves committed-and-pushed code, so a production
  # sweep cannot see local changes.
  [string]$BaseUrl = "https://anomaly-alpha.github.io"
)

# Anchor to the repo root. An interactive PowerShell profile can Set-Location elsewhere,
# which would put the reports in the wrong folder and make --config-path miss its file.
Set-Location (Split-Path -Parent $PSScriptRoot)

$base = $BaseUrl.TrimEnd('/')

# Run the repo-local Lighthouse, never a global one. A global install silently shipped a
# different engine (13.3.0) than the one @lhci/cli's budget gate uses (13.6.0), so the two
# documented entry points scored the same pages on different code.
$lighthouseCli = "node_modules/lighthouse/cli/index.js"
if (-not (Test-Path $lighthouseCli)) {
  Write-Host "Lighthouse is not installed. Run 'npm install' first." -ForegroundColor Red
  exit 1
}

$pages = @(
  @{name="home"; url="$base/"},
  @{name="code"; url="$base/guide/code/"},
  @{name="event"; url="$base/guide/event/"},
  @{name="pvp"; url="$base/guide/pvp/"},
  @{name="login"; url="$base/guide/login/"},
  @{name="faq"; url="$base/guide/faq/"},
  @{name="beginners"; url="$base/guide/beginners/"},
  @{name="xp"; url="$base/guide/xp/"}
)

$chromeFlags = "--headless --no-sandbox --disable-gpu --disable-dev-shm-usage"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

foreach ($page in $pages) {
  $name = $page.name
  $url = $page.url
  # Lighthouse appends ".report.<ext>" when several --output formats are requested, so the
  # path passed to --output-path is a prefix, not a filename. Braces keep PowerShell from
  # reading "$name.report" as a property access.
  $jsonPath = "$OutputDir/${name}.report.json"
  $htmlPath = "$OutputDir/${name}.report.html"
  $errPath  = "$OutputDir/${name}.stderr.log"

  Write-Host "`n=== Auditing $name ($url) ===" -ForegroundColor Cyan

  # Redirect stderr to a file, not to $null: suppressing a native command's stderr makes
  # PowerShell close the pipe, which kills lighthouse before it writes the report.
  node $lighthouseCli $url `
    --config-path=lighthouse-config.js `
    --output html --output json `
    --output-path "$OutputDir/$name" `
    --chrome-flags="$chromeFlags" `
    --quiet 2>$errPath
  $exit = $LASTEXITCODE

  if (-not (Test-Path $jsonPath)) {
    Write-Host "  FAILED: no report written (exit $exit)" -ForegroundColor Red
    if (Test-Path $errPath) {
      Get-Content $errPath -Tail 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    }
    continue
  }

  # Chrome's temp-profile cleanup fails on this platform after the report is written, which
  # makes lighthouse exit nonzero. The report is what matters, so note it and carry on.
  if ($exit -ne 0) {
    Write-Host "  note: exited $exit during Chrome teardown; report was written anyway" -ForegroundColor DarkYellow
  }

  $r = Get-Content $jsonPath | ConvertFrom-Json
  $perf = [math]::Round($r.categories.performance.score * 100)
  $a11y = [math]::Round($r.categories.accessibility.score * 100)
  $bp   = [math]::Round($r.categories.'best-practices'.score * 100)
  $seo  = [math]::Round($r.categories.seo.score * 100)
  $cls  = $r.audits.'cumulative-layout-shift'.displayValue
  $lcp  = $r.audits.'largest-contentful-paint'.displayValue
  $tbt  = $r.audits.'total-blocking-time'.displayValue

  Write-Host "  Scores: Perf=$perf A11y=$a11y BP=$bp SEO=$seo"
  Write-Host "  Metrics: LCP=$lcp TBT=$tbt CLS=$cls"
}

Write-Host "`n=== Done! Reports saved to $OutputDir/ ===" -ForegroundColor Green
