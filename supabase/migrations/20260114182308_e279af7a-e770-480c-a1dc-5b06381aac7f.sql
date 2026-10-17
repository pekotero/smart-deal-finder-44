-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create stores table
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  rating DECIMAL(2, 1) DEFAULT 4.0,
  is_open BOOLEAN DEFAULT true,
  products_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on stores (public read)
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view stores" ON public.stores FOR SELECT USING (true);

-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category_id UUID REFERENCES public.categories(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on products (public read)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);

-- Create prices table (product prices at different stores)
CREATE TABLE public.prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, store_id)
);

-- Enable RLS on prices (public read)
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view prices" ON public.prices FOR SELECT USING (true);

-- Create favorites table
CREATE TABLE public.favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Enable RLS on favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own favorites" ON public.favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add favorites" ON public.favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove favorites" ON public.favorites FOR DELETE USING (auth.uid() = user_id);

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert sample categories
INSERT INTO public.categories (name, icon) VALUES
  ('Tecnología', 'smartphone'),
  ('Moda', 'shirt'),
  ('Hogar', 'home'),
  ('Supermercado', 'shopping-cart'),
  ('Salud', 'heart');

-- Insert sample stores
INSERT INTO public.stores (name, logo_url, address, rating, is_open, products_count, latitude, longitude) VALUES
  ('Walmart', 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=100&h=100&fit=crop', 'Av. Insurgentes Sur 3500, Pedregal', 4.5, true, 15420, 19.3035, -99.1910),
  ('Liverpool', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=100&h=100&fit=crop', 'Periférico Sur 4690, Jardines del Pedregal', 4.7, true, 8750, 19.2950, -99.2005),
  ('Costco', 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop', 'Av. División del Norte 3890, Coyoacán', 4.6, false, 4200, 19.3305, -99.1650),
  ('Best Buy', 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=100&h=100&fit=crop', 'Centro Comercial Santa Fe', 4.4, true, 3500, 19.3590, -99.2670),
  ('Amazon', 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=100&h=100&fit=crop', 'Envío a domicilio', 4.8, true, 50000, null, null);

-- Insert sample products
INSERT INTO public.products (name, description, image_url, category_id) VALUES
  ('iPhone 15 Pro Max 256GB - Titanio Natural', 'El iPhone más avanzado con chip A17 Pro', 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400&h=400&fit=crop', (SELECT id FROM public.categories WHERE name = 'Tecnología')),
  ('Samsung Galaxy S24 Ultra 256GB', 'El smartphone Android más potente con S Pen', 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&fit=crop', (SELECT id FROM public.categories WHERE name = 'Tecnología')),
  ('Televisor Samsung 65" 4K Smart TV QLED', 'Pantalla QLED con colores vibrantes', 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&h=400&fit=crop', (SELECT id FROM public.categories WHERE name = 'Tecnología')),
  ('Nike Air Max 90 Essential - Blanco/Negro', 'Zapatillas clásicas con máxima comodidad', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop', (SELECT id FROM public.categories WHERE name = 'Moda')),
  ('Cafetera Nespresso Vertuo Next Premium', 'Café de calidad barista en casa', 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400&h=400&fit=crop', (SELECT id FROM public.categories WHERE name = 'Hogar')),
  ('MacBook Pro 14" M3 Pro', 'La laptop más potente para profesionales', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&fit=crop', (SELECT id FROM public.categories WHERE name = 'Tecnología')),
  ('Audífonos Sony WH-1000XM5', 'Cancelación de ruido líder en la industria', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop', (SELECT id FROM public.categories WHERE name = 'Tecnología')),
  ('Dyson V15 Detect', 'Aspiradora inalámbrica con tecnología láser', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop', (SELECT id FROM public.categories WHERE name = 'Hogar'));

-- Insert sample prices for products
INSERT INTO public.prices (product_id, store_id, price, original_price)
SELECT 
  p.id, 
  s.id,
  CASE 
    WHEN p.name LIKE '%iPhone%' THEN 24999 + (random() * 3000)::int
    WHEN p.name LIKE '%Samsung Galaxy%' THEN 22999 + (random() * 2500)::int
    WHEN p.name LIKE '%Televisor%' THEN 18999 + (random() * 4000)::int
    WHEN p.name LIKE '%Nike%' THEN 2899 + (random() * 500)::int
    WHEN p.name LIKE '%Cafetera%' THEN 3499 + (random() * 800)::int
    WHEN p.name LIKE '%MacBook%' THEN 39999 + (random() * 5000)::int
    WHEN p.name LIKE '%Sony%' THEN 7499 + (random() * 1500)::int
    WHEN p.name LIKE '%Dyson%' THEN 14999 + (random() * 3000)::int
    ELSE 1000 + (random() * 500)::int
  END,
  CASE WHEN random() > 0.5 THEN 
    CASE 
      WHEN p.name LIKE '%iPhone%' THEN 29999
      WHEN p.name LIKE '%Samsung Galaxy%' THEN 27999
      WHEN p.name LIKE '%Televisor%' THEN 24999
      WHEN p.name LIKE '%Nike%' THEN 3499
      WHEN p.name LIKE '%Cafetera%' THEN 4299
      WHEN p.name LIKE '%MacBook%' THEN 47999
      WHEN p.name LIKE '%Sony%' THEN 8999
      WHEN p.name LIKE '%Dyson%' THEN 18999
      ELSE NULL
    END
  ELSE NULL END
FROM public.products p
CROSS JOIN public.stores s
WHERE random() > 0.3;