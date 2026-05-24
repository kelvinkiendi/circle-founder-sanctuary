import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, Lock, Unlock, Plus, Calendar, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/products")({ component: ProductVaultPage });

const PRELAUNCH_DAYS = 14;
const MAX_PER_FOUNDER = 2;

function ProductVaultPage() {
  return (
    <Layout>
      <PageHeader
        eyebrow="The Vault"
        title="Product Vault"
        description="14-day founder pre-launch windows · cost +20% pricing · max 2 per founder."
      />
      <Tabs defaultValue="catalog">
        <TabsList className="mb-6">
          <TabsTrigger value="catalog">Catalog & Launches</TabsTrigger>
          <TabsTrigger value="purchases">Founder Purchases</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog"><CatalogView /></TabsContent>
        <TabsContent value="purchases"><PurchasesView /></TabsContent>
      </Tabs>
    </Layout>
  );
}

function CatalogView() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState<any>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["all-founder-purchases"],
    queryFn: async () => {
      const { data } = await supabase.from("founder_purchases").select("*");
      return data || [];
    },
  });

  const reservedFor = (productId: string) =>
    purchases.filter((p: any) => p.product_id === productId).reduce((s: number, p: any) => s + p.quantity, 0);

  const toggleLaunch = useMutation({
    mutationFn: async ({ id, launch_status }: any) => {
      const { error } = await supabase.from("products").update({ launch_status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Launch status updated.");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Product
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p: any) => {
          const reserved = reservedFor(p.id);
          const available = p.stock_quantity - reserved;
          const isPrelaunch = p.launch_status === "prelaunch";
          return (
            <div key={p.id} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-display text-lg">{p.name}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">
                    {p.category}
                  </div>
                </div>
                <Badge className={isPrelaunch ? "bg-gold text-gold-foreground" : ""}>
                  {isPrelaunch ? (
                    <><Lock className="h-3 w-3 mr-1" /> Pre-launch</>
                  ) : (
                    <><Unlock className="h-3 w-3 mr-1" /> Public</>
                  )}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mt-4">
                <div className="p-2 bg-secondary/40 rounded">
                  <div className="text-muted-foreground">Founder</div>
                  <div className="font-medium">{Number(p.founder_price).toLocaleString()} KSH</div>
                </div>
                <div className="p-2 bg-secondary/40 rounded">
                  <div className="text-muted-foreground">Retail</div>
                  <div className="font-medium">{Number(p.retail_price).toLocaleString()} KSH</div>
                </div>
                <div className="p-2 bg-secondary/40 rounded">
                  <div className="text-muted-foreground">Stock</div>
                  <div className="font-medium">{p.stock_quantity}</div>
                </div>
                <div className="p-2 bg-secondary/40 rounded">
                  <div className="text-muted-foreground">Available</div>
                  <div className="font-medium">{available}</div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setPurchaseOpen(p)}>
                  <ShoppingBag className="h-3 w-3 mr-1" /> Record Sale
                </Button>
                <Button
                  size="sm"
                  variant={isPrelaunch ? "default" : "outline"}
                  onClick={() =>
                    toggleLaunch.mutate({
                      id: p.id,
                      launch_status: isPrelaunch ? "public" : "prelaunch",
                    })
                  }
                >
                  {isPrelaunch ? "Launch" : "Lock"}
                </Button>
              </div>
              {isPrelaunch && (
                <div className="mt-3 text-[10px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {PRELAUNCH_DAYS}-day founder exclusive window
                </div>
              )}
            </div>
          );
        })}
        {products.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 text-center py-12 text-sm text-muted-foreground bg-card border border-dashed border-border rounded-lg">
            No products yet — add your first launch.
          </div>
        )}
      </div>

      <AddProductDialog open={open} onOpenChange={setOpen} />
      <RecordPurchaseDialog
        product={purchaseOpen}
        onOpenChange={(v) => !v && setPurchaseOpen(null)}
      />
    </div>
  );
}

function AddProductDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    category: "polish",
    cost_price: "",
    stock_quantity: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      const cost = Number(form.cost_price);
      const founderPrice = Math.round(cost * 1.2);
      const retailPrice = Math.round(cost * 2);
      const { error } = await supabase.from("products").insert({
        name: form.name,
        category: form.category as any,
        cost_price: cost,
        founder_price: founderPrice,
        retail_price: retailPrice,
        stock_quantity: Number(form.stock_quantity),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product added to vault.");
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
      setForm({ name: "", category: "polish", cost_price: "", stock_quantity: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="polish">Polish</SelectItem>
                <SelectItem value="treatment">Treatment</SelectItem>
                <SelectItem value="tool">Tool</SelectItem>
                <SelectItem value="accessory">Accessory</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cost (KSH)</Label>
              <Input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
              {form.cost_price && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  Founder: {Math.round(Number(form.cost_price) * 1.2).toLocaleString()} · Retail: {Math.round(Number(form.cost_price) * 2).toLocaleString()}
                </div>
              )}
            </div>
            <div>
              <Label>Stock</Label>
              <Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!form.name || !form.cost_price || !form.stock_quantity}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordPurchaseDialog({ product, onOpenChange }: { product: any; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [founderId, setFounderId] = useState("");
  const [qty, setQty] = useState("1");

  const { data: founders = [] } = useQuery({
    queryKey: ["active-founders-mini"],
    queryFn: async () => {
      const { data } = await supabase
        .from("founder_circle")
        .select("id, clients(full_name)")
        .eq("status", "active");
      return data || [];
    },
  });

  const { data: existingPurchases = [] } = useQuery({
    queryKey: ["existing-purchases", product?.id, founderId],
    enabled: !!product && !!founderId,
    queryFn: async () => {
      const { data } = await supabase
        .from("founder_purchases")
        .select("quantity")
        .eq("product_id", product.id)
        .eq("founder_id", founderId);
      return data || [];
    },
  });

  const alreadyBought = existingPurchases.reduce((s: number, p: any) => s + p.quantity, 0);
  const remainingAllowed = MAX_PER_FOUNDER - alreadyBought;
  const requested = Number(qty);
  const over = requested > remainingAllowed;

  const buy = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("founder_purchases").insert({
        founder_id: founderId,
        product_id: product.id,
        quantity: requested,
        price_applied: product.founder_price * requested,
        prelaunch_window: product.launch_status === "prelaunch",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase recorded.");
      qc.invalidateQueries();
      onOpenChange(false);
      setFounderId("");
      setQty("1");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!product) return null;

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record sale · {product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Founder</Label>
            <Select value={founderId} onValueChange={setFounderId}>
              <SelectTrigger><SelectValue placeholder="Select founder" /></SelectTrigger>
              <SelectContent>
                {founders.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>{f.clients?.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantity (max {MAX_PER_FOUNDER} per founder per product)</Label>
            <Input type="number" min={1} max={MAX_PER_FOUNDER} value={qty} onChange={(e) => setQty(e.target.value)} />
            {founderId && (
              <div className={`text-xs mt-1 ${over ? "text-destructive" : "text-muted-foreground"}`}>
                Already bought: {alreadyBought} · Remaining allowance: {remainingAllowed}
              </div>
            )}
          </div>
          <div className="text-sm font-medium">
            Total: {(Number(product.founder_price) * requested).toLocaleString()} KSH (founder rate)
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => buy.mutate()} disabled={!founderId || over || requested < 1}>
            Record Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchasesView() {
  const { data: purchases = [] } = useQuery({
    queryKey: ["purchases-with-relations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("founder_purchases")
        .select("*, products(name), founder_circle:founder_id(clients(full_name))")
        .order("purchase_date", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="font-display text-xl mb-4 flex items-center gap-2">
        <Package className="h-4 w-4 text-gold" /> Founder Purchases
      </div>
      {purchases.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          No purchases yet.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {purchases.map((p: any) => (
            <div key={p.id} className="py-3 flex justify-between gap-4">
              <div>
                <div className="text-sm font-medium">
                  {p.founder_circle?.clients?.full_name || "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.products?.name || "—"} × {p.quantity}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{Number(p.price_applied).toLocaleString()} KSH</div>
                <div className="text-xs text-muted-foreground">
                  {p.purchase_date} {p.prelaunch_window && <Badge variant="outline" className="ml-1 text-[10px]">Pre-launch</Badge>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
