import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChefHat, CheckCircle2, AlertTriangle, XCircle, CalendarClock } from "lucide-react";
import { differenceInDays } from "date-fns";

type Product = {
  product_id: string;
  name: string;
  quantity: number;
  stock_threshold: number;
  expiry_date: string | null;
};

type Recipe = {
  recipe_id: string;
  recipe_name: string;
  instructions: string | null;
  ingredients: Product[];
  availability: "can_make" | "partial" | "none";
  nearExpiryIngredientCount: number;
};

const Recipes = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form
  const [recipeName, setRecipeName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const [{ data: recipesData }, { data: ingredientsData }, { data: productsData }] = await Promise.all([
      supabase.from("recipes").select("*"),
      supabase.from("recipe_ingredients").select("*"),
      supabase.from("products").select("*"),
    ]);

    const prods = productsData || [];
    setProducts(prods);
    const prodMap = new Map(prods.map((p) => [p.product_id, p]));
    const now = new Date();

    const enriched: Recipe[] = (recipesData || []).map((r) => {
      const ingredientIds = (ingredientsData || [])
        .filter((ri) => ri.recipe_id === r.recipe_id)
        .map((ri) => ri.product_id);
      const ingredients = ingredientIds.map((id) => prodMap.get(id)).filter(Boolean) as Product[];

      const inStock = ingredients.filter((p) => p.quantity > 0);
      let availability: Recipe["availability"] = "none";
      if (ingredients.length > 0 && inStock.length === ingredients.length) availability = "can_make";
      else if (inStock.length > 0) availability = "partial";

      const nearExpiryIngredientCount = ingredients.filter((p) => {
        if (!p.expiry_date) return false;
        const days = differenceInDays(new Date(p.expiry_date), now);
        return days >= 0 && days <= 7;
      }).length;

      return { ...r, ingredients, availability, nearExpiryIngredientCount };
    });

    // Sort: can_make first, then partial, then none. Within same, prioritize more near-expiry ingredients
    const order = { can_make: 0, partial: 1, none: 2 };
    enriched.sort((a, b) => order[a.availability] - order[b.availability] || b.nearExpiryIngredientCount - a.nearExpiryIngredientCount);

    setRecipes(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => {
    setEditingRecipe(null);
    setRecipeName("");
    setInstructions("");
    setSelectedProducts([]);
    setDialogOpen(true);
  };

  const openEdit = (r: Recipe) => {
    setEditingRecipe(r);
    setRecipeName(r.recipe_name);
    setInstructions(r.instructions || "");
    setSelectedProducts(r.ingredients.map((i) => i.product_id));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!recipeName.trim()) { toast.error("Recipe name is required"); return; }
    if (selectedProducts.length === 0) { toast.error("Select at least one ingredient"); return; }
    setSaving(true);

    if (editingRecipe) {
      const { error } = await supabase.from("recipes").update({ recipe_name: recipeName.trim(), instructions: instructions.trim() || null }).eq("recipe_id", editingRecipe.recipe_id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      // Replace ingredients
      await supabase.from("recipe_ingredients").delete().eq("recipe_id", editingRecipe.recipe_id);
      await supabase.from("recipe_ingredients").insert(selectedProducts.map((pid) => ({ recipe_id: editingRecipe.recipe_id, product_id: pid })));
      toast.success("Recipe updated!");
    } else {
      const { data, error } = await supabase.from("recipes").insert({ recipe_name: recipeName.trim(), instructions: instructions.trim() || null }).select().single();
      if (error || !data) { toast.error(error?.message || "Failed"); setSaving(false); return; }
      await supabase.from("recipe_ingredients").insert(selectedProducts.map((pid) => ({ recipe_id: data.recipe_id, product_id: pid })));
      toast.success("Recipe created!");
    }

    setSaving(false);
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("recipe_ingredients").delete().eq("recipe_id", deleteId);
    const { error } = await supabase.from("recipes").delete().eq("recipe_id", deleteId);
    if (error) toast.error(error.message);
    else toast.success("Recipe deleted");
    setDeleteId(null);
    fetchData();
  };

  const toggleProduct = (pid: string) => {
    setSelectedProducts((prev) => prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]);
  };

  const getAvailabilityBadge = (a: Recipe["availability"]) => {
    if (a === "can_make") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Can Make Now</Badge>;
    if (a === "partial") return <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30 hover:bg-orange-500/20"><AlertTriangle className="h-3 w-3 mr-1" />Partially Available</Badge>;
    return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/20"><XCircle className="h-3 w-3 mr-1" />Not Available</Badge>;
  };

  const isNearExpiry = (p: Product) => {
    if (!p.expiry_date) return false;
    const days = differenceInDays(new Date(p.expiry_date), new Date());
    return days >= 0 && days <= 7;
  };

  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Recipes</h2>
          <p className="text-muted-foreground">Ingredient-based recipe management</p>
        </div>
        <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add Recipe</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : recipes.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No recipes yet. Add your first recipe!</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((r) => (
            <Card key={r.recipe_id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-primary" />
                      {r.recipe_name}
                    </CardTitle>
                    {getAvailabilityBadge(r.availability)}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(r.recipe_id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Ingredients</p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.ingredients.map((ing) => (
                      <Badge
                        key={ing.product_id}
                        variant={ing.quantity <= 0 ? "destructive" : "secondary"}
                        className={isNearExpiry(ing) ? "ring-2 ring-orange-400/50 bg-orange-500/10 text-orange-700" : ""}
                      >
                        {isNearExpiry(ing) && <CalendarClock className="h-3 w-3 mr-1" />}
                        {ing.name}
                        {ing.quantity <= 0 && " (out)"}
                      </Badge>
                    ))}
                  </div>
                </div>
                {r.instructions && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Instructions</p>
                    <p className="text-sm text-foreground whitespace-pre-line line-clamp-4">{r.instructions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRecipe ? "Edit Recipe" : "Add Recipe"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Recipe Name</Label>
              <Input value={recipeName} onChange={(e) => setRecipeName(e.target.value)} placeholder="e.g. Banana Smoothie" />
            </div>
            <div>
              <Label>Instructions</Label>
              <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Step-by-step instructions..." rows={4} />
            </div>
            <div>
              <Label>Ingredients</Label>
              <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search products..." className="mb-2" />
              <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                {filteredProducts.map((p) => (
                  <label key={p.product_id} className="flex items-center gap-2 p-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                    <Checkbox checked={selectedProducts.includes(p.product_id)} onCheckedChange={() => toggleProduct(p.product_id)} />
                    <span className="text-foreground">{p.name}</span>
                    {p.quantity <= 0 && <Badge variant="destructive" className="text-[10px] px-1 py-0">Out</Badge>}
                    {isNearExpiry(p) && <Badge className="bg-orange-500/15 text-orange-600 text-[10px] px-1 py-0">Expiring</Badge>}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{selectedProducts.length} selected</p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : editingRecipe ? "Update Recipe" : "Create Recipe"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recipe?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this recipe and its ingredient mappings.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Recipes;
