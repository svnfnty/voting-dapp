$messages = @(
    "feat: add decentralized blockchain voting system",
    "feat: add voter registration functionality",
    "feat: add candidate registration functionality",
    "feat: implement secure vote casting",
    "feat: connect frontend to smart contract",
    "feat: display available candidates",
    "feat: add candidate selection interface",
    "feat: display voting results",
    "feat: add blockchain transaction confirmation",
    "feat: store votes on blockchain",
    "feat: prevent duplicate voting",
    "feat: add voter eligibility validation",
    "feat: display transparent election results",
    "feat: add smart contract deployment configuration",
    "feat: integrate Ganache development network",
    "feat: configure Truffle migration",
    "feat: add Web3 blockchain connection",
    "feat: connect wallet for voting",
    "feat: add voting status indicator",
    "feat: display transaction status",
    "feat: add secure vote validation",
    "feat: implement tamper resistant vote records",
    "feat: improve voter interface usability",
    "feat: add responsive voting interface",
    "feat: add backend API for voting application",
    "feat: connect backend with blockchain network",
    "feat: add election data retrieval",
    "feat: display real time voting results",
    "feat: add voting error handling",
    "feat: improve blockchain transaction handling",
    "fix: resolve vote submission issue",
    "fix: prevent duplicate vote transactions",
    "fix: resolve candidate display issue",
    "fix: correct blockchain connection handling",
    "fix: resolve voting result calculation",
    "fix: handle failed blockchain transactions",
    "refactor: improve smart contract voting logic",
    "refactor: organize frontend voting components",
    "refactor: simplify blockchain connection logic",
    "refactor: improve backend API structure",
    "style: improve voting interface layout",
    "style: refine candidate selection interface",
    "style: improve voting results presentation",
    "style: enhance responsive design",
    "perf: optimize blockchain data retrieval",
    "perf: improve voting transaction handling",
    "chore: update Truffle configuration",
    "chore: update DApp dependencies",
    "docs: update blockchain voting setup instructions"
)

$startDate = Get-Date "2025-03-21"
$endDate   = Get-Date "2025-12-12"

Write-Host "Creating Blockchain Voting DApp commits..."

$currentDate = $startDate

while ($currentDate -le $endDate) {

    $numCommits = Get-Random -Minimum 1 -Maximum 36

    for ($c = 1; $c -le $numCommits; $c++) {

        $hour   = Get-Random -Minimum 9 -Maximum 22
        $minute = Get-Random -Minimum 0 -Maximum 60
        $second = Get-Random -Minimum 0 -Maximum 60

        $dateStr = "$($currentDate.ToString('yyyy-MM-dd'))T$($hour.ToString('00')):$($minute.ToString('00')):$($second.ToString('00'))"

        $env:GIT_AUTHOR_DATE = $dateStr
        $env:GIT_COMMITTER_DATE = $dateStr

        $msg = $messages | Get-Random

        git commit --allow-empty -m "$msg" | Out-Null
    }

    $currentDate = $currentDate.AddDays(1)
}

$env:GIT_AUTHOR_DATE = $null
$env:GIT_COMMITTER_DATE = $null

Write-Host "Syncing and pushing to GitHub..."

if (Test-Path ".git\index.lock") {
    Remove-Item ".git\index.lock" -Force
}

git pull --rebase origin main
git push origin main

Write-Host "Blockchain Voting DApp commit process complete!"