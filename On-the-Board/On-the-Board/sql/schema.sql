-- ============================================================
-- On the B.O.A.R.D  ·  Supabase 초기 설정 SQL
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run 1회 실행
-- ============================================================

-- 1. 프로필 -------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  grade       int  default 1,
  role        text not null default 'student',   -- student | admin
  created_at  timestamptz default now()
);

-- 2. 다이브 기록 --------------------------------------------
create table if not exists dives (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  dive_date     date not null default current_date,
  context       text not null default 'training', -- training | competition
  comp_name     text,
  apparatus     text,
  dive_no       text,
  dd            numeric(3,1),
  stage         int default 4,                    -- 훈련 1~4단계
  s_takeoff     int, s_flight int, s_entry int,   -- 도약/회전/입수 자기평가
  r_good        text, r_improve text, r_goal text,-- 자기 성찰
  video_path    text,                             -- Storage 경로
  video_url     text,                             -- 외부 링크
  created_at    timestamptz default now()
);
create index if not exists dives_user_idx on dives(user_id);
create index if not exists dives_date_idx on dives(dive_date desc);

-- 3. 피드백 -------------------------------------------------
create table if not exists feedbacks (
  id          bigserial primary key,
  dive_id     bigint not null references dives(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  ts_sec      numeric(6,1),                      -- 영상 타임스탬프(초)
  tag         text,                              -- 도약/회전/입수/신체정렬/심리
  role_label  text default 'self',               -- self | peer | coach | expert
  body        text not null,
  created_at  timestamptz default now()
);
create index if not exists fb_dive_idx on feedbacks(dive_id);

-- 4. 컨디션 체크인 ------------------------------------------
create table if not exists checkins (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  ck_date     date not null default current_date,
  r1 bool default false, r2 bool default false,
  r3 bool default false, r4 bool default false,
  tension     int, confidence int, sleep_h int,
  note        text,
  created_at  timestamptz default now(),
  unique (user_id, ck_date)
);

-- 5. 공지 ---------------------------------------------------
create table if not exists notices (
  id         bigserial primary key,
  title      text not null,
  body       text,
  created_at timestamptz default now()
);

-- 6. 앱 설정(관리자 비밀번호 해시) ---------------------------
create table if not exists app_config (
  id            int primary key default 1,
  admin_pw_hash text not null,
  check (id = 1)
);
-- 초기 비밀번호: board2026!  (반드시 hash.html 로 새로 만들어 교체하세요)
insert into app_config (id, admin_pw_hash)
values (1, 'caded34273e5addbcf2db35631d5f46779ee015077cbe094946b6d8e7af757c5')
on conflict (id) do nothing;

-- 7. 가입 시 프로필 자동 생성 --------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, grade)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', '이름미입력'),
          coalesce((new.raw_user_meta_data->>'grade')::int, 1))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 8. 관리자 판정 함수 ---------------------------------------
create or replace function is_admin()
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- 9. RLS(행 수준 보안) --------------------------------------
alter table profiles   enable row level security;
alter table dives      enable row level security;
alter table feedbacks  enable row level security;
alter table checkins   enable row level security;
alter table notices    enable row level security;
alter table app_config enable row level security;

-- 프로필: 로그인한 팀원은 서로 조회 가능 / 본인 또는 관리자만 수정
drop policy if exists p_sel on profiles;
create policy p_sel on profiles for select to authenticated using (true);
drop policy if exists p_upd on profiles;
create policy p_upd on profiles for update to authenticated
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());
drop policy if exists p_ins on profiles;
create policy p_ins on profiles for insert to authenticated with check (id = auth.uid());

-- 다이브: 팀원 전체 열람(상호 피드백 목적) / 작성자·관리자만 수정·삭제
drop policy if exists d_sel on dives;
create policy d_sel on dives for select to authenticated using (true);
drop policy if exists d_ins on dives;
create policy d_ins on dives for insert to authenticated with check (user_id = auth.uid());
drop policy if exists d_upd on dives;
create policy d_upd on dives for update to authenticated
  using (user_id = auth.uid() or is_admin());
drop policy if exists d_del on dives;
create policy d_del on dives for delete to authenticated
  using (user_id = auth.uid() or is_admin());

-- 피드백: 전체 열람 / 본인 작성 / 본인·관리자 삭제
drop policy if exists f_sel on feedbacks;
create policy f_sel on feedbacks for select to authenticated using (true);
drop policy if exists f_ins on feedbacks;
create policy f_ins on feedbacks for insert to authenticated with check (user_id = auth.uid());
drop policy if exists f_del on feedbacks;
create policy f_del on feedbacks for delete to authenticated
  using (user_id = auth.uid() or is_admin());

-- 컨디션: 본인과 관리자만 열람(심리 데이터 보호)
drop policy if exists c_sel on checkins;
create policy c_sel on checkins for select to authenticated
  using (user_id = auth.uid() or is_admin());
drop policy if exists c_ins on checkins;
create policy c_ins on checkins for insert to authenticated with check (user_id = auth.uid());
drop policy if exists c_upd on checkins;
create policy c_upd on checkins for update to authenticated using (user_id = auth.uid());

-- 공지: 전체 열람 / 관리자만 작성·삭제
drop policy if exists n_sel on notices;
create policy n_sel on notices for select to authenticated using (true);
drop policy if exists n_ins on notices;
create policy n_ins on notices for insert to authenticated with check (is_admin());
drop policy if exists n_del on notices;
create policy n_del on notices for delete to authenticated using (is_admin());

-- 앱 설정: 해시 열람만 허용(수정은 대시보드에서 직접)
drop policy if exists a_sel on app_config;
create policy a_sel on app_config for select to authenticated using (true);

-- 10. Storage 버킷 ------------------------------------------
insert into storage.buckets (id, name, public)
values ('dive-videos', 'dive-videos', false)
on conflict (id) do nothing;

drop policy if exists s_sel on storage.objects;
create policy s_sel on storage.objects for select to authenticated
  using (bucket_id = 'dive-videos');
drop policy if exists s_ins on storage.objects;
create policy s_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'dive-videos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists s_del on storage.objects;
create policy s_del on storage.objects for delete to authenticated
  using (bucket_id = 'dive-videos' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

-- 11. 실시간(Realtime) 활성화 -------------------------------
alter publication supabase_realtime add table dives;
alter publication supabase_realtime add table feedbacks;
alter publication supabase_realtime add table notices;

-- 완료. 마지막으로 본인 계정 가입 후 아래 한 줄을 실행하여 관리자로 지정하세요.
-- update profiles set role = 'admin' where id = (select id from auth.users where email = '본인이메일');
