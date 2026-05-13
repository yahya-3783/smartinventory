import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

interface CategoryWithCount {
  category_id: string;
  category_name: string;
  product_count: number;
}

const Categories = () => {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithCount | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryWithCount | null>(null);
  const [categoryName, setCategoryName] = useState("");

  const fetchCategories = async () => {
    setLoading(true);
    const [{ data: cats }, { data: products }] = await Promise.all([
      supabase.from("categories").select("*").order("category_name"),
      supabase.from("products").select("category_id"),
    ]);

    const countMap: Record<string, number> = {};
    products?.forEach((p) => {
      if (p.category_id) countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
    });

    setCategories(
      (cats || []).map((c) => ({
        ...c,
        product_count: countMap[c.category_id] || 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const openAdd = () => {
    setEditingCategory(null);
    setCategoryName("");
    setDialogOpen(true);
  };

  const openEdit = (cat: CategoryWithCount) => {
    setEditingCategory(cat);
    setCategoryName(cat.category_name);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!categoryName.trim()) {
      toast.error("Category name is required");
      return;
    }

    if (editingCategory) {
      const { error } = await supabase
        .from("categories")
        .update({ category_name: categoryName.trim() })
        .eq("category_id", editingCategory.category_id);
      if (error) { toast.error(error.message); return; }
      toast.success("Category updated");
    } else {
      const { error } = await supabase
        .from("categories")
        .insert({ category_name: categoryName.trim() });
      if (error) { toast.error(error.message); return; }
      toast.success("Category added");
    }
    setDialogOpen(false);
    fetchCategories();
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    if (deletingCategory.product_count > 0) {
      toast.error(`Cannot delete "${deletingCategory.category_name}" — it has ${deletingCategory.product_count} product(s) assigned.`);
      setDeleteDialogOpen(false);
      return;
    }
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("category_id", deletingCategory.category_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Category deleted");
    setDeleteDialogOpen(false);
    fetchCategories();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Categories</h2>
          <p className="text-muted-foreground">Organize products into categories.</p>
        </div>
        <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add Category</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> All Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : categories.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No categories found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category Name</TableHead>
                  <TableHead className="text-center">Products</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.category_id}>
                    <TableCell className="font-medium">{cat.category_name}</TableCell>
                    <TableCell className="text-center">{cat.product_count}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(cat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => { setDeletingCategory(cat); setDeleteDialogOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <Input placeholder="Category name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingCategory ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCategory && deletingCategory.product_count > 0
                ? `"${deletingCategory?.category_name}" has ${deletingCategory?.product_count} product(s). You must reassign or remove them before deleting.`
                : `Are you sure you want to delete "${deletingCategory?.category_name}"? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {deletingCategory && deletingCategory.product_count === 0 && (
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Categories;
