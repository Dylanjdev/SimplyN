create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Neighbor',
  bio text not null default '',
  profile_photo_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  owner_name text not null default 'Neighbor',
  offer_type text not null check (offer_type in ('Rental', 'Small Job')),
  title text not null,
  description text not null,
  category text not null,
  price_amount numeric(10,2) not null,
  price_unit text not null default 'day',
  distance_text text not null default 'Local area',
  location_lat double precision,
  location_lng double precision,
  image_url text not null default '',
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.offers add column if not exists location_lat double precision;
alter table public.offers add column if not exists location_lng double precision;

update public.offers
set distance_text = 'Distance unavailable'
where distance_text = 'Distance unavailable (run latest schema.sql to enable location sorting)';

create index if not exists offers_owner_idx on public.offers (owner_user_id);
create index if not exists offers_type_idx on public.offers (offer_type);
create index if not exists offers_category_idx on public.offers (category);
create index if not exists offers_status_idx on public.offers (status);
create index if not exists offers_created_idx on public.offers (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists offers_set_updated_at on public.offers;
create trigger offers_set_updated_at
before update on public.offers
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.offers enable row level security;

drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all
on public.profiles
for select
to authenticated
using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists offers_select_active_or_own on public.offers;
create policy offers_select_active_or_own
on public.offers
for select
to public
using (status = 'ACTIVE' or owner_user_id = auth.uid());

drop policy if exists offers_insert_own on public.offers;
create policy offers_insert_own
on public.offers
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists offers_update_own on public.offers;
create policy offers_update_own
on public.offers
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists offers_delete_own on public.offers;
create policy offers_delete_own
on public.offers
for delete
to authenticated
using (owner_user_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

drop policy if exists listing_images_public_read on storage.objects;
create policy listing_images_public_read
on storage.objects
for select
to public
using (bucket_id = 'listing-images');

drop policy if exists listing_images_owner_insert on storage.objects;
create policy listing_images_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists listing_images_owner_update on storage.objects;
create policy listing_images_owner_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'listing-images'
  and owner = auth.uid()
)
with check (
  bucket_id = 'listing-images'
  and owner = auth.uid()
);

drop policy if exists listing_images_owner_delete on storage.objects;
create policy listing_images_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'listing-images'
  and owner = auth.uid()
);
