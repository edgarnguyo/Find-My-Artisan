-- Find My Artisan — attach bookings to signed-in users.
-- Run after 0001_init.sql.

-- Supabase keeps accounts in auth.users, managed by the Auth service.
-- A booking may belong to an account, or stay null for a guest booking.
alter table bookings
    add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists bookings_user_id_idx on bookings(user_id);

-- Constrain the lifecycle values now that users can see them.
alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check
    check (status in ('pending', 'confirmed', 'completed', 'cancelled'));

-- ------------------------------------------------------------------ policies
-- 0001 allowed anyone to insert and nobody to read. Now that accounts exist,
-- a signed-in user may read back their own bookings — and only their own.

drop policy if exists "anyone can create a booking" on bookings;

-- You may create a booking as a guest (user_id null) or as yourself.
-- You may NOT create one stamped with somebody else's user_id.
create policy "create own or guest booking" on bookings for insert
    with check (user_id is null or auth.uid() = user_id);

-- You may read only the bookings carrying your own user_id.
-- Guest bookings (user_id null) stay unreadable from the browser, because
-- auth.uid() = null is never true.
create policy "read own bookings" on bookings for select
    using (auth.uid() = user_id);

-- You may cancel your own booking, and only into the 'cancelled' state.
create policy "cancel own booking" on bookings for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id and status = 'cancelled');
