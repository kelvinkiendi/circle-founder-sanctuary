import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wine, Plus, MapPin, Calendar, Camera, AlertCircle, CheckCircle2, Hammer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/brunch")({ component: BrunchPage });

const FOOD_PER_HEAD = 2500;

function BrunchPage() {
  return (
    <Layout>
      <PageHeader
        eyebrow="Gatherings"
        title="Founder Brunch & Sanctuary Preview"
        description="Quarterly brunches, preview day milestones, RSVPs, and consent tracking."
      />
      <Tabs defaultValue="brunch">
        <TabsList className="mb-6">
          <TabsTrigger value="brunch">Founder Brunch</TabsTrigger>
          <TabsTrigger value="preview">Sanctuary Preview Day</TabsTrigger>
        </TabsList>
        <TabsContent value="brunch"><BrunchTab /></TabsContent>
        <TabsContent value="preview"><PreviewTab /></TabsContent>
      </Tabs>
    </Layout>
  );
}

function BrunchTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["brunch-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("founder_brunch_events")
        .select("*")
        .order("event_date", { ascending: true });
      return data || [];
    },
  });

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6">
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Event
          </Button>
        </div>
        {events.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
            No brunch events scheduled — create the first gathering.
          </div>
        ) : (
          events.map((e: any) => (
            <button
              key={e.id}
              onClick={() => setSelected(e)}
              className={`w-full text-left bg-card border rounded-lg p-5 transition-colors ${
                selected?.id === e.id ? "border-primary" : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-display text-xl">{e.event_name}</div>
                  <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {e.event_date}</span>
                    {e.venue && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.venue}</span>}
                  </div>
                </div>
                <Badge variant={e.status === "completed" ? "secondary" : "default"}>
                  {e.status}
                </Badge>
              </div>
            </button>
          ))
        )}
      </div>

      <EventDetail event={selected} />

      <NewEventDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function EventDetail({ event }: { event: any }) {
  const qc = useQueryClient();

  const { data: founders = [] } = useQuery({
    queryKey: ["active-founders-brunch"],
    queryFn: async () => {
      const { data } = await supabase
        .from("founder_circle")
        .select("id, clients(full_name)")
        .eq("status", "active");
      return data || [];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["brunch-attendance", event?.id],
    enabled: !!event,
    queryFn: async () => {
      const { data } = await supabase
        .from("brunch_attendance")
        .select("*, founder_circle:founder_id(clients(full_name))")
        .eq("event_id", event.id);
      return data || [];
    },
  });

  const rsvp = useMutation({
    mutationFn: async (founder_id: string) => {
      const { error } = await supabase.from("brunch_attendance").insert({
        event_id: event.id,
        founder_id,
        attendance_status: "confirmed",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brunch-attendance"] });
      toast.success("RSVP added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleConsent = useMutation({
    mutationFn: async ({ id, photo_consent }: any) => {
      const { error } = await supabase
        .from("brunch_attendance")
        .update({ photo_consent })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brunch-attendance"] }),
  });

  if (!event) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-sm text-muted-foreground text-center">
        Select an event to manage RSVPs.
      </div>
    );
  }

  const confirmed = attendance.filter((a: any) => a.attendance_status === "confirmed").length;
  const noConsent = attendance.filter((a: any) => !a.photo_consent);
  const foodCost = confirmed * FOOD_PER_HEAD;

  const eligible = (founders as any[]).filter(
    (f) => !attendance.find((a: any) => a.founder_id === f.id),
  );

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="font-display text-xl">{event.event_name}</div>
        <div className="text-xs text-muted-foreground mb-3">{event.event_date} · {event.venue}</div>

        <div className="grid grid-cols-3 gap-2 text-xs mb-4">
          <div className="p-2 bg-secondary/40 rounded">
            <div className="text-muted-foreground">Confirmed</div>
            <div className="font-medium text-lg">{confirmed}</div>
          </div>
          <div className="p-2 bg-secondary/40 rounded">
            <div className="text-muted-foreground">Food (COTERIE)</div>
            <div className="font-medium text-sm">{foodCost.toLocaleString()} KSH</div>
          </div>
          <div className="p-2 bg-secondary/40 rounded">
            <div className="text-muted-foreground">Opted-out photo</div>
            <div className="font-medium text-lg">{noConsent.length}</div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground mb-2">Alcohol is a separate expense (not covered).</div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <div className="text-sm font-medium mb-3">RSVPs</div>
        {attendance.length === 0 && (
          <div className="text-xs text-muted-foreground italic">No RSVPs yet.</div>
        )}
        <div className="space-y-2">
          {attendance.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between text-sm">
              <span>{a.founder_circle?.clients?.full_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Photos</span>
                <Switch
                  checked={a.photo_consent}
                  onCheckedChange={(v) => toggleConsent.mutate({ id: a.id, photo_consent: v })}
                />
                {!a.photo_consent && (
                  <Badge variant="outline" className="text-[10px]">
                    <AlertCircle className="h-3 w-3 mr-1" /> Notify in writing
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        {eligible.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Add RSVP</div>
            <Select onValueChange={(v) => rsvp.mutate(v)}>
              <SelectTrigger><SelectValue placeholder="Add founder…" /></SelectTrigger>
              <SelectContent>
                {eligible.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>{f.clients?.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {event.status !== "completed" && (
        <Button variant="outline" className="w-full" onClick={async () => {
          const { error } = await supabase.from("founder_brunch_events").update({ status: "completed" }).eq("id", event.id);
          if (error) { toast.error(error.message); return; }
          toast.success("Event marked completed.");
          qc.invalidateQueries({ queryKey: ["brunch-events"] });
        }}>
          <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Completed
        </Button>
      )}
      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Camera className="h-3 w-3" /> Photo uploads coming with storage integration.
      </div>
    </div>
  );
}

function NewEventDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ event_name: "", event_date: "", venue: "" });
  const [menu, setMenu] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("founder_brunch_events").insert({
        event_name: form.event_name,
        event_date: form.event_date,
        venue: form.venue || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event created.");
      qc.invalidateQueries({ queryKey: ["brunch-events"] });
      onOpenChange(false);
      setForm({ event_name: "", event_date: "", venue: "" });
      setMenu("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle><Wine className="h-4 w-4 inline mr-2" /> New Brunch Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Event name</Label>
            <Input value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div>
              <Label>Venue (Kilimani+)</Label>
              <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="e.g. Garden Bistro" />
            </div>
          </div>
          <div>
            <Label>Menu notes</Label>
            <Textarea value={menu} onChange={(e) => setMenu(e.target.value)} placeholder="Saved with event record" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!form.event_name || !form.event_date}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewTab() {
  const [milestones] = useState([
    { id: "1", name: "Studio walls finalised", date: "Soft Q3", complete: true },
    { id: "2", name: "Sanctuary furnishings installed", date: "Soft Q3", complete: false },
    { id: "3", name: "Sanctuary Preview Day", date: "TBC", complete: false },
  ]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-1">
          <Hammer className="h-4 w-4 text-gold" />
          <div className="font-display text-xl">Construction milestones</div>
        </div>
        <div className="text-xs text-muted-foreground mb-4">Preview Day unlocks once all milestones are complete.</div>
        <div className="space-y-2">
          {milestones.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-md border border-border">
              <div>
                <div className="text-sm font-medium">{m.name}</div>
                <div className="text-[10px] text-muted-foreground">{m.date}</div>
              </div>
              <Badge variant={m.complete ? "default" : "outline"}>{m.complete ? "Done" : "Pending"}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <div className="font-display text-xl mb-1">Delay clause</div>
        <div className="text-sm text-muted-foreground mb-4">
          If the studio does not open during a founder's term, their Sanctuary Preview entitlement auto-converts to a
          <span className="text-foreground font-medium"> complimentary full service at the founder's location</span>.
        </div>
        <div className="space-y-2 text-xs">
          <div className="p-3 bg-secondary/40 rounded">Mini-manicure slots open to all active founders once Preview Day is scheduled.</div>
          <div className="p-3 bg-secondary/40 rounded">First retail access tracked separately under Product Vault pre-launch.</div>
        </div>
      </div>
    </div>
  );
}
