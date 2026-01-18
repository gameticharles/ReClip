<#
.SYNOPSIS
    Advanced release automation script for ReClip.

.DESCRIPTION
    Features:
    - Dry-run mode to preview changes
    - Auto-increment version (patch/minor/major)
    - Changelog generation from git commits
    - Pre-release build/type checks
    - Branch protection (main only)
    - Rollback support
    - Opens GitHub Actions after push
    - Release notes saved to CHANGELOG.md
    - Config file backups
    - Summary display

.EXAMPLE
    # Standard release with specific version
    ./release.ps1 -Version "0.1.2"

.EXAMPLE
    # Auto-increment version (patch: 0.1.1 -> 0.1.2)
    ./release.ps1 -Bump patch

.EXAMPLE
    # Auto-increment version (minor: 0.1.2 -> 0.2.0)
    ./release.ps1 -Bump minor

.EXAMPLE
    # Auto-increment version (major: 0.2.0 -> 1.0.0)
    ./release.ps1 -Bump major

.EXAMPLE
    # Dry-run to preview without making changes
    ./release.ps1 -Bump patch -DryRun

.EXAMPLE
    # Skip TypeScript checks (faster, but less safe)
    ./release.ps1 -Bump patch -SkipTests

.EXAMPLE
    # Don't open browser after push
    ./release.ps1 -Bump patch -NoBrowser

.EXAMPLE
    # Rollback the last release (deletes tag, reverts commit)
    ./release.ps1 -Rollback

.EXAMPLE
    # Combine flags: dry-run with version bump, skip tests
    ./release.ps1 -Bump minor -DryRun -SkipTests
#>

param (
    [string]$Version,
    [ValidateSet("patch", "minor", "major")]
    [string]$Bump,
    [switch]$DryRun,
    [switch]$Rollback,
    [switch]$SkipTests,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

# ============================================================
# CONFIGURATION
# ============================================================
$PackageJsonPath = "reclip-app/package.json"
$TauriConfPath = "reclip-app/src-tauri/tauri.conf.json"
$ChangelogPath = "CHANGELOG.md"
$GitHubActionsUrl = "https://github.com/gameticharles/ReClip/actions"
$RequiredBranch = "main"

# ============================================================
# HELPER FUNCTIONS
# ============================================================
function Write-Step { param([string]$Message); Write-Host -ForegroundColor Cyan "`n[STEP] $Message" }
function Write-Success { param([string]$Message); Write-Host -ForegroundColor Green "[OK] $Message" }
function Write-ErrorMsg { param([string]$Message); Write-Host -ForegroundColor Red "[ERROR] $Message" }
function Write-WarningMsg { param([string]$Message); Write-Host -ForegroundColor Yellow "[WARN] $Message" }
function Write-DryRun { param([string]$Message); Write-Host -ForegroundColor Magenta "[DRY-RUN] $Message" }
function Write-Info { param([string]$Message); Write-Host -ForegroundColor White "[INFO] $Message" }

function Get-CurrentVersion {
    $json = Get-Content $TauriConfPath -Raw | ConvertFrom-Json
    return $json.version
}

function Bump-Version {
    param([string]$Current, [string]$Type)
    $parts = $Current.Split('.')
    switch ($Type) {
        "major" { $parts[0] = [int]$parts[0] + 1; $parts[1] = 0; $parts[2] = 0 }
        "minor" { $parts[1] = [int]$parts[1] + 1; $parts[2] = 0 }
        "patch" { $parts[2] = [int]$parts[2] + 1 }
    }
    return "$($parts[0]).$($parts[1]).$($parts[2])"
}

function Get-LastTag {
    $tags = git tag --sort=-v:refname 2>$null
    if ($tags) { return ($tags | Select-Object -First 1) }
    return $null
}

function Get-Changelog {
    param([string]$Since)
    if ($Since) {
        $commits = git log "$Since..HEAD" --pretty=format:"- %s (%h)" --no-merges 2>$null
    }
    else {
        $commits = git log --pretty=format:"- %s (%h)" --no-merges -20 2>$null
    }
    return $commits
}

function Backup-File {
    param([string]$Path)
    if (Test-Path $Path) {
        $backupPath = "$Path.bak"
        Copy-Item $Path $backupPath -Force
        return $backupPath
    }
    return $null
}

function Restore-Backup {
    param([string]$Path)
    $backupPath = "$Path.bak"
    if (Test-Path $backupPath) {
        Copy-Item $backupPath $Path -Force
        Remove-Item $backupPath -Force
    }
}

# ============================================================
# ROLLBACK MODE
# ============================================================
if ($Rollback) {
    Write-Step "Rollback Mode - Undoing last release..."
    
    $lastTag = Get-LastTag
    if (-not $lastTag) {
        Write-ErrorMsg "No tags found to rollback."
        exit 1
    }
    
    Write-WarningMsg "This will delete tag '$lastTag' and revert the last commit."
    $confirm = Read-Host "Are you sure? (yes/no)"
    if ($confirm -ne 'yes') {
        Write-Info "Rollback cancelled."
        exit 0
    }
    
    if ($DryRun) {
        Write-DryRun "Would delete local tag: $lastTag"
        Write-DryRun "Would delete remote tag: $lastTag"
        Write-DryRun "Would revert last commit"
    }
    else {
        # Temporarily suppress errors for git commands (git writes to stderr even on success)
        $oldErrorAction = $ErrorActionPreference
        $ErrorActionPreference = "SilentlyContinue"
        git tag -d $lastTag 2>&1 | Out-Null
        git push origin --delete $lastTag 2>&1 | Out-Null
        $ErrorActionPreference = $oldErrorAction
        git revert HEAD --no-edit
        git push origin main
        Write-Success "Rolled back release $lastTag"
    }
    exit 0
}

# ============================================================
# VALIDATION
# ============================================================

# Check branch
Write-Step "Checking branch..."
$currentBranch = git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne $RequiredBranch) {
    Write-ErrorMsg "Releases must be made from '$RequiredBranch' branch. Currently on '$currentBranch'."
    exit 1
}
Write-Success "On branch: $currentBranch"

# Git fetch
Write-Step "Fetching latest from remote..."
if (-not $DryRun) { git fetch --tags 2>&1 | Out-Null }
Write-Success "Tags synchronized"

# Check files exist
if (-not (Test-Path $PackageJsonPath) -or -not (Test-Path $TauriConfPath)) {
    Write-ErrorMsg "Configuration files not found. Run from project root."
    exit 1
}

# Get current version
$currentVersion = Get-CurrentVersion
Write-Info "Current version: $currentVersion"

# Determine new version
if ($Bump) {
    $Version = Bump-Version -Current $currentVersion -Type $Bump
    Write-Info "Auto-incremented ($Bump): $currentVersion -> $Version"
}
elseif (-not $Version) {
    Write-ErrorMsg "Please specify -Version or -Bump parameter."
    exit 1
}

# Validate version format
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-ErrorMsg "Invalid version format '$Version'. Expected: x.y.z"
    exit 1
}

$TagName = "v$Version"

# Check if tag exists
$existingTag = git tag -l $TagName
if ($existingTag) {
    Write-ErrorMsg "Tag '$TagName' already exists!"
    $deleteTag = Read-Host "Delete and recreate? (y/n)"
    if ($deleteTag -eq 'y') {
        if (-not $DryRun) {
            # Temporarily suppress errors for git commands (git writes to stderr even on success)
            $oldErrorAction = $ErrorActionPreference
            $ErrorActionPreference = "SilentlyContinue"
            git tag -d $TagName 2>&1 | Out-Null
            git push origin --delete $TagName 2>&1 | Out-Null
            $ErrorActionPreference = $oldErrorAction
        }
        Write-Success "Deleted existing tag"
    }
    else {
        exit 1
    }
}

# Check git status
Write-Step "Checking uncommitted changes..."
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-WarningMsg "Uncommitted changes detected:"
    $gitStatus | ForEach-Object { Write-Host "  $_" }
    $confirm = Read-Host "Include in release commit? (y/n)"
    if ($confirm -ne 'y') { exit 1 }
}

# ============================================================
# PRE-RELEASE TESTS
# ============================================================
if (-not $SkipTests) {
    Write-Step "Running pre-release checks..."
    Push-Location "reclip-app"
    try {
        if ($DryRun) {
            Write-DryRun "Would run: npx tsc --noEmit"
        }
        else {
            Write-Info "Type checking..."
            npx tsc --noEmit
            if ($LASTEXITCODE -ne 0) {
                Write-ErrorMsg "TypeScript check failed!"
                exit 1
            }
            Write-Success "Type check passed"
        }
    }
    finally {
        Pop-Location
    }
}
else {
    Write-WarningMsg "Skipping pre-release tests (-SkipTests)"
}

# ============================================================
# CHANGELOG GENERATION
# ============================================================
Write-Step "Generating changelog..."
$lastTag = Get-LastTag
$changelog = Get-Changelog -Since $lastTag
if ($changelog) {
    Write-Host "`nChanges since $lastTag :"
    $changelog | ForEach-Object { Write-Host "  $_" }
}
else {
    Write-WarningMsg "No commits found for changelog"
    $changelog = "- Initial release"
}

# Prompt for release notes
Write-Host ""
$releaseNotes = Read-Host "Enter release notes (or press Enter to use auto-generated)"
if ([string]::IsNullOrWhiteSpace($releaseNotes)) {
    $releaseNotes = $changelog -join "`n"
}

# ============================================================
# UPDATE FILES
# ============================================================

# Backup files
Write-Step "Creating backups..."
$backups = @()
if (-not $DryRun) {
    $backups += Backup-File $PackageJsonPath
    $backups += Backup-File $TauriConfPath
    Write-Success "Backups created (.bak files)"
}
else {
    Write-DryRun "Would backup: $PackageJsonPath, $TauriConfPath"
}

try {
    # Update package.json
    Write-Step "Updating $PackageJsonPath..."
    if ($DryRun) {
        Write-DryRun "Would set version to: $Version"
    }
    else {
        $packageJson = Get-Content $PackageJsonPath -Raw
        $packageJson = $packageJson -replace '"version":\s*"\d+\.\d+\.\d+"', "`"version`": `"$Version`""
        Set-Content -Path $PackageJsonPath -Value $packageJson -NoNewline
        Write-Success "Updated package.json"
    }

    # Update tauri.conf.json
    Write-Step "Updating $TauriConfPath..."
    if ($DryRun) {
        Write-DryRun "Would set version to: $Version"
    }
    else {
        $tauriConf = Get-Content $TauriConfPath -Raw
        $tauriConf = $tauriConf -replace '"version":\s*"\d+\.\d+\.\d+"', "`"version`": `"$Version`""
        Set-Content -Path $TauriConfPath -Value $tauriConf -NoNewline
        Write-Success "Updated tauri.conf.json"
    }

    # Update CHANGELOG.md
    Write-Step "Updating $ChangelogPath..."
    $changelogEntry = @"
## [$Version] - $(Get-Date -Format "yyyy-MM-dd")

$releaseNotes

"@
    if ($DryRun) {
        Write-DryRun "Would prepend to CHANGELOG.md:"
        Write-Host $changelogEntry
    }
    else {
        if (Test-Path $ChangelogPath) {
            $existingChangelog = Get-Content $ChangelogPath -Raw
            $newChangelog = $changelogEntry + $existingChangelog
        }
        else {
            $newChangelog = "# Changelog`n`n" + $changelogEntry
        }
        Set-Content -Path $ChangelogPath -Value $newChangelog
        Write-Success "Updated CHANGELOG.md"
    }

    # ============================================================
    # GIT OPERATIONS
    # ============================================================
    
    # Commit message
    Write-Step "Preparing commit..."
    $defaultMessage = "chore: Release $TagName"
    Write-Host "Default: $defaultMessage"
    $customMessage = Read-Host "Commit message (Enter for default)"
    $commitMessage = if ([string]::IsNullOrWhiteSpace($customMessage)) { $defaultMessage } else { $customMessage }

    if ($DryRun) {
        Write-DryRun "Would commit: $commitMessage"
        Write-DryRun "Would create tag: $TagName"
        Write-DryRun "Would push to origin"
    }
    else {
        git add $PackageJsonPath $TauriConfPath $ChangelogPath
        git add -A  # Include any other changes
        git commit -m $commitMessage
        if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
        Write-Success "Committed"

        git tag $TagName
        if ($LASTEXITCODE -ne 0) { throw "Tag creation failed" }
        Write-Success "Tag '$TagName' created"

        git push origin main
        if ($LASTEXITCODE -ne 0) { throw "Push failed" }
        git push origin $TagName
        if ($LASTEXITCODE -ne 0) { throw "Tag push failed" }
        Write-Success "Pushed to GitHub"
    }

    # ============================================================
    # SUMMARY
    # ============================================================
    Write-Host ""
    Write-Host -ForegroundColor Green "=========================================================="
    Write-Host -ForegroundColor Green "                    RELEASE SUMMARY"
    Write-Host -ForegroundColor Green "=========================================================="
    Write-Host -ForegroundColor White "  Version:        $currentVersion -> $Version"
    Write-Host -ForegroundColor White "  Tag:            $TagName"
    Write-Host -ForegroundColor White "  Branch:         $currentBranch"
    Write-Host -ForegroundColor White "  Commit:         $commitMessage"
    Write-Host -ForegroundColor White "  Changelog:      $ChangelogPath updated"
    if ($DryRun) {
        Write-Host -ForegroundColor Magenta "  Mode:           DRY-RUN (no changes made)"
    }
    else {
        Write-Host -ForegroundColor Green "  Status:         SUCCESS"
    }
    Write-Host -ForegroundColor Green "=========================================================="

    # Open browser
    if (-not $DryRun -and -not $NoBrowser) {
        Write-Step "Opening GitHub Actions..."
        Start-Process $GitHubActionsUrl
    }

    # Cleanup backups on success
    if (-not $DryRun) {
        Remove-Item "$PackageJsonPath.bak" -Force -ErrorAction SilentlyContinue
        Remove-Item "$TauriConfPath.bak" -Force -ErrorAction SilentlyContinue
    }

}
catch {
    Write-ErrorMsg "Release failed: $_"
    
    # Restore backups on failure
    if (-not $DryRun) {
        Write-WarningMsg "Restoring backups..."
        Restore-Backup $PackageJsonPath
        Restore-Backup $TauriConfPath
    }
    exit 1
}
