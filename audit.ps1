$files = @(
  '404.html',
  'index.html',
  'authors/anomaly/index.html',
  'guide/beginners/index.html',
  'guide/code/index.html',
  'guide/creators/index.html',
  'guide/event/index.html',
  'guide/faq/index.html',
  'guide/login/index.html',
  'guide/pvp/index.html',
  'guide/redeem/index.html',
  'guide/xp/index.html',
  'music/index.html',
  'privacy/index.html',
  'seo/index.html',
  'skarn-bot/index.html',
  'terms/index.html'
)

$pass = $true
foreach ($f in $files) {
  $content = Get-Content (Join-Path $PSScriptRoot $f) -Raw
  $preconnect = ([regex]::Matches($content, 'rel="preconnect" href="https://www.googletagmanager.com"')).Count
  $gtagLoader = ([regex]::Matches($content, 'googletagmanager\.com/gtag/js\?id=G-21RZK3GKKZ')).Count
  $gtagConfig = ([regex]::Matches($content, "gtag\('config', 'G-21RZK3GKKZ'")).Count
  $gtmContainer = ([regex]::Matches($content, 'GTM-')).Count

  $ok = ($preconnect -eq 1) -and ($gtagLoader -eq 1) -and ($gtagConfig -eq 1) -and ($gtmContainer -eq 0)
  $status = if ($ok) { 'PASS' } else { 'FAIL'; $script:pass = $false }
  Write-Output "$status  preconnect=$preconnect  gtagLoader=$gtagLoader  gtagConfig=$gtagConfig  GTM=$gtmContainer  $f"
}

Write-Output ""
if ($pass) { Write-Output "ALL 17 FILES PASSED" } else { Write-Output "SOME FILES FAILED" }
