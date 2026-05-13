import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Trash2, ChevronDown, ChevronRight, CalendarIcon, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { isAfter, isBefore, startOfDay, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;
type Customer = Tables<"customers">;

interface CartItem {
  product: Product;
  quantity: number;
}

interface PurchaseWithDetails {
  purchase_id: string;
  customer_id: string;
  customer_name: string;
  purchase_date: string;
  total_amount: number;
  details: { product_name: string; quantity: number; unit_price: number }[];
}

const Sales = () => {
  const { formatCurrency } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newCustOpen, setNewCustOpen] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [purchases, setPurchases] = useState<PurchaseWithDetails[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: prods }, { data: custs }, { data: purchaseRows }, { data: detailRows }] =
      await Promise.all([
        supabase.from("products").select("*").order("name"),
        supabase.from("customers").select("*").order("name"),
        supabase.from("purchases").select("*").order("purchase_date", { ascending: false }),
        supabase.from("purchase_details").select("*"),
      ]);

    setProducts(prods || []);
    setCustomers(custs || []);

    const prodMap: Record<string, Product> = {};
    (prods || []).forEach((p) => (prodMap[p.product_id] = p));
    const custMap: Record<string, string> = {};
    (custs || []).forEach((c) => (custMap[c.customer_id] = c.name));

    const detailsByPurchase: Record<string, PurchaseWithDetails["details"]> = {};
    (detailRows || []).forEach((d) => {
      if (!detailsByPurchase[d.purchase_id]) detailsByPurchase[d.purchase_id] = [];
      const prod = prodMap[d.product_id];
      detailsByPurchase[d.purchase_id].push({
        product_name: prod?.name || "Unknown",
        quantity: d.quantity,
        unit_price: prod?.price || 0,
      });
    });

    setPurchases(
      (purchaseRows || []).map((p) => ({
        ...p,
        customer_name: custMap[p.customer_id] || "Unknown",
        details: detailsByPurchase[p.purchase_id] || [],
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const today = startOfDay(new Date());

  const isExpired = (p: Product) =>
    p.expiry_date ? isBefore(parseISO(p.expiry_date), today) : false;

  const availableProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(productSearch.toLowerCase()) &&
          !cart.some((c) => c.product.product_id === p.product_id)
      ),
    [products, productSearch, cart]
  );

  const addToCart = (product: Product) => {
    if (isExpired(product)) {
      toast.error(`"${product.name}" is expired and cannot be sold.`);
      return;
    }
    if (product.quantity <= 0) {
      toast.error(`"${product.name}" is out of stock.`);
      return;
    }
    setCart((prev) => [...prev, { product, quantity: 1 }]);
    setProductSearch("");
  };

  const updateCartQty = (productId: string, qty: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.product_id !== productId) return item;
        const maxQty = item.product.quantity;
        const clamped = Math.max(1, Math.min(qty, maxQty));
        if (qty > maxQty) toast.error(`Only ${maxQty} in stock for "${item.product.name}".`);
        return { ...item, quantity: clamped };
      })
    );
  };

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((i) => i.product.product_id !== productId));

  const orderTotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  const handleSubmit = async () => {
    if (!selectedCustomerId) { toast.error("Select a customer."); return; }
    if (cart.length === 0) { toast.error("Add at least one product."); return; }

    setSubmitting(true);
    const { data: purchase, error: purchaseErr } = await supabase
      .from("purchases")
      .insert({ customer_id: selectedCustomerId, total_amount: orderTotal })
      .select()
      .single();

    if (purchaseErr || !purchase) {
      toast.error("Failed to create purchase: " + (purchaseErr?.message || "Unknown error"));
      setSubmitting(false);
      return;
    }

    const details = cart.map((i) => ({
      purchase_id: purchase.purchase_id,
      product_id: i.product.product_id,
      quantity: i.quantity,
    }));
    const { error: detailErr } = await supabase.from("purchase_details").insert(details);
    if (detailErr) { toast.error("Failed to save line items: " + detailErr.message); setSubmitting(false); return; }

    for (const item of cart) {
      const newQty = item.product.quantity - item.quantity;
      await supabase
        .from("products")
        .update({ quantity: newQty })
        .eq("product_id", item.product.product_id);
    }

    const custName = customers.find((c) => c.customer_id === selectedCustomerId)?.name;
    toast.success(
      `Sale recorded! ${cart.length} item(s) sold to ${custName} for ${formatCurrency(orderTotal)}.`
    );

    setCart([]);
    setSelectedCustomerId("");
    setSubmitting(false);
    fetchAll();
  };

  const handleAddCustomer = async () => {
    if (!newCustName.trim()) { toast.error("Customer name required."); return; }
    const { data, error } = await supabase
      .from("customers")
      .insert({ name: newCustName.trim(), phone_number: newCustPhone || null, email: newCustEmail || null })
      .select()
      .single();
    if (error || !data) { toast.error("Failed to add customer: " + (error?.message || "Unknown error")); return; }
    toast.success(`Customer "${data.name}" added successfully.`);
    setCustomers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedCustomerId(data.customer_id);
    setNewCustOpen(false);
    setNewCustName("");
    setNewCustPhone("");
    setNewCustEmail("");
  };

  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const d = parseISO(p.purchase_date);
      if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(d, startOfDay(dateTo))) return false;
      return true;
    });
  }, [purchases, dateFrom, dateTo]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Sales</h2>
        <p className="text-muted-foreground">Record transactions and view purchase history.</p>
      </div>

      {/* ===== Section 1: New Sale ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> New Sale
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>Customer</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.customer_id} value={c.customer_id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="icon" onClick={() => setNewCustOpen(true)} title="Add new customer">
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Add Products</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search product..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {productSearch && (
              <div className="border rounded-md max-h-48 overflow-auto">
                {availableProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3">No matching products.</p>
                ) : (
                  availableProducts.slice(0, 8).map((p) => (
                    <button
                      key={p.product_id}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 flex justify-between items-center text-sm"
                      onClick={() => addToCart(p)}
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground flex items-center gap-3">
                        <span>{formatCurrency(p.price)}</span>
                        <span>Stock: {p.quantity}</span>
                        {isExpired(p) && <Badge variant="destructive" className="text-xs">Expired</Badge>}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-28">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((item) => (
                    <TableRow key={item.product.product_id}>
                      <TableCell className="font-medium">{item.product.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          max={item.product.quantity}
                          value={item.quantity}
                          onChange={(e) => updateCartQty(item.product.product_id, parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.product.price)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(item.product.price * item.quantity)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.product.product_id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-bold">
                  Order Total: <span className="text-primary">{formatCurrency(orderTotal)}</span>
                </span>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Processing..." : "Confirm Sale"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===== Section 2: Purchase History ===== */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? formatDate(dateFrom) : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? formatDate(dateTo) : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                Clear
              </Button>
            )}
          </div>

          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : filteredPurchases.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No purchases found for the selected period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Purchase ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.map((p) => (
                  <>
                    <TableRow
                      key={p.purchase_id}
                      className="cursor-pointer"
                      onClick={() => setExpandedId(expandedId === p.purchase_id ? null : p.purchase_id)}
                    >
                      <TableCell>
                        {expandedId === p.purchase_id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.purchase_id.slice(0, 8)}...</TableCell>
                      <TableCell>{p.customer_name}</TableCell>
                      <TableCell>{formatDate(p.purchase_date)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(p.total_amount)}</TableCell>
                    </TableRow>
                    {expandedId === p.purchase_id && (
                      <TableRow key={`${p.purchase_id}-details`}>
                        <TableCell colSpan={5} className="bg-muted/30 p-0">
                          <div className="px-8 py-3">
                            <p className="text-sm font-medium mb-2 text-muted-foreground">Line Items</p>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Product</TableHead>
                                  <TableHead className="text-center">Qty</TableHead>
                                  <TableHead className="text-right">Unit Price</TableHead>
                                  <TableHead className="text-right">Subtotal</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {p.details.map((d, i) => (
                                  <TableRow key={i}>
                                    <TableCell>{d.product_name}</TableCell>
                                    <TableCell className="text-center">{d.quantity}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(d.unit_price)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(d.unit_price * d.quantity)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Inline New Customer Dialog */}
      <Dialog open={newCustOpen} onOpenChange={setNewCustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Customer name" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="Phone number" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} placeholder="Email" type="email" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCustOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCustomer}>Add Customer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sales;
