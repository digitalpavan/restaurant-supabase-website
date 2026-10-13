-- Dhanvika: customer list for the admin page (Customers tab).
-- Run after admin.sql. Safe to re-run.
--
-- Customer accounts live in Supabase Auth (auth.users), which the public API
-- can't read. This function returns them to admins only; anyone else gets nothing.

create or replace function admin_list_customers()
returns table (
  id              uuid,
  email           text,
  full_name       text,
  phone           text,
  provider        text,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  confirmed       boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.email::text,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
    u.raw_user_meta_data ->> 'phone',
    coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at is not null
  from auth.users u
  where is_admin()
    and not exists (select 1 from admins a where a.user_id = u.id)
  order by u.created_at desc;
$$;

revoke all on function admin_list_customers() from public, anon;
grant execute on function admin_list_customers() to authenticated;
