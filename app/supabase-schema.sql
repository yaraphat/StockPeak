-- Stock Peak Database Schema
-- Run this in Supabase SQL editor to set up the database

-- Users (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text,
  phone text,
  role text not null default 'free' check (role in ('free', 'pro', 'admin')),
  trial_ends_at timestamptz default (now() + interval '7 days'),
  telegram_chat_id text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Subscriptions
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  plan text not null check (plan in ('free', 'pro', 'annual')),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  payment_provider text,
  payment_id text,
  started_at timestamptz default now(),
  expires_at timestamptz
);

alter table public.subscriptions enable row level security;
create policy "Users can read own subs" on public.subscriptions for select using (auth.uid() = user_id);

-- Stock data (EOD OHLCV)
create table public.stock_data (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  ticker text not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric not null,
  volume bigint,
  change_pct numeric,
  unique(date, ticker)
);

create index idx_stock_data_date on public.stock_data(date);
create index idx_stock_data_ticker on public.stock_data(ticker);

-- Daily picks
create table public.picks (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  ticker text not null,
  company_name text not null,
  company_name_bn text not null,
  buy_zone numeric not null,
  target numeric not null,
  stop_loss numeric not null,
  confidence integer not null check (confidence between 1 and 10),
  reasoning_bn text,
  reasoning_en text,
  market_mood text check (market_mood in ('bullish', 'neutral', 'bearish')),
  market_mood_reason text,
  created_at timestamptz default now()
);

create index idx_picks_date on public.picks(date);

-- Pick outcomes (auto-tracked)
create table public.pick_outcomes (
  id uuid default gen_random_uuid() primary key,
  pick_id uuid references public.picks(id) on delete cascade not null unique,
  outcome text not null default 'open' check (outcome in ('open', 'target_hit', 'stop_hit', 'expired')),
  exit_price numeric,
  exit_date date,
  gain_pct numeric,
  updated_at timestamptz default now()
);

create index idx_pick_outcomes_outcome on public.pick_outcomes(outcome);

-- Alerts sent (dedup tracking)
create table public.alerts_sent (
  id uuid default gen_random_uuid() primary key,
  pick_id uuid references public.picks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email', 'telegram')),
  alert_type text not null check (alert_type in ('daily', 'exit', 'weekly')),
  sent_at timestamptz default now(),
  unique(pick_id, user_id, alert_type)
);

-- RLS: picks and outcomes are readable by all authenticated users
alter table public.picks enable row level security;
create policy "Picks readable by authenticated" on public.picks for select using (auth.role() = 'authenticated');

alter table public.pick_outcomes enable row level security;
create policy "Outcomes readable by authenticated" on public.pick_outcomes for select using (auth.role() = 'authenticated');

-- Public scorecard view (no auth required)
create or replace view public.scorecard_view as
select
  count(*) as total_picks,
  count(*) filter (where po.outcome = 'target_hit') as target_hits,
  count(*) filter (where po.outcome = 'stop_hit') as stop_hits,
  count(*) filter (where po.outcome = 'open') as open_picks,
  case
    when count(*) filter (where po.outcome != 'open') > 0
    then round(count(*) filter (where po.outcome = 'target_hit')::numeric / count(*) filter (where po.outcome != 'open') * 100, 1)
    else 0
  end as hit_rate,
  coalesce(round(avg(po.gain_pct) filter (where po.outcome = 'target_hit'), 1), 0) as avg_gain,
  coalesce(round(avg(po.gain_pct) filter (where po.outcome = 'stop_hit'), 1), 0) as avg_loss
from public.picks p
left join public.pick_outcomes po on p.id = po.pick_id;
