-- ============================================================================
-- 001_create_ichibou_inbox.sql
-- 一望(Ichibou) Cowork → 一望 同期機能の受信箱テーブル
-- 作成: 2026-04-28
-- 設計根拠: feature_cowork_sync.md §4-2 / §9-1
-- 既存 ichibou_state には触らない(別経路書き込みでの上書き事故を避けるため)
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists ichibou_inbox (
  id            uuid primary key default gen_random_uuid(),
  cw_id         text,                                    -- sha1(title|detail|due) 先頭8文字。重複検出用
  kind          text not null,                           -- task | moya | note
  title         text not null,
  detail        text,
  due           date,                                    -- ISO日付 or null
  priority      text,                                    -- high | normal | low
  project_hint  text,                                    -- 推測されたプロジェクト名
  raw_md        text,                                    -- 元のマークダウン全文(再変換用)
  consumed      boolean not null default false,          -- 一望側が振り分け済かどうか
  consumed_at   timestamptz,                             -- 振り分け時刻
  dest          text,                                    -- NEXT | 雑メモ | もや | 破棄
  created_at    timestamptz not null default now()
);

-- 受信箱表示用: 未振り分けを新着順で取りやすく
create index if not exists idx_ichibou_inbox_consumed
  on ichibou_inbox (consumed, created_at desc);

-- 重複検出用
create index if not exists idx_ichibou_inbox_cw_id
  on ichibou_inbox (cw_id);

-- ============================================================================
-- RLS(個人運用前提:anonに insert/select/update を許可)
-- DECISIONS.md / 晃良判断 #5 = A 露出のまま。Phase 2で edge function 検討。
-- ============================================================================

alter table ichibou_inbox enable row level security;

create policy "anon can insert inbox" on ichibou_inbox
  for insert to anon
  with check (true);

create policy "anon can select inbox" on ichibou_inbox
  for select to anon
  using (true);

create policy "anon can update inbox" on ichibou_inbox
  for update to anon
  using (true)
  with check (true);

-- ============================================================================
-- realtime 購読を有効化(一望側で新着が即UIに反映されるように)
-- ============================================================================

alter publication supabase_realtime add table ichibou_inbox;
