import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Pencil, Trash2, Search, CalendarIcon } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import { useAppSettings } from "@/hooks/useAppSettings";

interface Product {
  product_id: string;
  name: string;
  category_id: string | null;
  quantity: number;
  price: number;
  expiry_date: string | null;
  stock_threshold: number;
}

interface Category {
  category_id: string;
  category_name: string;
}

interface FormData {
  name: string;
  category_id: string;
  quantity: string;
  price: string;
  expiry_date: Date | undefined;
  stock_threshold: string;
}

const emptyForm: FormData = {
  name: "",
  category_id: "",
  quantity: "",
  price: "",
  expiry_date: undefined,
  stock_threshold: "10",
};

function getStockStatus(product: Product) {
  const now = new Date();
  const expiry = product.expiry_date ? new Date(product.expiry_date) : null;

  if (expiry && differenceInDays(expiry, now) < 0)
    return { label: "Expired", variant: "destructive" as const };
  if (product.quantity === 0)
    return { label: "Out of Stock", variant: "destructive" as const };
  if (expiry && differenceInDays(expiry, now) <= 7)
    return { label: "Near Expiry", variant: "secondary" as const };
  if (product.quantity <= product.stock_threshold)
    return { label: "Low Stock", variant: "outline" as const };
  return { label: "In Stock", variant: "default" as const };
}

const Products = () => {
  const { formatCurrency } = useCurrency();
  const { defaultStockThreshold } = useAppSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("categories").select("*").order("category_name"),
    ]);
    setProducts(prods || []);
    setCategories(cats || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(c => { map[c.category_id] = c.category_name; });
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCat = categoryFilter === "all" || p.category_id === categoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [products, search, categoryFilter]);

  const openAdd = () => {
    setEditingProduct(null);
    setForm({ ...emptyForm, stock_threshold: String(defaultStockThreshold) });
    setFormOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      category_id: p.category_id || "",
      quantity: String(p.quantity),
      price: String(p.price),
      expiry_date: p.expiry_date ? new Date(p.expiry_date) : undefined,
      stock_threshold: String(p.stock_threshold),
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const qty = parseInt(form.quantity);
    if (isNaN(qty) || qty < 0) { toast.error("Quantity must be 0 or more"); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { toast.error("Price must be 0 or more"); return; }
    const threshold = parseInt(form.stock_threshold);
    if (isNaN(threshold) || threshold < 0) { toast.error("Threshold must be 0 or more"); return; }

    setSaving(true);
    const record = {
      name: form.name.trim(),
      category_id: form.category_id || null,
      quantity: qty,
      price,
      expiry_date: form.expiry_date ? format(form.expiry_date, "yyyy-MM-dd") : null,
      stock_threshold: threshold,
    };

    let error;
    if (editingProduct) {
      ({ error } = await supabase.from("products").update(record).eq("product_id", editingProduct.product_id));
    } else {
      ({ error } = await supabase.from("products").insert(record));
    }

    setSaving(false);
    if (error) { toast.error("Failed to save product: " + error.message); return; }
    toast.success(editingProduct ? "Product updated successfully" : "Product added successfully");
    setFormOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteProduct) return;
    const { error } = await supabase.from("products").delete().eq("product_id", deleteProduct.product_id);
    if (error) { toast.error("Failed to delete product: " + error.message); return; }
    toast.success(`"${deleteProduct.name}" deleted successfully`);
    setDeleteProduct(null);
    fetchData();
  };

  const getDaysUntilExpiry = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    return differenceInDays(new Date(expiryDate), new Date());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Products</h2>
          <p className="text-muted-foreground">Manage your inventory products.</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Product</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => (
              <SelectItem key={c.category_id} value={c.category_id}>{c.category_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead className="text-right">Days Left</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No products found. Try adjusting your search or filters.</TableCell></TableRow>
            ) : filtered.map(p => {
              const status = getStockStatus(p);
              const daysLeft = getDaysUntilExpiry(p.expiry_date);
              return (
                <TableRow key={p.product_id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.category_id ? categoryMap[p.category_id] || "—" : "—"}</TableCell>
                  <TableCell className="text-right">{p.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.price)}</TableCell>
                  <TableCell>{p.expiry_date ? formatDate(p.expiry_date) : "—"}</TableCell>
                  <TableCell className={cn("text-right", daysLeft !== null && daysLeft <= 3 ? "text-destructive font-semibold" : daysLeft !== null && daysLeft <= 7 ? "text-accent-foreground font-semibold" : "")}>
                    {daysLeft !== null ? (daysLeft < 0 ? "Expired" : daysLeft) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteProduct(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>{editingProduct ? "Update product details." : "Fill in the product details."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.category_id} value={c.category_id}>{c.category_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Price *</Label>
                <Input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.expiry_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.expiry_date ? formatDate(form.expiry_date) : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.expiry_date} onSelect={d => setForm(f => ({ ...f, expiry_date: d }))} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Stock Threshold</Label>
                <Input type="number" min="0" value={form.stock_threshold} onChange={e => setForm(f => ({ ...f, stock_threshold: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProduct} onOpenChange={open => !open && setDeleteProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteProduct?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Products;
