import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseISO } from "date-fns";
import { Search, Plus, Pencil, Eye, User, ShoppingCart, MessageSquare, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";

type Customer = {
  customer_id: string;
  name: string;
  phone_number: string | null;
  email: string | null;
};

type Purchase = {
  purchase_id: string;
  purchase_date: string;
  total_amount: number;
  customer_id: string;
};

type PurchaseDetail = {
  purchase_detail_id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
};

type Product = {
  product_id: string;
  name: string;
};

type Feedback = {
  feedback_id: string;
  customer_id: string;
  rating: number;
  comment: string | null;
  date: string;
};

type CustomerSummary = Customer & {
  totalPurchases: number;
  lastPurchaseDate: string | null;
};

const Customers = () => {
  const { formatCurrency } = useCurrency();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetail[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
  const [formData, setFormData] = useState({ name: "", phone_number: "", email: "" });

  const fetchAll = async () => {
    setLoading(true);
    const [cRes, pRes, pdRes, prRes, fRes] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("purchases").select("*"),
      supabase.from("purchase_details").select("*"),
      supabase.from("products").select("product_id, name"),
      supabase.from("feedback").select("*"),
    ]);

    const custs = (cRes.data || []) as Customer[];
    const purch = (pRes.data || []) as Purchase[];
    const pd = (pdRes.data || []) as PurchaseDetail[];
    const prods = (prRes.data || []) as Product[];
    const fb = (fRes.data || []) as Feedback[];

    setPurchases(purch);
    setPurchaseDetails(pd);
    setProducts(prods);
    setFeedbacks(fb);

    const summaries: CustomerSummary[] = custs.map((c) => {
      const custPurchases = purch.filter((p) => p.customer_id === c.customer_id);
      const totalPurchases = custPurchases.length;
      const lastPurchaseDate = custPurchases.length
        ? custPurchases.sort((a, b) => b.purchase_date.localeCompare(a.purchase_date))[0].purchase_date
        : null;
      return { ...c, totalPurchases, lastPurchaseDate };
    });

    setCustomers(summaries);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const openAdd = () => {
    setEditingCustomer(null);
    setFormData({ name: "", phone_number: "", email: "" });
    setFormOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({ name: c.name, phone_number: c.phone_number || "", email: c.email || "" });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error("Name is required"); return; }
    if (editingCustomer) {
      const { error } = await supabase.from("customers").update({
        name: formData.name.trim(),
        phone_number: formData.phone_number.trim() || null,
        email: formData.email.trim() || null,
      }).eq("customer_id", editingCustomer.customer_id);
      if (error) { toast.error("Failed to update customer: " + error.message); return; }
      toast.success("Customer updated successfully");
    } else {
      const { error } = await supabase.from("customers").insert({
        name: formData.name.trim(),
        phone_number: formData.phone_number.trim() || null,
        email: formData.email.trim() || null,
      });
      if (error) { toast.error("Failed to add customer: " + error.message); return; }
      toast.success("Customer added successfully");
    }
    setFormOpen(false);
    fetchAll();
  };

  const openDetail = (c: CustomerSummary) => {
    setSelectedCustomer(c);
    setDetailOpen(true);
  };

  const customerPurchases = useMemo(() => {
    if (!selectedCustomer) return [];
    return purchases
      .filter((p) => p.customer_id === selectedCustomer.customer_id)
      .sort((a, b) => b.purchase_date.localeCompare(a.purchase_date));
  }, [selectedCustomer, purchases]);

  const customerFeedback = useMemo(() => {
    if (!selectedCustomer) return [];
    return feedbacks
      .filter((f) => f.customer_id === selectedCustomer.customer_id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedCustomer, feedbacks]);

  const productMap = useMemo(() => {
    const m: Record<string, string> = {};
    products.forEach((p) => (m[p.product_id] = p.name));
    return m;
  }, [products]);

  const repetitiveProducts = useMemo(() => {
    if (!selectedCustomer) return [];
    const custPurchaseIds = purchases
      .filter((p) => p.customer_id === selectedCustomer.customer_id)
      .map((p) => p.purchase_id);
    const freq: Record<string, number> = {};
    purchaseDetails
      .filter((pd) => custPurchaseIds.includes(pd.purchase_id))
      .forEach((pd) => {
        freq[pd.product_id] = (freq[pd.product_id] || 0) + 1;
      });
    return Object.entries(freq)
      .filter(([, count]) => count > 1)
      .map(([productId, count]) => ({
        productId,
        productName: productMap[productId] || "Unknown",
        frequency: count,
        highFrequency: count >= 3,
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }, [selectedCustomer, purchases, purchaseDetails, productMap]);

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? "text-primary" : "text-muted-foreground/30"}>★</span>
    ));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Customers</h2>
          <p className="text-muted-foreground">Manage customers and view insights.</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Total Purchases</TableHead>
                  <TableHead>Last Purchase</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No customers found. Add your first customer to get started.</TableCell></TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.customer_id} className="cursor-pointer" onClick={() => openDetail(c)}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.phone_number || "—"}</TableCell>
                      <TableCell>{c.email || "—"}</TableCell>
                      <TableCell className="text-center">{c.totalPurchases}</TableCell>
                      <TableCell>{c.lastPurchaseDate ? formatDate(c.lastPurchaseDate) : "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => openDetail(c)}><Eye className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={formData.phone_number} onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingCustomer ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />{selectedCustomer.name}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-4 py-2">
                <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{selectedCustomer.phone_number || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{selectedCustomer.email || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Total Purchases</p><p className="font-medium">{selectedCustomer.totalPurchases}</p></div>
              </div>

              <Separator />

              <Tabs defaultValue="purchases" className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="purchases" className="flex-1"><ShoppingCart className="h-4 w-4 mr-1" />Purchases</TabsTrigger>
                  <TabsTrigger value="feedback" className="flex-1"><MessageSquare className="h-4 w-4 mr-1" />Feedback</TabsTrigger>
                  <TabsTrigger value="analysis" className="flex-1"><TrendingUp className="h-4 w-4 mr-1" />Analysis</TabsTrigger>
                </TabsList>

                <TabsContent value="purchases">
                  {customerPurchases.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-6">No purchases yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerPurchases.map((p) => {
                          const items = purchaseDetails.filter((pd) => pd.purchase_id === p.purchase_id);
                          return (
                            <TableRow key={p.purchase_id}>
                              <TableCell>{formatDate(p.purchase_date)}</TableCell>
                              <TableCell>
                                {items.map((it) => (
                                  <div key={it.purchase_detail_id} className="text-sm">
                                    {productMap[it.product_id] || "Unknown"} × {it.quantity}
                                  </div>
                                ))}
                              </TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(p.total_amount)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="feedback">
                  {customerFeedback.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-6">No feedback yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {customerFeedback.map((f) => (
                        <Card key={f.feedback_id}>
                          <CardContent className="py-3 px-4">
                            <div className="flex items-center justify-between">
                              <div className="text-lg">{renderStars(f.rating)}</div>
                              <span className="text-xs text-muted-foreground">{formatDate(f.date)}</span>
                            </div>
                            {f.comment && <p className="text-sm mt-1">{f.comment}</p>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="analysis">
                  {repetitiveProducts.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-6">No repetitive purchases found.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">Times Bought</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {repetitiveProducts.map((rp) => (
                          <TableRow key={rp.productId}>
                            <TableCell className="font-medium">{rp.productName}</TableCell>
                            <TableCell className="text-center">{rp.frequency}</TableCell>
                            <TableCell className="text-right">
                              {rp.highFrequency ? (
                                <Badge variant="default">High Frequency</Badge>
                              ) : (
                                <Badge variant="secondary">Repeat</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
