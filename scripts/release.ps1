param(
  [string]$Branch = "grok",
  [string]$Remote = "origin",
  [switch]$SkipChecks,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  Write-Host "> $Command" -ForegroundColor Cyan
  if ($DryRun) {
    return
  }

  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command"
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$package = Get-Content "package.json" -Raw | ConvertFrom-Json
$version = [string]$package.version
if (-not $version) {
  throw "Unable to read version from package.json"
}

$tag = "v$version"
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $Branch) {
  throw "Current branch is '$currentBranch', expected '$Branch'"
}

$statusLines = @(git status --short)
if ($statusLines.Count -eq 0) {
  throw "Working tree is clean. Update package.json and CHANGELOG.md before running a release."
}

$localTag = (@(git tag --list $tag) -join "").Trim()
if ($localTag) {
  throw "Tag '$tag' already exists locally."
}

$remoteTag = (@(git ls-remote --tags $Remote $tag) -join "").Trim()
if ($remoteTag) {
  throw "Tag '$tag' already exists on remote '$Remote'."
}

$changelog = Get-Content "CHANGELOG.md" -Raw
if ($changelog -notmatch ("(?m)^## \[{0}\]\b" -f [regex]::Escape($version))) {
  throw "CHANGELOG.md does not contain a section for version $version"
}

if (-not $SkipChecks) {
  Invoke-Step "npm run lint"
  Invoke-Step "npm run test"
  Invoke-Step "npm run typecheck"
}

$commitMessage = "release: $tag"

Invoke-Step "git add ."
Invoke-Step "git commit -m `"$commitMessage`""
Invoke-Step "git push $Remote $Branch"
Invoke-Step "git tag $tag"
Invoke-Step "git push $Remote $tag"

Write-Host ""
if ($DryRun) {
  Write-Host "Dry run completed." -ForegroundColor Yellow
} else {
  Write-Host "Release pushed successfully." -ForegroundColor Green
}
Write-Host "Version: $version"
Write-Host "Tag: $tag"
