-- Alertas con precio objetivo o porcentaje, avisos en la cuenta y reseñas de tiendas.

-- Alertas: 'any' (cualquier baja del precio de cuando se creó), 'target' (llega a target_price)
-- o 'percent' (baja percent %). notified_price es el precio del último aviso: se vuelve a avisar
-- sólo si baja más.
alter table public.price_alerts add column if not exists kind text not null default 'any'
  check (kind in ('any', 'target', 'percent'));
alter table public.price_alerts add column if not exists target_price numeric(10, 2) check (target_price > 0);
alter table public.price_alerts add column if not exists percent integer check (percent between 1 and 90);
alter table public.price_alerts add column if not exists notified_price numeric(10, 2);
alter table public.price_alerts add column if not exists notified_at timestamptz;
-- Tiendas que se miran: las que el usuario veía al crearla (sucursales cercanas y online de
-- esas cadenas). null = todas.
alter table public.price_alerts add column if not exists store_ids uuid[];

-- Avisos en la cuenta. Los crea el script diario con la service key (no hay policy de insert).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications" on public.notifications for select using ((select auth.uid()) = user_id);
drop policy if exists "Users can mark own notifications" on public.notifications;
create policy "Users can mark own notifications" on public.notifications for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications" on public.notifications for delete using ((select auth.uid()) = user_id);

-- Reseñas de tiendas: una por usuario y tienda, de 1 a 5 estrellas, con comentario opcional.
create table if not exists public.store_reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  author text check (char_length(author) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, user_id)
);
create index if not exists store_reviews_store_idx on public.store_reviews (store_id, created_at desc);
alter table public.store_reviews enable row level security;
drop policy if exists "Anyone can view reviews" on public.store_reviews;
create policy "Anyone can view reviews" on public.store_reviews for select using (true);
drop policy if exists "Users can add own review" on public.store_reviews;
create policy "Users can add own review" on public.store_reviews for insert with check ((select auth.uid()) = user_id);
drop policy if exists "Users can edit own review" on public.store_reviews;
create policy "Users can edit own review" on public.store_reviews for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own review" on public.store_reviews;
create policy "Users can delete own review" on public.store_reviews for delete using ((select auth.uid()) = user_id);

-- Promedio y cantidad por tienda.
create or replace view public.store_review_stats with (security_invoker = true) as
select store_id, round(avg(rating)::numeric, 1) as avg_rating, count(*)::int as reviews
from public.store_reviews
group by store_id;
grant select on public.store_review_stats to anon, authenticated;

-- Búsqueda: ahora también excluye palabras ("leche -dulce"). Misma firma que antes.
-- Búsqueda de productos con precio en ciertas tiendas, paginada en la base (con SEPA son decenas
-- de miles de productos y ya no se pueden bajar todos). Cada palabra de q tiene que estar en el
-- nombre, sin importar tildes, y las que empiezan con "-" no tienen que estar ("leche -dulce").
-- Primero los productos con precio en más tiendas.
create or replace function public.search_products(
  store_ids uuid[],
  q text default null,
  cat uuid default null,
  product_ids uuid[] default null,
  lim int default 60,
  off int default 0
)
returns table (
  id uuid,
  name text,
  image_url text,
  ean text,
  category_name text,
  prices jsonb,
  total bigint
)
language sql
stable
set search_path = ''
as $$
  with words as (
    select w
    from unnest(string_to_array(lower(translate(coalesce(q, ''), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUaeiouu')), ' ')) as w
    where w <> ''
  ),
  matched as (
    select pr.product_id, count(distinct pr.store_id) as n
    from public.prices pr
    join public.products p on p.id = pr.product_id
    where pr.store_id = any (store_ids)
      and (cat is null or p.category_id = cat)
      and (product_ids is null or p.id = any (product_ids))
      and not exists (
        select 1 from words
        where case
          when words.w like '-%' then
            length(words.w) > 1
            and lower(translate(p.name, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUaeiouu')) like '%' || substr(words.w, 2) || '%'
          else lower(translate(p.name, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUaeiouu')) not like '%' || words.w || '%'
        end
      )
    group by pr.product_id
  ),
  page as (
    select m.product_id, m.n, p.name, count(*) over () as total
    from matched m
    join public.products p on p.id = m.product_id
    order by m.n desc, p.name, p.id
    limit greatest(least(lim, 200), 1) offset greatest(off, 0)
  )
  select
    p.id,
    p.name::text,
    p.image_url::text,
    p.ean::text,
    c.name::text,
    (
      select jsonb_agg(jsonb_build_object(
        'id', pr.id, 'store_id', pr.store_id, 'price', pr.price,
        'original_price', pr.original_price, 'last_updated', pr.last_updated))
      from public.prices pr
      where pr.product_id = p.id and pr.store_id = any (store_ids)
    ),
    pg.total
  from page pg
  join public.products p on p.id = pg.product_id
  left join public.categories c on c.id = p.category_id
  order by pg.n desc, pg.name, p.id;
$$;

grant execute on function public.search_products(uuid[], text, uuid, uuid[], int, int) to anon, authenticated;
