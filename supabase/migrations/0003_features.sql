-- Find My Artisan — the parts the first two migrations left out.
-- Run after 0002_auth.sql.
--
-- Adds: user profiles with a role, artisan-owned worker rows, real stored
-- availability, a portfolio table, job categories and prices, client reviews
-- tied to a completed booking, and the booking lifecycle transitions that
-- 0002 left unreachable.

-- ================================================================ profiles
-- 0002 only had auth.users (email + password). Everything else about a person
-- lived on whichever booking they happened to fill in. This gives each account
-- one record, and a role that decides which screens they get.

create table if not exists profiles (
    id         uuid primary key references auth.users(id) on delete cascade,
    full_name  text,
    contact    text,
    role       text not null default 'client' check (role in ('client', 'artisan')),
    created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "read own profile"   on profiles;
drop policy if exists "update own profile" on profiles;
drop policy if exists "insert own profile" on profiles;

create policy "read own profile"   on profiles for select using (auth.uid() = id);
create policy "insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "update own profile" on profiles for update
    using (auth.uid() = id) with check (auth.uid() = id);

-- A profile row appears the moment the account is created, so no screen has to
-- cope with a signed-in user that has no profile. The role comes from the
-- metadata the sign-up form sends; anything unexpected falls back to 'client'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name, contact, role)
    values (
        new.id,
        nullif(new.raw_user_meta_data ->> 'full_name', ''),
        nullif(new.raw_user_meta_data ->> 'contact', ''),
        case when new.raw_user_meta_data ->> 'role' = 'artisan' then 'artisan' else 'client' end
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Backfill for accounts that existed before this migration.
insert into profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- Deleting your own account. The client cannot delete from auth.users with the
-- anon key, so it calls this instead. security definer runs it as the owner,
-- and it can only ever delete the caller. Cascades clear profile, worker row,
-- portfolio, availability and bookings.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'not signed in';
    end if;
    delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- ======================================================= artisan ownership
-- A workers row is now something an account owns, not just seed data.

alter table workers
    add column if not exists user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists workers_user_id_key on workers(user_id)
    where user_id is not null;

-- Called from policies on other tables. security definer so that checking
-- "do I own this worker?" does not re-enter the workers policies.
create or replace function public.owns_worker(wid integer)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from workers w
        where w.id = wid and w.user_id = auth.uid()
    );
$$;

grant execute on function public.owns_worker(integer) to anon, authenticated;

drop policy if exists "create own worker" on workers;
drop policy if exists "update own worker" on workers;
drop policy if exists "delete own worker" on workers;

-- Claim a worker row for yourself, and only for yourself.
create policy "create own worker" on workers for insert
    with check (auth.uid() = user_id);

-- Edit your own profile. rating, job_success and jobs_completed are derived
-- columns (see the triggers below) — writing them by hand is pointless because
-- the next review or completed booking overwrites them.
create policy "update own worker" on workers for update
    using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own worker" on workers for delete
    using (auth.uid() = user_id);

-- ------------------------------------------------------------ many skills
-- workers.skill stays as the primary trade (the listings filter and the seed
-- data both depend on it). This table carries the rest.

create table if not exists worker_skills (
    id        serial primary key,
    worker_id integer not null references workers(id) on delete cascade,
    skill     text    not null,
    unique (worker_id, skill)
);

create index if not exists worker_skills_worker_id_idx on worker_skills(worker_id);

alter table worker_skills enable row level security;

drop policy if exists "public read worker_skills" on worker_skills;
drop policy if exists "own worker_skills"         on worker_skills;

create policy "public read worker_skills" on worker_skills for select using (true);
create policy "own worker_skills" on worker_skills for all
    using (public.owns_worker(worker_id))
    with check (public.owns_worker(worker_id));

-- Seed the table from the trade each worker already has, so a profile that has
-- never been edited still lists one skill.
insert into worker_skills (worker_id, skill)
select id, skill from workers
on conflict do nothing;

-- ============================================================ availability
-- Replaces the calendar that AvailabilityCalendar.jsx used to invent from
-- `worker.id % 7`. weekday is 0 = Monday … 6 = Sunday, matching the DAYS array
-- in that component.

create table if not exists worker_availability (
    id         serial primary key,
    worker_id  integer not null references workers(id) on delete cascade,
    weekday    smallint not null check (weekday between 0 and 6),
    start_time time not null,
    end_time   time not null,
    unique (worker_id, weekday),
    check (end_time > start_time)
);

create index if not exists worker_availability_worker_id_idx on worker_availability(worker_id);

alter table worker_availability enable row level security;

drop policy if exists "public read availability" on worker_availability;
drop policy if exists "own availability"         on worker_availability;

create policy "public read availability" on worker_availability for select using (true);
create policy "own availability" on worker_availability for all
    using (public.owns_worker(worker_id))
    with check (public.owns_worker(worker_id));

-- Give the seeded artisans a real schedule that matches the shape the old
-- component faked: full-timers Mon–Fri 08:00–17:00, part-timers three days
-- 09:00–14:00.
insert into worker_availability (worker_id, weekday, start_time, end_time)
select w.id,
       d.weekday,
       case when w.hours_per_week = 'More than 30 hrs/week' then time '08:00' else time '09:00' end,
       case when w.hours_per_week = 'More than 30 hrs/week' then time '17:00' else time '14:00' end
from workers w
cross join generate_series(0, 6) as d(weekday)
where d.weekday < case when w.hours_per_week = 'More than 30 hrs/week' then 5 else 3 end
on conflict (worker_id, weekday) do nothing;

-- ============================================================== portfolio
-- Photos of finished work, owned by the artisan. Images live in the
-- `portfolio` storage bucket; this table holds their public URLs.

create table if not exists portfolio_items (
    id         serial primary key,
    worker_id  integer not null references workers(id) on delete cascade,
    image_url  text not null,
    caption    text,
    created_at timestamptz not null default now()
);

create index if not exists portfolio_items_worker_id_idx on portfolio_items(worker_id);

alter table portfolio_items enable row level security;

drop policy if exists "public read portfolio" on portfolio_items;
drop policy if exists "own portfolio"         on portfolio_items;

create policy "public read portfolio" on portfolio_items for select using (true);
create policy "own portfolio" on portfolio_items for all
    using (public.owns_worker(worker_id))
    with check (public.owns_worker(worker_id));

-- Public bucket: anyone may look at the photos, only signed-in users may write,
-- and each artisan writes inside a folder named after their account id.
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

drop policy if exists "public read portfolio files"   on storage.objects;
drop policy if exists "upload own portfolio files"    on storage.objects;
drop policy if exists "delete own portfolio files"    on storage.objects;

create policy "public read portfolio files" on storage.objects for select
    using (bucket_id = 'portfolio');

create policy "upload own portfolio files" on storage.objects for insert
    with check (
        bucket_id = 'portfolio'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "delete own portfolio files" on storage.objects for delete
    using (
        bucket_id = 'portfolio'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

-- =========================================================== job details
-- A booking is the job record. It gains a real category and real money
-- columns, instead of describing both in free text.

create table if not exists job_categories (
    slug  text primary key,
    label text not null
);

insert into job_categories (slug, label) values
    ('electrical', 'Electrical'),
    ('plumbing',   'Plumbing'),
    ('carpentry',  'Carpentry'),
    ('painting',   'Painting'),
    ('other',      'Other')
on conflict (slug) do nothing;

alter table job_categories enable row level security;
drop policy if exists "public read job_categories" on job_categories;
create policy "public read job_categories" on job_categories for select using (true);

alter table bookings
    add column if not exists category     text references job_categories(slug),
    add column if not exists agreed_price numeric(10, 2) check (agreed_price >= 0),
    add column if not exists final_price  numeric(10, 2) check (final_price  >= 0);

-- Fill the category of existing rows from the artisan's trade.
update bookings b
set category = case w.skill
        when 'Electrician' then 'electrical'
        when 'Plumber'     then 'plumbing'
        when 'Carpenter'   then 'carpentry'
        when 'Painter'     then 'painting'
        else 'other'
    end
from workers w
where w.id = b.worker_id and b.category is null;

-- ====================================================== booking integrity
-- Two things 0001 allowed that it should not have: a booking in the past, and
-- two clients holding the same artisan at the same moment.

create or replace function public.reject_past_booking()
returns trigger
language plpgsql
as $$
begin
    if new.booking_date < current_date then
        raise exception 'booking date is in the past';
    end if;
    return new;
end;
$$;

drop trigger if exists bookings_reject_past on bookings;
create trigger bookings_reject_past
    before insert on bookings
    for each row execute function public.reject_past_booking();

-- A cancelled booking frees the slot again, so it is excluded from the index.
create unique index if not exists bookings_no_double_booking
    on bookings (worker_id, booking_date, booking_time)
    where status <> 'cancelled';

-- ------------------------------------------------- booking policies, redone
-- 0002 let the client cancel and nobody do anything else, which made
-- 'confirmed' and 'completed' unreachable. The artisan now owns those two.

drop policy if exists "read own bookings"      on bookings;
drop policy if exists "cancel own booking"     on bookings;
drop policy if exists "read bookings for me"   on bookings;
drop policy if exists "client updates booking" on bookings;
drop policy if exists "artisan updates booking" on bookings;

-- Your own bookings as a client, plus every booking made against a worker
-- profile you own. Guest bookings become readable by the artisan they were
-- sent to — previously nobody could read them at all.
create policy "read bookings for me" on bookings for select
    using (auth.uid() = user_id or public.owns_worker(worker_id));

-- The client may only ever cancel.
create policy "client updates booking" on bookings for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id and status = 'cancelled');

-- The artisan may confirm, complete, or cancel, and may record the final
-- price on the job. They may not reassign the booking to another worker.
create policy "artisan updates booking" on bookings for update
    using (public.owns_worker(worker_id))
    with check (
        public.owns_worker(worker_id)
        and status in ('pending', 'confirmed', 'completed', 'cancelled')
    );

-- =============================================================== reviews
-- A review is now written by a signed-in client, about one completed booking,
-- once. That is what makes the rating trustworthy enough to sort listings by.

alter table reviews
    add column if not exists user_id    uuid    references auth.users(id) on delete set null,
    add column if not exists booking_id integer references bookings(id)   on delete cascade;

create unique index if not exists reviews_one_per_booking
    on reviews(booking_id) where booking_id is not null;

drop policy if exists "review own completed booking" on reviews;
drop policy if exists "update own review"            on reviews;
drop policy if exists "delete own review"            on reviews;

create policy "review own completed booking" on reviews for insert
    with check (
        auth.uid() = user_id
        and exists (
            select 1 from bookings b
            where b.id = reviews.booking_id
              and b.user_id = auth.uid()
              and b.worker_id = reviews.worker_id
              and b.status = 'completed'
        )
    );

create policy "update own review" on reviews for update
    using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own review" on reviews for delete
    using (auth.uid() = user_id);

-- ====================================================== derived statistics
-- rating, jobs_completed and job_success were static seed numbers. They are
-- now recomputed from the rows that justify them.

create or replace function public.refresh_worker_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    wid integer := coalesce(new.worker_id, old.worker_id);
begin
    update workers w
    set rating = (
        select round(avg(r.rating)::numeric, 1) from reviews r where r.worker_id = wid
    )
    where w.id = wid;
    return null;
end;
$$;

drop trigger if exists reviews_refresh_rating on reviews;
create trigger reviews_refresh_rating
    after insert or update or delete on reviews
    for each row execute function public.refresh_worker_rating();

create or replace function public.refresh_worker_job_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    wid       integer := coalesce(new.worker_id, old.worker_id);
    done      integer;
    finished  integer;
begin
    select count(*) filter (where status = 'completed'),
           count(*) filter (where status in ('completed', 'cancelled'))
      into done, finished
      from bookings where worker_id = wid;

    update workers w
    set jobs_completed = done,
        -- Undefined until at least one job has finished one way or the other;
        -- an artisan with no history should not read as 0% successful.
        job_success = case when finished = 0 then null
                           else round(done * 100.0 / finished) end
    where w.id = wid;
    return null;
end;
$$;

drop trigger if exists bookings_refresh_job_stats on bookings;
create trigger bookings_refresh_job_stats
    after insert or update of status or delete on bookings
    for each row execute function public.refresh_worker_job_stats();
