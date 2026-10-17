
-- Crear enum para roles de usuario
CREATE TYPE public.app_role AS ENUM ('user', 'verified', 'admin');

-- Crear tabla de roles de usuario
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Función para verificar rol (evita recursión RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Función para verificar si usuario está verificado
CREATE OR REPLACE FUNCTION public.is_verified_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('verified', 'admin')
  )
$$;

-- Habilitar RLS en user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Políticas para user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Crear tabla de ciudades
CREATE TABLE public.cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    province TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'Argentina',
    latitude NUMERIC,
    longitude NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insertar ciudades iniciales
INSERT INTO public.cities (name, province, latitude, longitude) VALUES
('Rosario', 'Santa Fe', -32.9442, -60.6505),
('Buenos Aires', 'Buenos Aires', -34.6037, -58.3816),
('Córdoba', 'Córdoba', -31.4201, -64.1888),
('Mendoza', 'Mendoza', -32.8908, -68.8272),
('Santa Fe', 'Santa Fe', -31.6333, -60.7000);

-- RLS para ciudades (público para lectura)
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view cities"
ON public.cities
FOR SELECT
USING (true);

-- Agregar city_id a stores
ALTER TABLE public.stores ADD COLUMN city_id UUID REFERENCES public.cities(id);

-- Actualizar tiendas existentes a Rosario
UPDATE public.stores 
SET city_id = (SELECT id FROM public.cities WHERE name = 'Rosario')
WHERE city_id IS NULL;

-- Agregar columnas de contribución a prices
ALTER TABLE public.prices 
ADD COLUMN contributed_by UUID REFERENCES auth.users(id),
ADD COLUMN contributor_name TEXT,
ADD COLUMN verified BOOLEAN DEFAULT false;

-- Crear tabla de reportes de precios
CREATE TABLE public.price_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_id UUID REFERENCES public.prices(id) ON DELETE CASCADE NOT NULL,
    reported_by UUID REFERENCES auth.users(id) NOT NULL,
    reason TEXT NOT NULL,
    correct_price NUMERIC,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.price_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can report prices"
ON public.price_reports
FOR INSERT
WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Users can view own reports"
ON public.price_reports
FOR SELECT
USING (auth.uid() = reported_by OR public.has_role(auth.uid(), 'admin'));

-- Función para contar contribuciones de usuario
CREATE OR REPLACE FUNCTION public.get_user_contribution_count(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.prices
  WHERE contributed_by = _user_id
$$;

-- Agregar galería de imágenes a productos
ALTER TABLE public.products 
ADD COLUMN images TEXT[] DEFAULT '{}',
ADD COLUMN brand TEXT;

-- Trigger para verificar usuario automáticamente cuando confirma email
CREATE OR REPLACE FUNCTION public.auto_verify_user_on_email_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si el email fue confirmado, crear/actualizar rol a verified
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'verified')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger en auth.users para auto-verificación
CREATE TRIGGER on_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_verify_user_on_email_confirm();

-- Actualizar políticas de prices para permitir insert por verificados
CREATE POLICY "Verified users can add prices"
ON public.prices
FOR INSERT
WITH CHECK (public.is_verified_user(auth.uid()));

-- Actualizar políticas de stores para permitir insert por verificados
CREATE POLICY "Verified users can add stores"
ON public.stores
FOR INSERT
WITH CHECK (public.is_verified_user(auth.uid()));
