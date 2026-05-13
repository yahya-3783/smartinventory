
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
ON public.app_settings FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage settings"
ON public.app_settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.app_settings (key, value) VALUES
  ('default_stock_threshold', '10'),
  ('app_name', 'Smart Inventory and Customer Insight System'),
  ('currency_symbol', 'ETB');
