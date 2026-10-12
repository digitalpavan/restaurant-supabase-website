-- Dhanvika: owner login for the admin page (admin.html).
-- Run after schema.sql. Safe to re-run.
--
-- Only users listed in the admins table can change the menu or see bookings.
-- Anyone else who signs in gets no extra access.

-- ---------- 1. Admins ----------
create table if not exists admins (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  email    text
);
alter table admins enable row level security;
-- No policies: the table can't be read or changed through the public API.

-- security definer so policies can check the admins table without exposing it.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ---------- 2. Menu: admins see every dish (including hidden ones) and can edit ----------
drop policy if exists "Admins can read all menu items" on menu_items;
create policy "Admins can read all menu items"
  on menu_items for select to authenticated
  using (is_admin());

drop policy if exists "Admins can add menu items" on menu_items;
create policy "Admins can add menu items"
  on menu_items for insert to authenticated
  with check (is_admin());

drop policy if exists "Admins can edit menu items" on menu_items;
create policy "Admins can edit menu items"
  on menu_items for update to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "Admins can delete menu items" on menu_items;
create policy "Admins can delete menu items"
  on menu_items for delete to authenticated
  using (is_admin());

-- ---------- 3. Reservations: admins can view and delete ----------
drop policy if exists "Admins can read reservations" on reservations;
create policy "Admins can read reservations"
  on reservations for select to authenticated
  using (is_admin());

drop policy if exists "Admins can delete reservations" on reservations;
create policy "Admins can delete reservations"
  on reservations for delete to authenticated
  using (is_admin());

-- ---------- 4. Make the owner an admin ----------
-- First create the user in Supabase → Authentication → Users → Add user,
-- then this line gives that account admin access.
insert into admins (user_id, email)
select id, email from auth.users where email = 'digitalpavan61@gmail.com'
on conflict (user_id) do nothing;
