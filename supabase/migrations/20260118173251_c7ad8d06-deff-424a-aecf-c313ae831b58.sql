-- Crear enum para tipos de suscripción
CREATE TYPE public.subscription_tier AS ENUM ('free', 'emprendedor', 'negocio', 'empresa');

-- Tabla de planes de suscripción
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier subscription_tier NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  max_products INTEGER NOT NULL,
  price_monthly NUMERIC NOT NULL DEFAULT 0,
  featured_visibility BOOLEAN NOT NULL DEFAULT false,
  priority_in_search INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insertar planes
INSERT INTO public.subscription_plans (tier, name, description, max_products, price_monthly, featured_visibility, priority_in_search) VALUES
  ('free', 'Gratuito', 'Publica hasta 5 productos gratis', 5, 0, false, 0),
  ('emprendedor', 'Emprendedor', 'Ideal para pequeños emprendedores', 25, 2999, true, 10),
  ('negocio', 'Negocio', 'Para negocios en crecimiento', 100, 7999, true, 20),
  ('empresa', 'Empresa', 'Para grandes comercios y cadenas', -1, 19999, true, 30);

-- Tabla de suscripciones de usuarios
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas para planes (todos pueden ver)
CREATE POLICY "Anyone can view subscription plans"
  ON public.subscription_plans FOR SELECT
  USING (true);

-- Políticas para suscripciones de usuario
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscription"
  ON public.user_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Agregar columna de contribuidor a productos
ALTER TABLE public.products 
ADD COLUMN contributed_by UUID,
ADD COLUMN is_user_contributed BOOLEAN DEFAULT false,
ADD COLUMN store_id UUID REFERENCES public.stores(id);

-- Función para contar productos del usuario
CREATE OR REPLACE FUNCTION public.get_user_product_count(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.products
  WHERE contributed_by = _user_id
$$;

-- Función para verificar si usuario puede agregar más productos
CREATE OR REPLACE FUNCTION public.can_add_product(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN sp.max_products = -1 THEN true
      WHEN public.get_user_product_count(_user_id) < sp.max_products THEN true
      ELSE false
    END
  FROM public.subscription_plans sp
  LEFT JOIN public.user_subscriptions us ON us.plan_id = sp.id AND us.user_id = _user_id AND us.status = 'active'
  WHERE sp.tier = COALESCE(
    (SELECT tier FROM public.subscription_plans WHERE id = us.plan_id),
    'free'
  )
$$;

-- Función para obtener límite de productos del usuario
CREATE OR REPLACE FUNCTION public.get_user_product_limit(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT sp.max_products 
     FROM public.user_subscriptions us
     JOIN public.subscription_plans sp ON sp.id = us.plan_id
     WHERE us.user_id = _user_id AND us.status = 'active'),
    5
  )
$$;

-- Política para que usuarios autenticados puedan agregar productos
CREATE POLICY "Authenticated users can add products"
  ON public.products FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND contributed_by = auth.uid()
    AND public.can_add_product(auth.uid())
  );

-- Política para que usuarios puedan editar sus propios productos
CREATE POLICY "Users can update own products"
  ON public.products FOR UPDATE
  USING (auth.uid() = contributed_by);

-- Política para que usuarios puedan eliminar sus propios productos
CREATE POLICY "Users can delete own products"
  ON public.products FOR DELETE
  USING (auth.uid() = contributed_by);