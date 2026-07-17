-- Freedom Outsourcing Intern HRIS — Supabase setup
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run

create table users (
  id text primary key,
  role text not null,
  name text not null,
  email text unique not null,
  "pwHash" text,
  "pwSalt" text,
  school text,
  dept text,
  active boolean default true,
  "mustChangePw" boolean default false,
  "addedAt" timestamptz default now()
);

create table attendance (
  id text primary key,
  "userId" text references users(id),
  date text not null,
  "timeIn" text,
  "timeOut" text,
  manual boolean default false,
  remark text,
  unique ("userId", date)
);

create table leaves (
  id text primary key,
  "userId" text references users(id),
  type text,
  "fromDate" text,
  "toDate" text,
  reason text,
  status text default 'Pending',
  "filedAt" text,
  note text
);

create table coas (
  id text primary key,
  "userId" text references users(id),
  date text,
  "timeIn" text,
  "timeOut" text,
  reason text,
  status text default 'Pending',
  "filedAt" text,
  "decidedAt" text
);

create table concerns (
  id text primary key,
  "userId" text references users(id),
  category text,
  subject text,
  details text,
  status text default 'Open',
  "filedAt" text,
  resolution text
);

-- Enable row level security with an open policy for the anon key.
-- NOTE: this means anyone holding the anon key can read/write these tables.
-- Fine for a small internal pilot; move to Supabase Auth for real hardening.
alter table users enable row level security;
alter table attendance enable row level security;
alter table leaves enable row level security;
alter table coas enable row level security;
alter table concerns enable row level security;

create policy "anon full access" on users for all to anon using (true) with check (true);
create policy "anon full access" on attendance for all to anon using (true) with check (true);
create policy "anon full access" on leaves for all to anon using (true) with check (true);
create policy "anon full access" on coas for all to anon using (true) with check (true);
create policy "anon full access" on concerns for all to anon using (true) with check (true);

-- Seed HR admin (password: admin123, stored hashed — forced to change on first sign-in)
insert into users (id, role, name, email, "pwHash", "pwSalt", active, "mustChangePw")
values (
  'admin-1', 'admin', 'HR Administrator', 'philhr@new-wave.com.au',
  '4f9bd3e824f7cb3c751fe7d3b64b5f7a5c588d4afdcb2c568df88f5f7992f5ee',
  'fo2026seed', true, true
);
