# notify_error.ps1
# 育児発信ワークフローのエラーをWindows通知＋ログで知らせる
# 使い方: powershell -File notify_error.ps1 -Message "エラー内容"

param(
    [string]$Message = "エラーが発生しました"
)

$timestamp  = Get-Date -Format "yyyy/MM/dd HH:mm:ss"
$logDir     = "$PSScriptRoot\logs"
$errorLog   = "$logDir\error_notify.log"
$flagFile   = "$PSScriptRoot\logs\ERROR_要確認.txt"

# ── 1. ログファイルに記録 ──
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
"[$timestamp] $Message" | Out-File -FilePath $errorLog -Append -Encoding UTF8

# ── 2. 目立つフラグファイルを作成（エクスプローラーで見つけやすくする）──
@"
育児発信ワークフロー エラー通知
================================
発生日時 : $timestamp
内容     : $Message

対処方法：
  OAuthトークン期限切れの場合
  → cd "$PSScriptRoot"
  → node google_auth.mjs
  → ブラウザでGoogleアカウントにログイン
  → 認証後に auto_run.bat を手動実行して確認

このファイルは確認後に削除してください。
"@ | Out-File -FilePath $flagFile -Encoding UTF8

# ── 3. Windowsトースト通知 ──
try {
    $null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
    $null = [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]

    $appId = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe"
    $xml = @"
<toast>
  <visual>
    <binding template="ToastGeneric">
      <text>⚠️ 育児発信ワークフロー 停止</text>
      <text>$Message</text>
      <text>logs\ERROR_要確認.txt を確認してください</text>
    </binding>
  </visual>
</toast>
"@
    $toastXml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $toastXml.LoadXml($xml)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($toastXml)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
    Write-Host "✅ トースト通知を送信しました"
} catch {
    # トースト通知が使えない環境ではメッセージボックスにフォールバック
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show(
            "[$timestamp]`n$Message`n`nlogs\ERROR_要確認.txt を確認してください",
            "育児発信ワークフロー エラー",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        ) | Out-Null
        Write-Host "✅ メッセージボックスを表示しました"
    } catch {
        Write-Host "⚠️ 通知UIの表示に失敗しました（ログには記録済み）"
    }
}

Write-Host "エラーログ: $errorLog"
Write-Host "フラグファイル: $flagFile"
