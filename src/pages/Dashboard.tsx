import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, CalendarClock, DollarSign, ChefHat, CheckCircle2, XCircle } from "lucide-react";
import { differenceInDays, addDays, format as dateFnsFormat } from "date-fns";
import { formatDate } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";

interface Product {
  product_id: string;
  name: string;
  quantity: number;
  stock_threshold: number;
  expiry_date: string | null;
  category_id: string | null;
}

interface CategoryMap {
  [id: string]: string;
}

interface RecentSale {
  purchase_id: string;
  purchase_date: string;
  total_amount: number;
  customer_name: string;
}

interface SuggestedRecipe {
  recipe_id: string;
  recipe_name: string;
  instructions: string | null;
  ingredients: Product[];
  nearExpiryCount: number;
  canMake: boolean;
}

const Dashboard = () => {
  const { formatCurrency } = useCurrency();
  const [totalProducts, setTotalProducts] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [nearExpiryCount, setNearExpiryCount] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState<(Product & { category_name: string })[]>([]);
  const [nearExpiryProducts, setNearExpiryProducts] = useState<(Product & { days_remaining: number })[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [suggestedRecipes, setSuggestedRecipes] = useState<SuggestedRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);

    const today = dateFnsFormat(new Date(), "yyyy-MM-dd");

    const [productsRes, categoriesRes, purchasesRes, recentPurchasesRes, recipesRes, ingredientsRes] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("categories").select("*"),
      supabase.from("purchases").select("total_amount").eq("purchase_date", today),
      supabase
        .from("purchases")
        .select("purchase_id, purchase_date, total_amount, customer_id")
        .order("purchase_date", { ascending: false })
        .limit(5),
      supabase.from("recipes").select("*"),
      supabase.from("recipe_ingredients").select("*"),
    ]);

    const products: Product[] = productsRes.data ?? [];
    const categories = categoriesRes.data ?? [];
    const todayPurchases = purchasesRes.data ?? [];
    const recentPurchaseRows = recentPurchasesRes.data ?? [];

    const catMap: CategoryMap = {};
    categories.forEach((c) => {
      catMap[c.category_id] = c.category_name;
    });

    setTotalProducts(products.length);

    const now = new Date();

    const lowStock = products
      .filter((p) => p.quantity < p.stock_threshold)
      .sort((a, b) => a.quantity - b.quantity)
      .map((p) => ({ ...p, category_name: p.category_id ? catMap[p.category_id] || "—" : "—" }));
    setLowStockProducts(lowStock);
    setLowStockCount(lowStock.length);

    const nearExpiry = products
      .filter((p) => {
        if (!p.expiry_date) return false;
        const days = differenceInDays(new Date(p.expiry_date), now);
        return days >= 0 && days <= 7;
      })
      .map((p) => ({ ...p, days_remaining: differenceInDays(new Date(p.expiry_date!), now) }))
      .sort((a, b) => a.days_remaining - b.days_remaining);
    setNearExpiryProducts(nearExpiry);
    setNearExpiryCount(nearExpiry.length);

    const salesTotal = todayPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    setTodaySales(salesTotal);

    if (recentPurchaseRows.length > 0) {
      const customerIds = [...new Set(recentPurchaseRows.map((p) => p.customer_id))];
      const { data: customers } = await supabase
        .from("customers")
        .select("customer_id, name")
        .in("customer_id", customerIds);

      const custMap: Record<string, string> = {};
      (customers ?? []).forEach((c) => {
        custMap[c.customer_id] = c.name;
      });

      setRecentSales(
        recentPurchaseRows.map((p) => ({
          purchase_id: p.purchase_id,
          purchase_date: p.purchase_date,
          total_amount: p.total_amount,
          customer_name: custMap[p.customer_id] || "Unknown",
        }))
      );
    }

    const allRecipes = recipesRes.data ?? [];
    const allIngredients = ingredientsRes.data ?? [];
    const prodMap = new Map(products.map((p) => [p.product_id, p]));

    const enrichedRecipes: SuggestedRecipe[] = allRecipes.map((r) => {
      const ingIds = allIngredients.filter((ri) => ri.recipe_id === r.recipe_id).map((ri) => ri.product_id);
      const ings = ingIds.map((id) => prodMap.get(id)).filter(Boolean) as Product[];
      const inStock = ings.filter((p) => p.quantity > 0);
      const nearExpiryIng = ings.filter((p) => {
        if (!p.expiry_date) return false;
        const d = differenceInDays(new Date(p.expiry_date), now);
        return d >= 0 && d <= 7;
      });
      return { ...r, ingredients: ings, nearExpiryCount: nearExpiryIng.length, canMake: ings.length > 0 && inStock.length === ings.length };
    });

    enrichedRecipes.sort((a, b) => b.nearExpiryCount - a.nearExpiryCount || (b.canMake ? 1 : 0) - (a.canMake ? 1 : 0));
    setSuggestedRecipes(enrichedRecipes.slice(0, 3));

    setLoading(false);
  };

  const getExpiryColor = (days: number) => {
    if (days <= 3) return "text-destructive font-semibold";
    if (days <= 7) return "text-accent-foreground font-semibold";
    return "text-foreground";
  };

  const getExpiryBadge = (days: number) => {
    if (days <= 3) return <Badge variant="destructive">{days}d left</Badge>;
    return <Badge variant="secondary">{days}d left</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground">Below threshold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Near Expiry</CardTitle>
            <CalendarClock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{nearExpiryCount}</div>
            <p className="text-xs text-muted-foreground">Within 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(todaySales)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No low stock items 🎉</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map((p) => (
                    <TableRow key={p.product_id}>
                      <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                      <TableCell className="text-right text-destructive font-semibold">{p.quantity}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{p.stock_threshold}</TableCell>
                      <TableCell className="text-muted-foreground">{p.category_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Near Expiry Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-destructive" />
              Near Expiry Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nearExpiryProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No products near expiry 🎉</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nearExpiryProducts.map((p) => (
                    <TableRow key={p.product_id}>
                      <TableCell className={`font-medium ${getExpiryColor(p.days_remaining)}`}>
                        {p.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(p.expiry_date!)}
                      </TableCell>
                      <TableCell className="text-right">{getExpiryBadge(p.days_remaining)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Recent Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No sales recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSales.map((s) => (
                  <TableRow key={s.purchase_id}>
                    <TableCell className="font-medium text-foreground">{s.customer_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(s.purchase_date)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">
                      {formatCurrency(s.total_amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Suggested Recipes */}
      {suggestedRecipes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-primary" />
              Suggested Recipes
              <span className="text-xs font-normal text-muted-foreground ml-1">— use near-expiry ingredients first</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {suggestedRecipes.map((r) => (
                <div key={r.recipe_id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground">{r.recipe_name}</h4>
                    {r.canMake ? (
                      <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" />Ready</Badge>
                    ) : (
                      <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Missing</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.ingredients.map((ing) => {
                      const isNear = ing.expiry_date && differenceInDays(new Date(ing.expiry_date), new Date()) <= 7 && differenceInDays(new Date(ing.expiry_date), new Date()) >= 0;
                      return (
                        <Badge key={ing.product_id} variant="secondary" className={isNear ? "ring-2 ring-destructive/50" : ""}>
                          {isNear && <CalendarClock className="h-3 w-3 mr-1" />}{ing.name}
                        </Badge>
                      );
                    })}
                  </div>
                  {r.nearExpiryCount > 0 && (
                    <p className="text-xs text-destructive">{r.nearExpiryCount} ingredient{r.nearExpiryCount > 1 ? "s" : ""} expiring soon</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
