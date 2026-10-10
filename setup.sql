-- Bicutan Bible Church · Word Chain Reaction — database setup
-- Run ONCE in Supabase: SQL Editor → New query → paste all → Run.
-- Safe to re-run (it will not overwrite existing users or games).

create extension if not exists pgcrypto with schema extensions;

-- ---------- tables ----------
create table if not exists public.app_secrets (key text primary key, value text not null);
insert into public.app_secrets(key, value)
  values ('pw_key', encode(extensions.gen_random_bytes(24), 'hex')) on conflict (key) do nothing;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  name text not null,
  role text not null default 'Registered' check (role in ('Admin','Registered')),
  active boolean not null default true,
  pending boolean not null default false,
  pw_hash text not null,      -- bcrypt hash used for login
  pw_enc bytea not null,      -- encrypted copy so the Admin can view it
  created_at timestamptz not null default now()
);
create table if not exists public.app_sessions (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.app_games (
  id text primary key,
  owner uuid,
  by_name text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.app_settings (key text primary key, value jsonb not null);

-- ---------- row level security ----------
alter table public.app_secrets  enable row level security;
alter table public.app_users    enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_games    enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "public read games" on public.app_games;
create policy "public read games" on public.app_games for select using (true);
drop policy if exists "public read settings" on public.app_settings;
create policy "public read settings" on public.app_settings for select using (true);

revoke all on public.app_secrets, public.app_users, public.app_sessions from anon, authenticated;
revoke insert, update, delete on public.app_games, public.app_settings from anon, authenticated;

-- ---------- internal helpers (not callable from the website) ----------
create or replace function public.app_secret() returns text
language sql security definer set search_path = public, extensions stable as
$$ select value from public.app_secrets where key = 'pw_key' $$;

create or replace function public.app_user_from_token(p_token uuid) returns public.app_users
language sql security definer set search_path = public, extensions stable as
$$ select u.* from public.app_sessions s join public.app_users u on u.id = s.user_id
   where s.token = p_token and s.created_at > now() - interval '30 days' and u.active and not u.pending limit 1 $$;

create or replace function public.app_require_admin(p_token uuid) returns public.app_users
language plpgsql security definer set search_path = public, extensions as
$$ declare v public.app_users;
begin
  v := public.app_user_from_token(p_token);
  if v.id is null then raise exception 'not_authenticated'; end if;
  if v.role <> 'Admin' then raise exception 'forbidden'; end if;
  return v;
end $$;

revoke all on function public.app_secret() from public, anon, authenticated;
revoke all on function public.app_user_from_token(uuid) from public, anon, authenticated;
revoke all on function public.app_require_admin(uuid) from public, anon, authenticated;

-- ---------- accounts ----------
create or replace function public.app_register(p_username text, p_name text, p_password text) returns json
language plpgsql security definer set search_path = public, extensions as
$$ declare u text := lower(trim(coalesce(p_username,'')));
begin
  if length(u) < 2 or length(u) > 40 or length(coalesce(p_password,'')) < 4 then raise exception 'invalid_input'; end if;
  if exists (select 1 from public.app_users where username = u) then raise exception 'username_taken'; end if;
  insert into public.app_users(username, name, role, pending, pw_hash, pw_enc)
  values (u, coalesce(nullif(trim(p_name),''), u), 'Registered', true,
          crypt(p_password, gen_salt('bf')), pgp_sym_encrypt(p_password, public.app_secret())::bytea);
  return json_build_object('ok', true);
end $$;

create or replace function public.app_login(p_username text, p_password text) returns json
language plpgsql security definer set search_path = public, extensions as
$$ declare v public.app_users; t uuid;
begin
  select * into v from public.app_users where username = lower(trim(coalesce(p_username,'')));
  if v.id is null or v.pw_hash <> crypt(coalesce(p_password,''), v.pw_hash) then raise exception 'bad_credentials'; end if;
  if v.pending then raise exception 'pending'; end if;
  if not v.active then raise exception 'disabled'; end if;
  delete from public.app_sessions where created_at < now() - interval '30 days';
  insert into public.app_sessions(user_id) values (v.id) returning token into t;
  return json_build_object('token', t, 'user', json_build_object('id', v.id, 'name', v.name, 'username', v.username, 'role', v.role));
end $$;

create or replace function public.app_me(p_token uuid) returns json
language plpgsql security definer set search_path = public, extensions as
$$ declare v public.app_users;
begin
  v := public.app_user_from_token(p_token);
  if v.id is null then return null; end if;
  return json_build_object('id', v.id, 'name', v.name, 'username', v.username, 'role', v.role);
end $$;

create or replace function public.app_logout(p_token uuid) returns json
language plpgsql security definer set search_path = public, extensions as
$$ begin delete from public.app_sessions where token = p_token; return json_build_object('ok', true); end $$;

-- ---------- admin: account management ----------
create or replace function public.app_admin_users(p_token uuid) returns json
language plpgsql security definer set search_path = public, extensions as
$$ begin
  perform public.app_require_admin(p_token);
  return coalesce((select json_agg(json_build_object('id', id, 'name', name, 'username', username, 'role', role,
           'active', active, 'pending', pending, 'created_at', created_at) order by created_at) from public.app_users), '[]'::json);
end $$;

create or replace function public.app_admin_user_action(p_token uuid, p_user uuid, p_action text, p_value text default null) returns json
language plpgsql security definer set search_path = public, extensions as
$$ declare a public.app_users; t public.app_users;
begin
  a := public.app_require_admin(p_token);
  select * into t from public.app_users where id = p_user;
  if t.id is null then raise exception 'not_found'; end if;
  if p_action = 'approve' then
    update public.app_users set pending = false, active = true where id = t.id;
  elsif p_action = 'toggle' then
    if t.role = 'Admin' then raise exception 'forbidden'; end if;
    update public.app_users set active = not active where id = t.id;
    delete from public.app_sessions where user_id = t.id;
  elsif p_action = 'delete' then
    if t.role = 'Admin' then raise exception 'forbidden'; end if;
    delete from public.app_users where id = t.id;
  elsif p_action = 'set_password' then
    if p_value is null or length(p_value) < 4 then raise exception 'invalid_input'; end if;
    update public.app_users set pw_hash = crypt(p_value, gen_salt('bf')), pw_enc = pgp_sym_encrypt(p_value, public.app_secret())::bytea where id = t.id;
    if t.id <> a.id then delete from public.app_sessions where user_id = t.id; end if;
  else
    raise exception 'invalid_input';
  end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.app_admin_view_password(p_token uuid, p_user uuid) returns json
language plpgsql security definer set search_path = public, extensions as
$$ declare t public.app_users;
begin
  perform public.app_require_admin(p_token);
  select * into t from public.app_users where id = p_user;
  if t.id is null then raise exception 'not_found'; end if;
  if t.role = 'Admin' then raise exception 'forbidden'; end if;
  return json_build_object('password', pgp_sym_decrypt(t.pw_enc, public.app_secret()));
end $$;

-- ---------- branding ----------
create or replace function public.app_save_brand(p_token uuid, p_brand jsonb) returns json
language plpgsql security definer set search_path = public, extensions as
$$ begin
  perform public.app_require_admin(p_token);
  if p_brand is null or jsonb_typeof(p_brand) <> 'object' or length(p_brand::text) > 20000 then raise exception 'invalid_input'; end if;
  insert into public.app_settings(key, value) values ('brand', p_brand)
  on conflict (key) do update set value = excluded.value;
  return json_build_object('ok', true);
end $$;

-- ---------- game files ----------
create or replace function public.app_save_game(p_token uuid, p_game jsonb) returns json
language plpgsql security definer set search_path = public, extensions as
$$ declare u public.app_users; g public.app_games; gid text := p_game->>'id';
begin
  u := public.app_user_from_token(p_token);
  if u.id is null then raise exception 'not_authenticated'; end if;
  if gid is null or length(gid) > 64 or coalesce(p_game->>'title','') = '' or length(p_game::text) > 200000 then raise exception 'invalid_input'; end if;
  select * into g from public.app_games where id = gid;
  if g.id is null then
    insert into public.app_games(id, owner, by_name, data)
    values (gid, u.id, u.name, (p_game - 'results' - 'by' - 'owner') || jsonb_build_object('by', u.name, 'owner', u.id, 'results', '[]'::jsonb));
  else
    if g.owner is distinct from u.id and u.role <> 'Admin' then raise exception 'forbidden'; end if;
    update public.app_games
       set data = (p_game - 'results' - 'by' - 'owner') || jsonb_build_object('by', g.by_name, 'owner', g.owner, 'results', coalesce(g.data->'results', '[]'::jsonb)),
           updated_at = now()
     where id = gid;
  end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.app_delete_game(p_token uuid, p_id text) returns json
language plpgsql security definer set search_path = public, extensions as
$$ declare u public.app_users; g public.app_games;
begin
  u := public.app_user_from_token(p_token);
  if u.id is null then raise exception 'not_authenticated'; end if;
  select * into g from public.app_games where id = p_id;
  if g.id is null then raise exception 'not_found'; end if;
  if g.owner is distinct from u.id and u.role <> 'Admin' then raise exception 'forbidden'; end if;
  delete from public.app_games where id = p_id;
  return json_build_object('ok', true);
end $$;

-- winners history (anyone who plays, including guests, can record a result)
create or replace function public.app_save_result(p_game_id text, p_result jsonb) returns json
language plpgsql security definer set search_path = public, extensions as
$$ declare arr jsonb;
begin
  if p_result is null or jsonb_typeof(p_result) <> 'object' or length(p_result::text) > 4000 then raise exception 'invalid_input'; end if;
  select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into arr
    from public.app_games g, jsonb_array_elements(coalesce(g.data->'results', '[]'::jsonb)) with ordinality as t(e, o)
   where g.id = p_game_id and (e->>'id') is distinct from (p_result->>'id');
  arr := arr || jsonb_build_array(p_result);
  while jsonb_array_length(arr) > 50 loop arr := arr - 0; end loop;
  update public.app_games set data = jsonb_set(data, '{results}', arr), updated_at = now() where id = p_game_id;
  return json_build_object('ok', true);
end $$;

create or replace function public.app_remove_result(p_game_id text, p_result_id text) returns json
language plpgsql security definer set search_path = public, extensions as
$$ declare arr jsonb;
begin
  select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into arr
    from public.app_games g, jsonb_array_elements(coalesce(g.data->'results', '[]'::jsonb)) with ordinality as t(e, o)
   where g.id = p_game_id and (e->>'id') is distinct from p_result_id;
  update public.app_games set data = jsonb_set(data, '{results}', arr), updated_at = now() where id = p_game_id;
  return json_build_object('ok', true);
end $$;

grant execute on function public.app_register(text,text,text), public.app_login(text,text), public.app_me(uuid), public.app_logout(uuid),
  public.app_admin_users(uuid), public.app_admin_user_action(uuid,uuid,text,text), public.app_admin_view_password(uuid,uuid),
  public.app_save_brand(uuid,jsonb), public.app_save_game(uuid,jsonb), public.app_delete_game(uuid,text),
  public.app_save_result(text,jsonb), public.app_remove_result(text,text) to anon, authenticated;

-- ---------- starter data ----------
-- Default Admin account. Username: haidezu  Password: qwerty5575
-- CHANGE THE PASSWORD right after your first login (Admin panel → Change password).
insert into public.app_users(username, name, role, pending, pw_hash, pw_enc)
values ('haidezu', 'haidezu', 'Admin', false,
        crypt('qwerty5575', gen_salt('bf')), pgp_sym_encrypt('qwerty5575', public.app_secret())::bytea)
on conflict (username) do nothing;

insert into public.app_games(id, owner, by_name, data)
values ('default', null, 'Bicutan Bible Church', $game$
{"title":"Grace Chain Reaction","desc":"The Bicutan Bible Church signature icebreaker: compound-word chains with faith-themed hints.","interval":4,"by":"Bicutan Bible Church","instr":"Connect each word to the next to form a chain! Letters reveal every few seconds. The last letter is always hidden as a \"?\" until guessed!","sample":["FAST","FOOD","CHAIN","SAW","BLADE"],"rounds":[{"words":["SMART","WATCH","LIST","REPORT","WRITING"],"hint":"General Warmup"},{"words":["TIME","SHEET","MASK","POLICY","UPDATE"],"hint":"Life & Stewardship"},{"words":["CAREER","PATHWAY","POINT","SYSTEM"],"hint":"Walking the Path"},{"words":["ZOOM","CALL","CENTER","STAGE","NAME"],"hint":"Fellowship Connections"},{"words":["WORKSPACE","BAR","CODE","NUMBER"],"hint":"Order & Structure"},{"words":["CROSS","WALK","THROUGH","FAITH","STEP"],"hint":"\"We walk only by grace through faith.\""},{"words":["BROKEN","HEART","BEAT","DOWN","LOAD"],"hint":"\"Even the broken are carried by grace.\""},{"words":["FREE","FALL","BACK","TRACK","RECORD"],"hint":"\"Grace covers every fall and every failure.\""},{"words":["LIGHT","WEIGHT","LIFT","OFF","BASE"],"hint":"\"Even when we're off base, He lifts us.\""},{"words":["CROSS","OVER","TIME","LINE","BREAK"],"hint":"\"Grace crosses all boundaries of time.\""}],"results":[]}

$game$::jsonb) on conflict (id) do nothing;
