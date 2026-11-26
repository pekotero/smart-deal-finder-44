-- Promos por cantidad de SEPA ("2° al 70%", "3x2") y fecha argentina en el historial.

-- Promo por cantidad: precio por unidad llevando promo_min_qty o más. Las rebajas directas ya van
-- en price (con el precio de lista en original_price).
alter table public.prices add column if not exists promo_text text;
alter table public.prices add column if not exists promo_price numeric(10, 2) check (promo_price > 0);
alter table public.prices add column if not exists promo_min_qty integer check (promo_min_qty >= 2);

-- El historial guardaba el día en UTC: lo cargado después de las 21 quedaba en el día siguiente.
alter table public.price_history alter column recorded_on set default (now() at time zone 'America/Argentina/Buenos_Aires')::date;

create or replace function public.record_price_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.price_history (product_id, store_id, price, recorded_on)
  values (new.product_id, new.store_id, new.price, (now() at time zone 'America/Argentina/Buenos_Aires')::date)
  on conflict (product_id, store_id, recorded_on) do update set price = excluded.price;
  return new;
end;
$$;

-- Búsqueda: igual que antes, con las promos en cada precio.
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
        'original_price', pr.original_price, 'last_updated', pr.last_updated,
        'promo_text', pr.promo_text, 'promo_price', pr.promo_price, 'promo_min_qty', pr.promo_min_qty))
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
