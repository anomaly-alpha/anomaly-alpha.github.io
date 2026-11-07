param(
  [string]$OutputDir = "./lighthouse-reports"
)

# Anchor to the repo root. An interactive PowerShell profile can Set-Location elsewhere,
# which would put the reports in the wrong folder and make --config-path miss its file.
Set-Location (Split-Path -Parent $PSScriptRoot)

$pages = @(
  @{name="home"; url="https://anomaly-alpha.github.io/"},
  @{name="code"; url="https://anomaly-alpha.github.io/guide/code/"},
  @{name="event"; url="https://anomaly-alpha.github.io/guide/event/"},
  @{name="pvp"; url="https://anomaly-alpha.github.io/guide/pvp/"},
  @{name="login"; url="https://anomaly-alpha.github.io/guide/login/"},
  @{name="faq"; url="https://anomaly-alpha.github.io/guide/faq/"},
  @{name="beginners"; url="https://anomaly-alpha.github.io/guide/beginners/"},
  @{name="xp"; url="https://anomaly-alpha.github.io/guide/xp/"}
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
  lighthouse $url `
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
