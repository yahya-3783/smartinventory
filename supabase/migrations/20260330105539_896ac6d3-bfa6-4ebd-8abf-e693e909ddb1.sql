
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- 1. categories
CREATE TABLE public.categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name TEXT NOT NULL
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 2. products
CREATE TABLE public.products (
  product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(category_id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  expiry_date DATE,
  price REAL NOT NULL DEFAULT 0,
  stock_threshold INTEGER NOT NULL DEFAULT 10
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 3. customers
CREATE TABLE public.customers (
  customer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone_number TEXT,
  email TEXT
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 4. purchases
CREATE TABLE public.purchases (
  purchase_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(customer_id) ON DELETE CASCADE NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount REAL NOT NULL DEFAULT 0
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- 5. purchase_details
CREATE TABLE public.purchase_details (
  purchase_detail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID REFERENCES public.purchases(purchase_id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(product_id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE public.purchase_details ENABLE ROW LEVEL SECURITY;

-- 6. feedback
CREATE TABLE public.feedback (
  feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(customer_id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE
);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- 7. recipes
CREATE TABLE public.recipes (
  recipe_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_name TEXT NOT NULL,
  instructions TEXT
);
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- 8. recipe_ingredients
CREATE TABLE public.recipe_ingredients (
  recipe_id UUID REFERENCES public.recipes(recipe_id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(product_id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (recipe_id, product_id)
);
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- 9. user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies: authenticated users with admin or staff role can read/write all tables

-- categories
CREATE POLICY "Staff and admins can read categories" ON public.categories FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can update categories" ON public.categories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can delete categories" ON public.categories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- products
CREATE POLICY "Staff and admins can read products" ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- customers
CREATE POLICY "Staff and admins can read customers" ON public.customers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can update customers" ON public.customers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can delete customers" ON public.customers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- purchases
CREATE POLICY "Staff and admins can read purchases" ON public.purchases FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can insert purchases" ON public.purchases FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can update purchases" ON public.purchases FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can delete purchases" ON public.purchases FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- purchase_details
CREATE POLICY "Staff and admins can read purchase_details" ON public.purchase_details FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can insert purchase_details" ON public.purchase_details FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can update purchase_details" ON public.purchase_details FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can delete purchase_details" ON public.purchase_details FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- feedback
CREATE POLICY "Staff and admins can read feedback" ON public.feedback FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can insert feedback" ON public.feedback FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can update feedback" ON public.feedback FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can delete feedback" ON public.feedback FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- recipes
CREATE POLICY "Staff and admins can read recipes" ON public.recipes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can insert recipes" ON public.recipes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can update recipes" ON public.recipes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can delete recipes" ON public.recipes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- recipe_ingredients
CREATE POLICY "Staff and admins can read recipe_ingredients" ON public.recipe_ingredients FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can insert recipe_ingredients" ON public.recipe_ingredients FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can update recipe_ingredients" ON public.recipe_ingredients FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff and admins can delete recipe_ingredients" ON public.recipe_ingredients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- user_roles: users can read their own roles, admins can manage all
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
