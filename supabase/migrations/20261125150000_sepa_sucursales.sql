-- Precios por sucursal de los datos abiertos SEPA (Precios Claros).

-- De dónde salen los precios de una tienda: 'online' (los scrapers, un precio por cadena) o
-- 'sepa' (los de esa sucursal). sepa_id es comercio-bandera-sucursal.
alter table public.stores add column if not exists price_source text check (price_source in ('online', 'sepa'));
alter table public.stores add column if not exists sepa_id text;
create unique index if not exists stores_sepa_id_key on public.stores (sepa_id);

update public.stores set price_source = 'online'
where price_source is null and id in (select distinct store_id from public.prices);

create index if not exists prices_store_id_idx on public.prices (store_id);
create index if not exists prices_product_id_idx on public.prices (product_id);
create index if not exists products_ean_idx on public.products (ean);

-- Búsqueda de productos con precio en ciertas tiendas, paginada en la base (con SEPA son decenas
-- de miles de productos y ya no se pueden bajar todos). Cada palabra de q tiene que estar en el
-- nombre, sin importar tildes. Primero los productos con precio en más tiendas.
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
        where lower(translate(p.name, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUaeiouu')) not like '%' || words.w || '%'
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
