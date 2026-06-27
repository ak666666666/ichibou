// ============================================================
// 一望 Drive 自動バックアップモジュール
// ============================================================
// 作成: 2026-06-27(Cowork 自律進行 / 神田晃良 の依頼)
// 目的: localStorage `ichibou_v3` の変更を Google Drive に自動バックアップ
// 仕組み: Google Identity Services (GIS) で OAuth → Drive API で JSON 保存
// 認証: 初回1回だけ・以後はリフレッシュトークンで自動継続
// ============================================================

(function() {
  'use strict';

  // ===== 設定(神田晃良 のセットアップ後に値を入れる) =====
  const DRIVE_CONFIG = {
    // Google Cloud Console で作成した OAuth Client ID(セットアップガイド参照)
    CLIENT_ID: '732527478235-snkt39luu85vmamuv2goe3r4ud3a8a4t.apps.googleusercontent.com',
    // 保存先 Drive フォルダ ID(_一望_自動バックアップ フォルダ)
    FOLDER_ID: '1ZJKKyk2su11mf_Bcv1AYvkBN0A0AN2Be',
    // 保存頻度の最小間隔(ミリ秒)— 同期の連発を防ぐ
    MIN_INTERVAL_MS: 5 * 60 * 1000, // 5分
    // ファイル名の世代管理(日次1ファイルに上書きするか、毎回新規か)
    MODE: 'hourly_snapshot', // 'hourly_snapshot' | 'daily_overwrite' | 'every_save'
    // Drive API スコープ(自分が作ったファイルのみ書き込み = 最小権限)
    SCOPE: 'https://www.googleapis.com/auth/drive.file'
  };

  // ===== 状態 =====
  let driveState = {
    enabled: false,           // ユーザーが有効化したか
    tokenClient: null,        // GIS トークンクライアント
    accessToken: null,        // 現在のアクセストークン
    tokenExpiresAt: 0,        // トークン有効期限(UNIX時刻ミリ秒)
    lastBackupAt: 0,          // 最後にバックアップした時刻
    lastBackupStatus: null,   // 'success' | 'error' | null
    backupInProgress: false,  // バックアップ中フラグ
    queuedBackup: false,      // バックアップを保留中フラグ
  };

  // localStorage キー
  const STORAGE_KEYS = {
    ENABLED: 'ichibou_drive_backup_enabled',
    TOKEN: 'ichibou_drive_token',
    TOKEN_EXPIRES: 'ichibou_drive_token_expires',
    LAST_BACKUP: 'ichibou_drive_last_backup',
  };

  // ===== 初期化 =====
  function init() {
    // 設定をローカルストレージから復元
    driveState.enabled = localStorage.getItem(STORAGE_KEYS.ENABLED) === 'true';
    const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const savedExpires = parseInt(localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES) || '0', 10);
    if (savedToken && savedExpires > Date.now()) {
      driveState.accessToken = savedToken;
      driveState.tokenExpiresAt = savedExpires;
    }
    driveState.lastBackupAt = parseInt(localStorage.getItem(STORAGE_KEYS.LAST_BACKUP) || '0', 10);

    // GIS スクリプトを動的読み込み
    if (typeof google === 'undefined' || !google.accounts) {
      loadGisScript().then(() => {
        if (driveState.enabled) {
          setupTokenClient();
        }
        injectUI();
      }).catch(err => {
        console.error('[DriveSync] GIS load failed:', err);
        injectUI(); // UI は表示する(無効状態)
      });
    } else {
      if (driveState.enabled) setupTokenClient();
      injectUI();
    }

    // 設定が PLACEHOLDER のままなら警告
    if (DRIVE_CONFIG.CLIENT_ID.startsWith('PLACEHOLDER_')) {
      console.warn('[DriveSync] CLIENT_ID が未設定です。セットアップガイドを参照してください。');
    }
  }

  function loadGisScript() {
    return new Promise((resolve, reject) => {
      if (document.getElementById('gis-script')) { resolve(); return; }
      const script = document.createElement('script');
      script.id = 'gis-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  function setupTokenClient() {
    if (DRIVE_CONFIG.CLIENT_ID.startsWith('PLACEHOLDER_')) return;
    try {
      driveState.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: DRIVE_CONFIG.CLIENT_ID,
        scope: DRIVE_CONFIG.SCOPE,
        callback: handleTokenResponse,
      });
    } catch (e) {
      console.error('[DriveSync] setupTokenClient failed:', e);
    }
  }

  function handleTokenResponse(resp) {
    if (resp.error) {
      console.error('[DriveSync] Token error:', resp.error);
      updateUIStatus('error', '認証失敗');
      return;
    }
    driveState.accessToken = resp.access_token;
    driveState.tokenExpiresAt = Date.now() + (resp.expires_in * 1000) - 60000; // 1分マージン
    localStorage.setItem(STORAGE_KEYS.TOKEN, resp.access_token);
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES, String(driveState.tokenExpiresAt));
    updateUIStatus('connected', '接続済');
    // 認証直後に1回バックアップ
    triggerBackup();
  }

  function requestAccessToken(interactive) {
    if (!driveState.tokenClient) {
      console.warn('[DriveSync] Token client not ready');
      return;
    }
    // interactive=true なら同意画面を出す・false なら silent refresh
    driveState.tokenClient.requestAccessToken({ prompt: interactive ? '' : 'none' });
  }

  // ===== バックアップ機能 =====
  async function triggerBackup() {
    if (!driveState.enabled) return;
    if (driveState.backupInProgress) {
      driveState.queuedBackup = true;
      return;
    }

    // 最小間隔チェック
    const now = Date.now();
    if (now - driveState.lastBackupAt < DRIVE_CONFIG.MIN_INTERVAL_MS) {
      driveState.queuedBackup = true;
      setTimeout(() => {
        if (driveState.queuedBackup) {
          driveState.queuedBackup = false;
          triggerBackup();
        }
      }, DRIVE_CONFIG.MIN_INTERVAL_MS - (now - driveState.lastBackupAt));
      return;
    }

    // トークン期限チェック
    if (!driveState.accessToken || driveState.tokenExpiresAt < now + 30000) {
      // 自動でリフレッシュ試行
      requestAccessToken(false);
      driveState.queuedBackup = true;
      setTimeout(() => {
        if (driveState.queuedBackup && driveState.accessToken) {
          driveState.queuedBackup = false;
          triggerBackup();
        }
      }, 3000);
      return;
    }

    driveState.backupInProgress = true;
    updateUIStatus('syncing', 'バックアップ中');

    try {
      const stateData = getCurrentState();
      const filename = generateFilename();
      await uploadToDrive(filename, stateData);
      driveState.lastBackupAt = now;
      localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, String(now));
      driveState.lastBackupStatus = 'success';
      updateUIStatus('connected', '接続済(直近 ' + formatTime(now) + ')');
    } catch (err) {
      console.error('[DriveSync] Backup failed:', err);
      driveState.lastBackupStatus = 'error';
      updateUIStatus('error', 'バックアップ失敗');
    } finally {
      driveState.backupInProgress = false;
      // キューに積まれてたら再実行
      if (driveState.queuedBackup) {
        driveState.queuedBackup = false;
        setTimeout(triggerBackup, 1000);
      }
    }
  }

  function getCurrentState() {
    try {
      const raw = localStorage.getItem('ichibou_v3');
      return raw || '{}';
    } catch (e) {
      return '{}';
    }
  }

  function generateFilename() {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    if (DRIVE_CONFIG.MODE === 'daily_overwrite') {
      return `state_${YYYY}-${MM}-${DD}.json`;
    } else if (DRIVE_CONFIG.MODE === 'every_save') {
      const ss = String(now.getSeconds()).padStart(2, '0');
      return `state_${YYYY}-${MM}-${DD}_${HH}-${mm}-${ss}.json`;
    } else { // 'hourly_snapshot' (default)
      return `state_${YYYY}-${MM}-${DD}_${HH}-${mm}.json`;
    }
  }

  async function uploadToDrive(filename, content) {
    const metadata = {
      name: filename,
      parents: [DRIVE_CONFIG.FOLDER_ID],
      mimeType: 'application/json'
    };

    const boundary = '-------314159265358979323846';
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelimiter = '\r\n--' + boundary + '--';

    const body =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      content +
      closeDelimiter;

    const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + driveState.accessToken,
        'Content-Type': 'multipart/related; boundary=' + boundary
      },
      body: body
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error('Drive upload failed: ' + resp.status + ' ' + errText);
    }

    return await resp.json();
  }

  // ===== UI =====
  function injectUI() {
    // 既存の UI があれば削除
    const existing = document.getElementById('drive-sync-ui');
    if (existing) existing.remove();

    // 設定エリアを探す(or 作る)
    const targetEl = document.querySelector('header.top .meta');
    if (!targetEl) return;

    const ui = document.createElement('div');
    ui.id = 'drive-sync-ui';
    ui.style.cssText = `
      margin-top: 8px;
      font-family: "JetBrains Mono", monospace;
      font-size: 10px;
      color: #8a857a;
      letter-spacing: 0.1em;
      cursor: pointer;
      user-select: none;
    `;
    ui.title = 'Google Drive 自動バックアップ設定';
    ui.onclick = showSettingsModal;
    targetEl.appendChild(ui);

    // 初期表示更新
    if (driveState.enabled && driveState.accessToken) {
      updateUIStatus('connected', '☁ Drive 接続済');
    } else if (driveState.enabled) {
      updateUIStatus('disconnected', '☁ Drive 未認証');
    } else {
      updateUIStatus('off', '☁ Drive バックアップ OFF');
    }
  }

  function updateUIStatus(status, text) {
    const ui = document.getElementById('drive-sync-ui');
    if (!ui) return;
    ui.textContent = text;
    const colors = {
      connected: '#4a6b3a',
      syncing: '#b88a2e',
      disconnected: '#c8502e',
      error: '#a13630',
      off: '#8a857a'
    };
    ui.style.color = colors[status] || '#8a857a';
  }

  function showSettingsModal() {
    const isPlaceholder = DRIVE_CONFIG.CLIENT_ID.startsWith('PLACEHOLDER_');

    const modal = document.createElement('div');
    modal.id = 'drive-sync-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(26,25,21,0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    const inner = document.createElement('div');
    inner.style.cssText = `
      background: #f4f1ea; border: 1px solid #cfc8b8;
      padding: 32px; max-width: 480px; width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      font-family: "Zen Kaku Gothic New", sans-serif;
    `;

    let html = `
      <h3 style="font-family:'Shippori Mincho',serif;font-size:18px;margin-bottom:16px;letter-spacing:0.05em">
        ☁ Google Drive バックアップ
      </h3>
    `;

    if (isPlaceholder) {
      html += `
        <p style="color:#c8502e;font-size:13px;margin-bottom:16px;line-height:1.7">
          ⚠ セットアップ未完了です。<br>
          まず Google Cloud Console で OAuth Client ID を作成し、
          drive-sync.js の CLIENT_ID を設定してください。
        </p>
        <p style="color:#4a4740;font-size:12px;margin-bottom:20px;line-height:1.7">
          詳細: <code>_セットアップ_Driveバックアップ.md</code> を参照
        </p>
        <div style="text-align:right">
          <button id="drive-close-btn" style="padding:8px 16px;border:1px solid #cfc8b8;background:#fbf9f3;cursor:pointer;font-family:inherit">閉じる</button>
        </div>
      `;
    } else if (!driveState.enabled) {
      html += `
        <p style="color:#4a4740;font-size:13px;margin-bottom:16px;line-height:1.7">
          一望のデータを Google Drive に自動バックアップします。<br>
          有効化すると、5分ごとに最新の状態が Drive に保存されます。
        </p>
        <p style="color:#8a857a;font-size:12px;margin-bottom:20px;line-height:1.7">
          • 認証は初回1回だけ(以後自動)<br>
          • アクセス権は最小限(自分の作ったファイルのみ)<br>
          • 保存先: 「_一望_自動バックアップ」フォルダ
        </p>
        <div style="text-align:right;display:flex;gap:8px;justify-content:flex-end">
          <button id="drive-close-btn" style="padding:8px 16px;border:1px solid #cfc8b8;background:#fbf9f3;cursor:pointer;font-family:inherit">キャンセル</button>
          <button id="drive-enable-btn" style="padding:8px 16px;border:none;background:#1a1915;color:#f4f1ea;cursor:pointer;font-family:inherit">有効化する</button>
        </div>
      `;
    } else {
      html += `
        <p style="color:#4a4740;font-size:13px;margin-bottom:8px;line-height:1.7">
          ✓ 自動バックアップ <strong>有効</strong>
        </p>
        <p style="color:#8a857a;font-size:12px;margin-bottom:20px;line-height:1.7">
          ${driveState.lastBackupAt > 0 ? '最終バックアップ: ' + formatDateTime(driveState.lastBackupAt) : 'まだバックアップしていません'}<br>
          認証状態: ${driveState.accessToken && driveState.tokenExpiresAt > Date.now() ? '接続中' : '再認証が必要'}
        </p>
        <div style="text-align:right;display:flex;gap:8px;justify-content:flex-end">
          <button id="drive-close-btn" style="padding:8px 16px;border:1px solid #cfc8b8;background:#fbf9f3;cursor:pointer;font-family:inherit">閉じる</button>
          <button id="drive-backup-now" style="padding:8px 16px;border:1px solid #cfc8b8;background:#fbf9f3;cursor:pointer;font-family:inherit">今すぐバックアップ</button>
          <button id="drive-disable-btn" style="padding:8px 16px;border:1px solid #d9b5af;background:#fbf9f3;color:#a13630;cursor:pointer;font-family:inherit">無効化</button>
        </div>
      `;
    }

    inner.innerHTML = html;
    modal.appendChild(inner);
    document.body.appendChild(modal);

    // イベントバインド
    const closeBtn = document.getElementById('drive-close-btn');
    if (closeBtn) closeBtn.onclick = () => modal.remove();

    const enableBtn = document.getElementById('drive-enable-btn');
    if (enableBtn) enableBtn.onclick = () => {
      modal.remove();
      enableSync();
    };

    const disableBtn = document.getElementById('drive-disable-btn');
    if (disableBtn) disableBtn.onclick = () => {
      modal.remove();
      disableSync();
    };

    const backupBtn = document.getElementById('drive-backup-now');
    if (backupBtn) backupBtn.onclick = () => {
      modal.remove();
      // 強制バックアップ(min interval 無視)
      driveState.lastBackupAt = 0;
      triggerBackup();
    };
  }

  function enableSync() {
    driveState.enabled = true;
    localStorage.setItem(STORAGE_KEYS.ENABLED, 'true');
    if (!driveState.tokenClient) setupTokenClient();
    // 即座に認証フローを開始
    requestAccessToken(true);
    updateUIStatus('syncing', '☁ 認証中…');
  }

  function disableSync() {
    driveState.enabled = false;
    driveState.accessToken = null;
    driveState.tokenExpiresAt = 0;
    localStorage.setItem(STORAGE_KEYS.ENABLED, 'false');
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES);
    updateUIStatus('off', '☁ Drive バックアップ OFF');
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function formatDateTime(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${formatTime(ts)}`;
  }

  // ===== 公開 API =====
  window.IchibouDriveSync = {
    triggerBackup: triggerBackup,
    showSettings: showSettingsModal,
    isEnabled: () => driveState.enabled,
    forceBackup: () => {
      driveState.lastBackupAt = 0;
      triggerBackup();
    }
  };

  // ===== 既存の saveState() にフックする(本体のコードを書き換えずに監視) =====
  // localStorage の ichibou_v3 が更新されたら triggerBackup() を呼ぶ
  // 連発防止のためデバウンス
  let saveDebounce = null;
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    originalSetItem(key, value);
    if (key === 'ichibou_v3' && driveState.enabled) {
      if (saveDebounce) clearTimeout(saveDebounce);
      saveDebounce = setTimeout(() => {
        triggerBackup();
      }, 30000); // 30秒のデバウンス
    }
  };

  // DOMContentLoaded で初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
