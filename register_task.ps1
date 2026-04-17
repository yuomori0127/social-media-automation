# Windows タスクスケジューラへの登録スクリプト
# PowerShell で実行: powershell -ExecutionPolicy Bypass -File register_task.ps1

$taskName    = "育児発信ワークフロー_毎朝4時"
$scriptPath  = Join-Path $PSScriptRoot "auto_run.bat"
$triggerTime = "04:00"

# 既存タスクがあれば削除
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "既存タスクを削除しました"
}

# トリガー：毎日 04:00
$trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime

# アクション：auto_run.bat を実行
$action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$scriptPath`"" `
    -WorkingDirectory $PSScriptRoot

# 設定：PCがスリープ中でも起動・AC/バッテリー両対応
$settings = New-ScheduledTaskSettingsSet `
    -WakeToRun `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -RestartCount 1 `
    -RestartInterval (New-TimeSpan -Minutes 30)

# 登録（現在のユーザーで実行）
Register-ScheduledTask `
    -TaskName $taskName `
    -Trigger $trigger `
    -Action $action `
    -Settings $settings `
    -RunLevel Highest `
    -Force

Write-Host ""
Write-Host "✅ タスク登録完了: $taskName"
Write-Host "   実行時刻: 毎日 $triggerTime"
Write-Host "   スクリプト: $scriptPath"
Write-Host ""

# 登録確認
Get-ScheduledTask -TaskName $taskName | Format-List TaskName, State
