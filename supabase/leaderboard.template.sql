-- Dedicated private schema. Browsers can call only the three RPC functions below.
begin;
create schema if not exists invitation_private;
revoke all on schema invitation_private from public, anon, authenticated;
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

create table if not exists invitation_private.runs (
  id uuid primary key,
  player uuid not null,
  game text not null check (game in ('taptaptap','flappy','hextris','ohhi')),
  board integer not null check (board in (0,4,6,8,10)),
  started_at timestamptz not null default clock_timestamp(),
  submitted_at timestamptz,
  submitted_name text,
  submitted_score integer
);
create index if not exists invitation_runs_player_time on invitation_private.runs(player, started_at);
create table if not exists invitation_private.scores (
  player uuid not null,
  game text not null,
  board integer not null,
  name text not null,
  score integer not null,
  achieved_at timestamptz not null default clock_timestamp(),
  primary key(player, game, board)
);
create index if not exists invitation_scores_board on invitation_private.scores(game, board, score);
alter table invitation_private.runs enable row level security;
alter table invitation_private.scores enable row level security;
revoke all on all tables in schema invitation_private from public, anon, authenticated;

create or replace function invitation_private.valid_board(g text, b integer)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce((g in ('taptaptap','flappy','hextris') and b = 0) or (g = 'ohhi' and b in (4,6,8,10)), false);
$$;
create or replace function invitation_private.clean_name(input text)
returns text language plpgsql stable set search_path = '' as $$
declare
  display_name text;
  plain text;
  unnumbered text;
  joined text;
  form text;
  compact text;
  token text;
  banned text;
  fragments text[] := __FRAGMENTS__;
  words text[] := __WORDS__;
begin
  if input is null or length(input) > 100 then return null; end if;
  display_name := regexp_replace(btrim(normalize(input, NFKC)), ' +', ' ', 'g');
  if length(display_name) not between 2 and 20 or display_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿŒœ0-9 ''-]+$' then return null; end if;
  plain := lower(extensions.unaccent(display_name));
  if length(regexp_replace(plain, '[^a-z]', '', 'g')) < 2 then return null; end if;
  unnumbered := regexp_replace(plain, '\m[0-9]+|[0-9]+\M', '', 'g');
  joined := regexp_replace(regexp_replace(plain, '[^a-z0-9]', '', 'g'), '^[0-9]+|[0-9]+$', '', 'g');
  foreach form in array array[plain, translate(plain, '01345789', 'oieastbg'), unnumbered, translate(unnumbered, '01345789', 'oieastbg'), joined, translate(joined, '01345789', 'oieastbg')] loop
    compact := regexp_replace(regexp_replace(form, '[^a-z0-9]', '', 'g'), '(.)\1+', '\1', 'g');
    foreach banned in array fragments loop
      if position(banned in compact) > 0 then return null; end if;
    end loop;
    if compact = any(words) then return null; end if;
    foreach token in array regexp_split_to_array(form, '[^a-z0-9]+') loop
      if regexp_replace(token, '(.)\1+', '\1', 'g') = any(words) then return null; end if;
    end loop;
  end loop;
  return display_name;
end;
$$;

create or replace function public.leaderboard_start(p_player uuid, p_run uuid, p_game text, p_board integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing invitation_private.runs;
begin
  if p_player is null or p_run is null or not invitation_private.valid_board(p_game, p_board) then raise exception 'invalid_run'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_player::text, 0));
  select * into existing from invitation_private.runs where id = p_run;
  if found then
    if existing.player <> p_player or existing.game <> p_game or existing.board <> p_board then raise exception 'invalid_run'; end if;
    return existing.id;
  end if;
  if (select count(*) from invitation_private.runs where player = p_player and started_at > clock_timestamp() - interval '1 hour') >= 120 then raise exception 'rate_limit'; end if;
  -- Expired tokens cannot be reused; prune on activity without a cron dependency.
  delete from invitation_private.runs where started_at < clock_timestamp() - interval '1 day';
  insert into invitation_private.runs(id, player, game, board) values(p_run, p_player, p_game, p_board);
  return p_run;
end;
$$;

create or replace function public.leaderboard_list(p_game text, p_board integer)
returns table(rank bigint, name text, score integer)
language sql stable security definer set search_path = '' as $$
  select dense_rank() over (order by case when s.game = 'ohhi' then s.score else -s.score end), s.name, s.score
  from invitation_private.scores s
  where invitation_private.valid_board(p_game, p_board) and s.game = p_game and s.board = p_board
    and invitation_private.clean_name(s.name) is not null
  order by case when s.game = 'ohhi' then s.score else -s.score end, s.achieved_at, s.player
  limit 20;
$$;

create or replace function public.leaderboard_submit(p_player uuid, p_run uuid, p_name text, p_score integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r invitation_private.runs;
  friendly text;
  elapsed_ms numeric;
  prior integer;
  best integer;
  place bigint;
  improved boolean := false;
begin
  friendly := invitation_private.clean_name(p_name);
  if friendly is null then raise exception 'invalid_name'; end if;
  if p_player is null or p_run is null then raise exception 'invalid_run'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_player::text, 0));
  select * into r from invitation_private.runs where id = p_run and player = p_player for update;
  if not found then raise exception 'invalid_run'; end if;
  if r.started_at < clock_timestamp() - interval '2 hours' then raise exception 'expired_run'; end if;
  if p_score is null or p_score < 0 or p_score > (case r.game when 'flappy' then 10000 when 'ohhi' then 7200000 else 10000000 end) then raise exception 'invalid_score'; end if;
  if r.submitted_at is not null then
    -- Retry after a lost response is safe, but the original result cannot be changed.
    if r.submitted_name <> friendly or r.submitted_score <> p_score then raise exception 'invalid_run'; end if;
  else
    elapsed_ms := extract(epoch from (clock_timestamp() - r.started_at)) * 1000;
    if elapsed_ms < 500 then raise exception 'invalid_score'; end if;
    if r.game = 'ohhi' and (p_score < 1000 or p_score > elapsed_ms + 15000) then raise exception 'invalid_score'; end if;
    if r.game = 'flappy' and p_score > elapsed_ms / 500 + 2 then raise exception 'invalid_score'; end if;
    if (select count(*) from invitation_private.runs where player = p_player and submitted_at > clock_timestamp() - interval '1 minute') >= 12 then raise exception 'rate_limit'; end if;
    select s.score into prior from invitation_private.scores s where s.player = p_player and s.game = r.game and s.board = r.board;
    improved := prior is null or (r.game = 'ohhi' and p_score < prior) or (r.game <> 'ohhi' and p_score > prior);
    if improved then
      insert into invitation_private.scores(player, game, board, name, score) values(p_player, r.game, r.board, friendly, p_score)
      on conflict(player, game, board) do update set name = excluded.name, score = excluded.score, achieved_at = clock_timestamp();
    end if;
    update invitation_private.runs set submitted_at = clock_timestamp(), submitted_name = friendly, submitted_score = p_score where id = p_run;
  end if;
  select s.score into best from invitation_private.scores s where s.player = p_player and s.game = r.game and s.board = r.board;
  select count(distinct s.score) + 1 into place from invitation_private.scores s
    where s.game = r.game and s.board = r.board and invitation_private.clean_name(s.name) is not null
      and ((r.game = 'ohhi' and s.score < best) or (r.game <> 'ohhi' and s.score > best));
  return jsonb_build_object('rank', place, 'score', best, 'improved', improved);
end;
$$;

revoke all on all functions in schema invitation_private from public, anon, authenticated;
revoke all on function public.leaderboard_start(uuid,uuid,text,integer) from public, anon, authenticated;
revoke all on function public.leaderboard_list(text,integer) from public, anon, authenticated;
revoke all on function public.leaderboard_submit(uuid,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.leaderboard_start(uuid,uuid,text,integer) to anon;
grant execute on function public.leaderboard_list(text,integer) to anon;
grant execute on function public.leaderboard_submit(uuid,uuid,text,integer) to anon;
commit;
