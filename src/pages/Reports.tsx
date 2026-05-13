import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { differenceInDays, subDays } from "date-fns";
import { CalendarIcon, Package, AlertTriangle, TrendingUp, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";

interface Product {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  stock_threshold: number;
  expiry_date: string | null;
  category_id: string | null;
}

interface CategoryMap { [id: string]: string; }

const Reports = () => {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryMap>({});
  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchaseDetails, setPurchaseDetails] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [prodRes, catRes, purRes, pdRes, custRes, fbRes] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("categories").select("*"),
      supabase.from("purchases").select("*"),
      supabase.from("purchase_details").select("*"),
      supabase.from("customers").select("*"),
      supabase.from("feedback").select("*"),
    ]);
    setProducts(prodRes.data || []);
    const catMap: CategoryMap = {};
    (catRes.data || []).forEach((c: any) => { catMap[c.category_id] = c.category_name; });
    setCategories(catMap);
    setPurchases(purRes.data || []);
    setPurchaseDetails(pdRes.data || []);
    setCustomers(custRes.data || []);
    setFeedback(fbRes.data || []);
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  const today = new Date();
  const getStatus = (p: Product) => {
    if (p.quantity === 0) return "Out of Stock";
    if (p.expiry_date && differenceInDays(new Date(p.expiry_date), today) < 0) return "Expired";
    if (p.expiry_date && differenceInDays(new Date(p.expiry_date), today) <= 7) return "Near Expiry";
    if (p.quantity < p.stock_threshold) return "Low Stock";
    return "Healthy";
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "Expired": case "Out of Stock": return "destructive" as const;
      case "Near Expiry": return "secondary" as const;
      case "Low Stock": return "outline" as const;
      default: return "default" as const;
    }
  };

  const inventoryStats = {
    expired: products.filter(p => getStatus(p) === "Expired").length,
    nearExpiry: products.filter(p => getStatus(p) === "Near Expiry").length,
    lowStock: products.filter(p => getStatus(p) === "Low Stock").length,
    outOfStock: products.filter(p => getStatus(p) === "Out of Stock").length,
    healthy: products.filter(p => getStatus(p) === "Healthy").length,
    totalValue: products.reduce((sum, p) => sum + p.quantity * p.price, 0),
  };

  const filteredPurchases = purchases.filter(p => {
    const d = new Date(p.purchase_date);
    return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
  });
  const totalSales = filteredPurchases.reduce((s, p) => s + p.total_amount, 0);

  const productSalesMap: Record<string, number> = {};
  const filteredPurchaseIds = new Set(filteredPurchases.map(p => p.purchase_id));
  purchaseDetails.filter(pd => filteredPurchaseIds.has(pd.purchase_id)).forEach(pd => {
    productSalesMap[pd.product_id] = (productSalesMap[pd.product_id] || 0) + pd.quantity;
  });
  const topProducts = Object.entries(productSalesMap)
    .map(([id, qty]) => ({ name: products.find(p => p.product_id === id)?.name || "Unknown", qty }))
    .sort((a, b) => b.qty - a.qty).slice(0, 5);

  const customerSpendMap: Record<string, number> = {};
  filteredPurchases.forEach(p => {
    customerSpendMap[p.customer_id] = (customerSpendMap[p.customer_id] || 0) + p.total_amount;
  });
  const topCustomers = Object.entries(customerSpendMap)
    .map(([id, total]) => ({ name: customers.find((c: any) => c.customer_id === id)?.name || "Unknown", total }))
    .sort((a, b) => b.total - a.total).slice(0, 5);

  const trendMap: Record<string, number> = {};
  filteredPurchases.forEach(p => {
    trendMap[p.purchase_date] = (trendMap[p.purchase_date] || 0) + p.total_amount;
  });
  const salesTrend = Object.entries(trendMap)
    .map(([date, amount]) => ({ date: formatDate(date), amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const chartConfig = { amount: { label: "Sales (ETB)", color: "hsl(var(--primary))" } };

  const expiringProducts = products
    .filter(p => p.expiry_date && differenceInDays(new Date(p.expiry_date), today) <= 30 && differenceInDays(new Date(p.expiry_date), today) >= -30)
    .map(p => {
      const days = differenceInDays(new Date(p.expiry_date!), today);
      let action = "Remove";
      if (days > 7) action = "Discount";
      else if (days > 0) action = "Use in Recipe";
      return { ...p, daysLeft: days, suggestedAction: action };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const avgRating = feedback.length ? (feedback.reduce((s: number, f: any) => s + f.rating, 0) / feedback.length).toFixed(1) : "N/A";

  const allProductFreq: Record<string, number> = {};
  purchaseDetails.forEach((pd: any) => {
    allProductFreq[pd.product_id] = (allProductFreq[pd.product_id] || 0) + pd.quantity;
  });
  const frequentProducts = Object.entries(allProductFreq)
    .map(([id, qty]) => ({
      name: products.find(p => p.product_id === id)?.name || "Unknown",
      totalQty: qty,
      highDemand: qty >= 5,
    }))
    .sort((a, b) => b.totalQty - a.totalQty);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Reports</h2>
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="expiry">Expiry</TabsTrigger>
          <TabsTrigger value="satisfaction">Satisfaction</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Products", value: products.length, icon: Package },
              { label: "Healthy", value: inventoryStats.healthy, icon: Package },
              { label: "Low Stock", value: inventoryStats.lowStock, icon: AlertTriangle },
              { label: "Near Expiry", value: inventoryStats.nearExpiry, icon: AlertTriangle },
              { label: "Expired", value: inventoryStats.expired, icon: AlertTriangle },
              { label: "Total Value", value: formatCurrency(inventoryStats.totalValue), icon: TrendingUp },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-4 flex flex-col items-center gap-1">
                  <s.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold text-foreground">{s.value}</span>
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No products in inventory.</TableCell></TableRow>
                  ) : products.map(p => {
                    const status = getStatus(p);
                    return (
                      <TableRow key={p.product_id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{categories[p.category_id || ""] || "—"}</TableCell>
                        <TableCell>{p.quantity}</TableCell>
                        <TableCell>{formatCurrency(p.price)}</TableCell>
                        <TableCell>{p.expiry_date ? formatDate(p.expiry_date) : "—"}</TableCell>
                        <TableCell><Badge variant={statusColor(status)}>{status}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? formatDate(dateFrom) : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="pointer-events-auto" /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? formatDate(dateTo) : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="pointer-events-auto" /></PopoverContent>
            </Popover>
            <Card className="ml-auto"><CardContent className="p-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /><span className="font-bold text-foreground">{formatCurrency(totalSales)}</span><span className="text-xs text-muted-foreground">Total Sales</span></CardContent></Card>
          </div>

          {salesTrend.length > 0 ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Sales Trend</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <BarChart data={salesTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No sales data for the selected period.</CardContent></Card>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Top 5 Products (by qty sold)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty Sold</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {topProducts.length ? topProducts.map((p, i) => (
                      <TableRow key={i}><TableCell>{p.name}</TableCell><TableCell className="text-right font-medium">{p.qty}</TableCell></TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">No sales data available.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Top 5 Customers (by spend)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Total Spend</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {topCustomers.length ? topCustomers.map((c, i) => (
                      <TableRow key={i}><TableCell>{c.name}</TableCell><TableCell className="text-right font-medium">{formatCurrency(c.total)}</TableCell></TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">No customer data available.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="expiry" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Products Expiring Within 30 Days</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead>Suggested Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringProducts.length ? expiringProducts.map(p => (
                    <TableRow key={p.product_id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{categories[p.category_id || ""] || "—"}</TableCell>
                      <TableCell>{formatDate(p.expiry_date!)}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "font-bold",
                          p.daysLeft <= 0 ? "text-destructive" : p.daysLeft <= 3 ? "text-destructive" : p.daysLeft <= 7 ? "text-accent-foreground" : "text-foreground"
                        )}>
                          {p.daysLeft <= 0 ? `${Math.abs(p.daysLeft)}d overdue` : `${p.daysLeft}d`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.suggestedAction === "Remove" ? "destructive" : p.suggestedAction === "Use in Recipe" ? "secondary" : "outline"}>
                          {p.suggestedAction}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No products expiring soon 🎉</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="satisfaction" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex flex-col items-center gap-1">
                <Star className="h-6 w-6 text-primary" />
                <span className="text-3xl font-bold text-foreground">{avgRating}</span>
                <span className="text-xs text-muted-foreground">Average Rating</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center gap-1">
                <span className="text-3xl font-bold text-foreground">{feedback.length}</span>
                <span className="text-xs text-muted-foreground">Total Reviews</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center gap-1">
                <span className="text-3xl font-bold text-foreground">{frequentProducts.filter(p => p.highDemand).length}</span>
                <span className="text-xs text-muted-foreground">High Demand Products</span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Product Demand Analysis</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Total Qty Purchased</TableHead>
                    <TableHead>Demand</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {frequentProducts.length ? frequentProducts.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">{p.totalQty}</TableCell>
                      <TableCell>{p.highDemand ? <Badge>High Demand</Badge> : <span className="text-muted-foreground text-sm">Normal</span>}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No purchase data available.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
