-- Find My Artisan — initial schema
-- Run this in the Supabase SQL editor (or `supabase db push`) before seed.sql.

-- ---------------------------------------------------------------- workers
create table if not exists workers (
    id             serial primary key,
    name           text    not null,
    skill          text    not null,
    verified       boolean not null default false,
    price          text,
    photo          text,
    location       text    not null,
    bio            text,
    rating         numeric(2,1),
    job_success    integer,
    hours_per_week text,
    total_earnings text,
    jobs_completed integer default 0,
    hours_worked   integer default 0,
    created_at     timestamptz not null default now()
);

-- ------------------------------------------------------------- languages
create table if not exists languages (
    id        serial primary key,
    worker_id integer not null references workers(id) on delete cascade,
    name      text    not null,
    level     text    not null
);

-- ---------------------------------------------------------- work_history
create table if not exists work_history (
    id         serial primary key,
    worker_id  integer not null references workers(id) on delete cascade,
    title      text    not null,
    rating     integer check (rating between 1 and 5),
    date_range text,
    price      text,
    price_type text
);

-- --------------------------------------------------------------- reviews
create table if not exists reviews (
    id         serial primary key,
    worker_id  integer not null references workers(id) on delete cascade,
    author     text    not null,
    rating     integer not null check (rating between 1 and 5),
    comment    text,
    created_at timestamptz not null default now()
);

-- -------------------------------------------------------------- bookings
create table if not exists bookings (
    id           serial primary key,
    worker_id    integer not null references workers(id) on delete cascade,
    name         text    not null,
    contact      text    not null,
    booking_date date    not null,
    booking_time time    not null,
    budget       text,
    job          text    not null,
    status       text    not null default 'pending',
    created_at   timestamptz not null default now()
);

create index if not exists languages_worker_id_idx    on languages(worker_id);
create index if not exists work_history_worker_id_idx on work_history(worker_id);
create index if not exists reviews_worker_id_idx      on reviews(worker_id);
create index if not exists bookings_worker_id_idx     on bookings(worker_id);
create index if not exists workers_skill_idx          on workers(skill);

-- ------------------------------------------------------ row level security
alter table workers      enable row level security;
alter table languages    enable row level security;
alter table work_history enable row level security;
alter table reviews      enable row level security;
alter table bookings     enable row level security;

-- Public catalogue data: anyone may read, nobody may write from the browser.
create policy "public read workers"      on workers      for select using (true);
create policy "public read languages"    on languages    for select using (true);
create policy "public read work_history" on work_history for select using (true);
create policy "public read reviews"      on reviews      for select using (true);

-- Bookings: anyone may create one, nobody may read them back from the browser.
-- (No select policy = select returns zero rows for anon/authenticated users.
--  Read them in the Supabase dashboard, which bypasses RLS.)
create policy "anyone can create a booking" on bookings for insert with check (true);
