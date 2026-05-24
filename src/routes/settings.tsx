import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Settings as SettingsIcon, MessageSquare, MapPin, Sliders, Save } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <Layout>
      <PageHeader
        eyebrow="The Rule Book"
        title="Settings & Rules Engine"
        description="Operational policies, founder rate, message templates, and service area."
      />
      <Tabs defaultValue="rules">
        <TabsList className="mb-6">
          <TabsTrigger value="rules">Perk Rules</TabsTrigger>
          <TabsTrigger value="founder">Founder Terms</TabsTrigger>
          <TabsTrigger value="templates">WhatsApp Templates</TabsTrigger>
          <TabsTrigger value="area">Service Area</TabsTrigger>
        </TabsList>
        <TabsContent value="rules"><PerkRules /></TabsContent>
        <TabsContent value="founder"><FounderTerms /></TabsContent>
        <TabsContent value="templates"><Templates /></TabsContent>
        <TabsContent value="area"><ServiceArea /></TabsContent>
      </Tabs>
    </Layout>
  );
}

function PerkRules() {
  const [rules, setRules] = useState({
    maxReschedules: "2",
    noShowPenalty: "forfeit",
    rescueWindowDays: "7",
    rescueReportHrs: "48",
    travelAdvanceHrs: "48",
    travelDuration: "10",
    travelExtra: "500",
    birthdayAdvanceDays: "7",
    duplicateUpgradeDays: "60",
  });

  return (
    <div className="bg-card border border-border rounded-lg p-5 max-w-3xl">
      <div className="flex items-center gap-2 mb-5">
        <Sliders className="h-4 w-4 text-gold" />
        <div className="font-display text-xl">Editable Perk Rules</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Max reschedules per service" value={rules.maxReschedules} onChange={(v) => setRules({ ...rules, maxReschedules: v })} />
        <Field label="No-show policy" value={rules.noShowPenalty} onChange={(v) => setRules({ ...rules, noShowPenalty: v })} />
        <Field label="Gel Rescue window (days)" value={rules.rescueWindowDays} onChange={(v) => setRules({ ...rules, rescueWindowDays: v })} />
        <Field label="Rescue report deadline (hrs)" value={rules.rescueReportHrs} onChange={(v) => setRules({ ...rules, rescueReportHrs: v })} />
        <Field label="Travel touch-up advance (hrs)" value={rules.travelAdvanceHrs} onChange={(v) => setRules({ ...rules, travelAdvanceHrs: v })} />
        <Field label="Travel touch-up duration (min)" value={rules.travelDuration} onChange={(v) => setRules({ ...rules, travelDuration: v })} />
        <Field label="Outside-area charge (KSH)" value={rules.travelExtra} onChange={(v) => setRules({ ...rules, travelExtra: v })} />
        <Field label="Birthday advance booking (days)" value={rules.birthdayAdvanceDays} onChange={(v) => setRules({ ...rules, birthdayAdvanceDays: v })} />
        <Field label="Random upgrade dedupe (days)" value={rules.duplicateUpgradeDays} onChange={(v) => setRules({ ...rules, duplicateUpgradeDays: v })} />
      </div>
      <Button className="mt-5" onClick={() => toast.success("Rules saved (local).")}>
        <Save className="h-4 w-4 mr-2" /> Save Rules
      </Button>
    </div>
  );
}

function FounderTerms() {
  const [form, setForm] = useState({
    rate: "15",
    termMonths: "6",
    maxFounders: "25",
    activeDefinitionMonths: "12",
    enrollmentFee: "25000",
  });
  return (
    <div className="bg-card border border-border rounded-lg p-5 max-w-3xl">
      <div className="flex items-center gap-2 mb-5">
        <SettingsIcon className="h-4 w-4 text-gold" />
        <div className="font-display text-xl">Founder Terms</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Founder rate discount (%)" value={form.rate} onChange={(v) => setForm({ ...form, rate: v })} />
        <Field label="Term length (months)" value={form.termMonths} onChange={(v) => setForm({ ...form, termMonths: v })} />
        <Field label="Max founder seats" value={form.maxFounders} onChange={(v) => setForm({ ...form, maxFounders: v })} />
        <Field label="Active = ≥1 service per (months)" value={form.activeDefinitionMonths} onChange={(v) => setForm({ ...form, activeDefinitionMonths: v })} />
        <Field label="Enrollment fee (KSH)" value={form.enrollmentFee} onChange={(v) => setForm({ ...form, enrollmentFee: v })} />
      </div>
      <Button className="mt-5" onClick={() => toast.success("Terms saved (local).")}>
        <Save className="h-4 w-4 mr-2" /> Save Terms
      </Button>
    </div>
  );
}

function Templates() {
  const initial = [
    {
      key: "surprise_full_morning",
      title: "Surprise Full — morning of",
      body: "Good morning {{name}} ✨ — Your Refresh today is becoming a full Sanctuary Session. See you soon. — COTERIE",
    },
    {
      key: "rescue_window_close",
      title: "Gel Rescue · window closing",
      body: "Hi {{name}}, your gel rescue window closes in {{days}} day(s). Reply to confirm a slot.",
    },
    {
      key: "term_renewal",
      title: "Term renewal · 30 days",
      body: "{{name}}, your Circle term ends on {{end_date}}. We'd love to extend your sanctuary — reply EXTEND to renew.",
    },
    {
      key: "birthday_week",
      title: "Birthday Sanctuary invite",
      body: "Happy birthday week, {{name}} 🎂 Your Birthday Sanctuary awaits — pick a date within {{window}} days.",
    },
  ];
  const [templates, setTemplates] = useState(initial);

  return (
    <div className="space-y-3 max-w-3xl">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-gold" />
        <div className="font-display text-xl">WhatsApp Templates</div>
      </div>
      {templates.map((t, i) => (
        <div key={t.key} className="bg-card border border-border rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <Label>{t.title}</Label>
            <Badge variant="outline" className="text-[10px]">{t.key}</Badge>
          </div>
          <Textarea
            rows={3}
            value={t.body}
            onChange={(e) => {
              const next = [...templates];
              next[i] = { ...t, body: e.target.value };
              setTemplates(next);
            }}
          />
        </div>
      ))}
      <Button onClick={() => toast.success("Templates saved (local).")}>
        <Save className="h-4 w-4 mr-2" /> Save Templates
      </Button>
    </div>
  );
}

function ServiceArea() {
  const [core] = useState(["Kilimani", "Kileleshwa", "Hurlingham"]);
  const [extended] = useState(["Lavington", "Westlands", "Riverside", "Upperhill"]);
  return (
    <div className="grid md:grid-cols-2 gap-4 max-w-4xl">
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="h-4 w-4 text-gold" />
          <div className="font-display text-xl">Core area · no extra charge</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {core.map((c) => (
            <Badge key={c} className="bg-primary text-primary-foreground">{c}</Badge>
          ))}
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="h-4 w-4 text-gold" />
          <div className="font-display text-xl">Extended · 500 KSH surcharge</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {extended.map((c) => (
            <Badge key={c} variant="outline">{c}</Badge>
          ))}
        </div>
      </div>
      <div className="md:col-span-2 text-[10px] text-muted-foreground">
        Map editor placeholder — extend with a polygon drawing tool when ready.
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
