-- Carrito guardado en la cuenta (cada usuario ve y cambia sólo el suyo).
create table public.cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  image text,
  qty integer not null default 1 check (qty > 0),
  -- Precio por cadena cuando se agregó: [{store, price}]
  prices jsonb not null default '[]'::jsonb,
  -- Tiendas de PedidosYa donde ya lo agregó.
  added text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.cart_items enable row level security;
create policy "Users can view own cart" on public.cart_items for select using ((select auth.uid()) = user_id);
create policy "Users can add to own cart" on public.cart_items for insert with check ((select auth.uid()) = user_id);
create policy "Users can update own cart" on public.cart_items for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can remove from own cart" on public.cart_items for delete using ((select auth.uid()) = user_id);

-- Historial: un precio por producto, tienda y día. Lo llena un trigger cada vez que se guarda
-- un precio (el scraper borra e inserta), así no hay que tocar los scrapers.
create table public.price_history (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  price numeric(10, 2) not null,
  recorded_on date not null default current_date,
  unique (product_id, store_id, recorded_on)
);
create index price_history_product_idx on public.price_history (product_id, recorded_on);
alter table public.price_history enable row level security;
create policy "Anyone can view price history" on public.price_history for select using (true);

create or replace function public.record_price_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.price_history (product_id, store_id, price, recorded_on)
  values (new.product_id, new.store_id, new.price, current_date)
  on conflict (product_id, store_id, recorded_on) do update set price = excluded.price;
  return new;
end;
$$;

create trigger prices_record_history
after insert or update of price on public.prices
for each row execute function public.record_price_history();

-- Punto de partida: los precios actuales, en el día en que se cargaron.
insert into public.price_history (product_id, store_id, price, recorded_on)
select product_id, store_id, price, last_updated::date from public.prices
on conflict do nothing;

-- Alertas: avisar cuando el mejor precio baje del que había al crearla.
create table public.price_alerts (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  base_price numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.price_alerts enable row level security;
create policy "Users can view own alerts" on public.price_alerts for select using ((select auth.uid()) = user_id);
create policy "Users can add own alerts" on public.price_alerts for insert with check ((select auth.uid()) = user_id);
create policy "Users can update own alerts" on public.price_alerts for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can remove own alerts" on public.price_alerts for delete using ((select auth.uid()) = user_id);
