param(
  [string]$OutputDir = "./lighthouse-reports"
)

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
  $htmlPath = "$OutputDir/$name.html"
  $jsonPath = "$OutputDir/$name.json"

  Write-Host "`n=== Auditing $name ($url) ===" -ForegroundColor Cyan

  lighthouse $url `
    --config-path=lighthouse-config.js `
    --output html --output json `
    --output-path "$OutputDir/$name" `
    --chrome-flags="$chromeFlags" `
    --quiet 2>$null

  if (Test-Path $jsonPath) {
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
}

Write-Host "`n=== Done! Reports saved to $OutputDir/ ===" -ForegroundColor Green
