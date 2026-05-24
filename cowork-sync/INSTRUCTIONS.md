# Cowork → 一望 同期: Claudeへの指示書

> 🎯 **このファイルは、Cowork(ディスパッチ)セッションのClaudeが `/sync-ichibou` を受け取ったときに従う処理手順を定めたものです。**
> Cowork セッション開始時、または `/sync-ichibou` を受け取ったときに、まずこのファイルを読んでください。

---

## 1. トリガー(発動条件)

ユーザーが以下のいずれかを発した場合、本ファイルの処理を実行する:

- `/sync-ichibou`
- `/sync-ichibou プロジェクト=会社経営` のようにヒントが付くケース
- `/sync-ichibou 期限=今週中` 等の付加情報

スラッシュコマンドはClaudeが特別扱いするわけではなく、**ユーザーの発話としてマッチング**して処理に入る。確実にトリガーするには厳密に `/sync-ichibou` で始まる発話を見ること。

---

## 2. 処理フロー

```
[1] 直前の会話からTODO/タスク候補を抽出
[2] 各候補をitems[]構造に整形(後述§3)
[3] cw_idを算出
[4] Supabase REST APIにPOST(後述§4)
[5] 結果を晃良に報告(成功なら件数、失敗ならraw_mdだけでも投入を試みる)
```

---

## 3. items[]の構造

各タスクは以下の形にする(`feature_cowork_sync.md` §4-2 と同じ):

```json
{
  "kind": "task",                  // task | moya | note
  "title": "タイトル(必須)",
  "detail": "詳細(任意)",
  "due": "2026-05-01",             // ISO8601 日付 or null
  "priority": "high",              // high | normal | low | null
  "project_hint": "Y社案件",       // 推測されたプロジェクト名 or null
  "raw_md": "- [ ] タイトル ..."   // 元のマークダウン抜粋(任意)
}
```

### 3-1. kind 判定ルール

| 元の表現 | kind |
|---|---|
| `- [ ] xxx` (チェックボックス) | `task` |
| `## 〇〇について考える` のような単発の問い | `moya` |
| 上記以外の素のメモ・発見・気づき | `note` |

### 3-2. priority 判定ルール

| 表現 | priority |
|---|---|
| 🔥 / `!!` / `(高)` / `P0` / `緊急` / `今すぐ` | `high` |
| (記載なし) | `normal` |
| `(低)` / `いつか` / `余裕があれば` / `P3` | `low` |

### 3-3. project_hint 推測

- 既存プロジェクト名の一覧は事前に把握しておく(取得方法は §6 参照)
- タスク本文に部分一致するプロジェクト名があれば `project_hint` に入れる
- 不明確なら null。**自動振り分けはしない**(晃良が手動で受信箱から振り分ける方針)

---

## 4. 自然言語期日の正規化

基準は**今日**。日本標準時(Asia/Tokyo)で扱う。

| 入力 | 出力(例:今日が 2026-04-28 火 の場合) |
|---|---|
| `今日` / `本日` | `2026-04-28` |
| `明日` | `2026-04-29` |
| `あさって` | `2026-04-30` |
| `今週中` / `今週末` | その週の **金曜日** の日付 |
| `来週月曜` | `2026-05-04` |
| `5/1` / `5月1日` | `2026-05-01`(年は今日基準で推測) |
| `木曜` | 今週の木曜日(過ぎていれば来週の木曜日) |
| 期日表現なし | `null` |

---

## 5. cw_id 算出

```
cw_id = sha1(title + "|" + (detail || "") + "|" + (due || "")) の先頭8文字
```

- bashなら: `echo -n "title|detail|due" | shasum | cut -c1-8`
- Python: `hashlib.sha1(s.encode()).hexdigest()[:8]`
- Node: `crypto.createHash('sha1').update(s).digest('hex').slice(0,8)`

同一会話内で重複が出たら除去(最後に出てきたもの優先)。

---

## 6. Supabase REST API への POST

### 6-1. エンドポイント

```
POST https://jhsjcepsqftnvvyqftmb.supabase.co/rest/v1/ichibou_inbox
```

### 6-2. ヘッダ

```
apikey: sb_publishable_t17xdBGDadspxbuo-KP2zA_MGoAQn0A
Authorization: Bearer sb_publishable_t17xdBGDadspxbuo-KP2zA_MGoAQn0A
Content-Type: application/json
Prefer: return=minimal
```

publishable key はクライアントHTMLにベタ書きされているのと同じものを使う(個人運用のため、これでOKという晃良判断 #5)。

### 6-3. ペイロード(1件ずつ POST するか、配列で一括 POST)

一括で送る場合(推奨):

```json
[
  {
    "cw_id": "a4f9b2e1",
    "kind": "task",
    "title": "Y社の見積もり再送",
    "detail": "PDFを最新版に差し替えて木曜までに",
    "due": "2026-05-01",
    "priority": "high",
    "project_hint": "Y社案件",
    "raw_md": "- [ ] 🔥 Y社の見積もり再送(木曜まで)\n  - PDFを最新版に差し替えて"
  }
]
```

### 6-4. curl コマンド例

```bash
curl -X POST "https://jhsjcepsqftnvvyqftmb.supabase.co/rest/v1/ichibou_inbox" \
  -H "apikey: sb_publishable_t17xdBGDadspxbuo-KP2zA_MGoAQn0A" \
  -H "Authorization: Bearer sb_publishable_t17xdBGDadspxbuo-KP2zA_MGoAQn0A" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '[{"cw_id":"a4f9b2e1","kind":"task","title":"Y社の見積もり再送","detail":"PDFを最新版に差し替えて木曜までに","due":"2026-05-01","priority":"high","project_hint":"Y社案件","raw_md":""}]'
```

### 6-5. 既存プロジェクト一覧の取得

`project_hint` を埋めるには、現在の一望のプロジェクト一覧が必要。これは:

```bash
curl "https://jhsjcepsqftnvvyqftmb.supabase.co/rest/v1/ichibou_state?id=eq.main&select=data" \
  -H "apikey: sb_publishable_t17xdBGDadspxbuo-KP2zA_MGoAQn0A"
```

レスポンスから `data.projects[].name` を取り出して、`frozen=false` のもののみ候補にする。

---

## 7. 失敗時のフォールバック

| 失敗パターン | 対応 |
|---|---|
| HTTP接続失敗 / Supabase到達不可 | 晃良に「同期失敗、ネットワーク確認」と返す。手元には items[] のままにしてもらう |
| 一部失敗 | 失敗分だけ raw_md(元の会話のマークダウン全文)を `kind: "note"` で1件としてPOSTを試みる(=情報損失を最小に) |
| すべて失敗 | 同上 + 晃良に「全件失敗。一望のSupabaseに直接ペーストしてください」とエラー本文を返す |

---

## 8. 晃良への完了報告

成功時のフォーマット例:

```
受信箱に N件 投入しました。
- 📋 タスク: 5件(うち期日あり: 3件)
- 🌫 もや: 1件
- 📝 メモ: 2件

一望アプリの「受信箱」タブから振り分けてください。
```

---

## 9. Phase 1 のスコープ・割り切り

- **Cowork経由のみ対応**。通常の claude.ai チャット(Cowork外)からは Supabase 書き込み権限が無いため、その場合は「マークダウンを生成 → 晃良がCoworkにペースト → `/sync-ichibou`」の二段ステップを案内する。
- **一方向のみ**。一望側で振り分けたあと、Cowork側のファイルや会話には何もフィードバックしない。
- **整形は最小実装**。Phase 2 で精緻化(プロジェクトヒント自動推測の精度向上、期日表現の拡張等)。
- **認証は publishable key のまま**。Phase 2 で必要なら edge function + secret token に移行。

---

## 10. テスト用の最小ペイロード(動作確認に)

ターミナルから以下を実行すれば、受信箱に1件届くはず:

```bash
curl -X POST "https://jhsjcepsqftnvvyqftmb.supabase.co/rest/v1/ichibou_inbox" \
  -H "apikey: sb_publishable_t17xdBGDadspxbuo-KP2zA_MGoAQn0A" \
  -H "Authorization: Bearer sb_publishable_t17xdBGDadspxbuo-KP2zA_MGoAQn0A" \
  -H "Content-Type: application/json" \
  -d '{"cw_id":"test0001","kind":"task","title":"動作確認","detail":"受信箱に届いていればOK","due":null,"priority":"normal"}'
```
