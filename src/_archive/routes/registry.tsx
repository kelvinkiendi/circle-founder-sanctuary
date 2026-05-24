import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { WHATSAPP_TEMPLATES } from "@/lib/whatsapp-templates";
import { normalizeKePhone } from "@/lib/phone";
import { toast } from "sonner";
import { PageHeader } from "@/components/Layout";
import {
  UserPlus, Upload, Search, Download, X, Loader2, CheckCircle2,
  AlertTriangle, Crown, MessageSquare, History, Calendar,
} from "lucide-react";

type ClientRow = {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  birthday: string | null;
  address: string | null;
  client_type: string;
  status: string;
  notes: string | null;
  referrer_id: string | null;
  referral_source: string | null;
  first_visit_date: string | null;
  avatar_url: string | null;
  created_at: string;
};

const REFERRAL_SOURCES = ["Instagram", "Referral", "Walk-in", "Google", "Friend", "Other"];

export function Registry() {
  const { session } = useSession();
  const canBulkImport = session?.role === "admin" || session?.role === "manager";
  const canEnrollFounder = session?.role === "admin";

  const [tab, setTab] = useState<"search" | "import">("search");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "regular" | "founder" | "prospect" | "birthday">("all");
  const [quickOpen, setQuickOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [historyFor, setHistoryFor] = useState<ClientRow | null>(null);

  const { data: clients, refetch } = useQuery({
    queryKey: ["registry-clients", q, filter],
    queryFn: async () => {
      let qb = supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (q.trim()) {
        qb = qb.or(
          `full_name.ilike.%${q}%,phone.ilike.%${q}%,whatsapp_number.ilike.%${q}%,email.ilike.%${q}%`,
        );
      }
      if (filter === "regular") qb = qb.eq("client_type", "regular");
      if (filter === "founder") qb = qb.eq("client_type", "founder");
      if (filter === "prospect") qb = qb.eq("client_type", "prospect");
      if (filter === "birthday") {
        const m = String(new Date().getMonth() + 1).padStart(2, "0");
        qb = qb.like("birthday", `____-${m}-__`);
      }
      const { data, error } = await qb;
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });

  const { data: founderMap } = useQuery({
    queryKey: ["registry-founder-map"],
    queryFn: async () => {
      const { data } = await supabase.from("founder_circle").select("client_id, founder_number, status");
      const m: Record<string, { number: number | null; status: string }> = {};
      (data ?? []).forEach((r: any) => {
        m[r.client_id] = { number: r.founder_number, status: r.status };
      });
      return m;
    },
  });

  const { data: lastVisits } = useQuery({
    queryKey: ["registry-last-visits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("client_id, scheduled_date")
        .order("scheduled_date", { ascending: false })
        .limit(500);
      const m: Record<string, string> = {};
      (data ?? []).forEach((r: any) => {
        if (!m[r.client_id]) m[r.client_id] = r.scheduled_date;
      });
      return m;
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="The Registry · Client Onboarding"
        title="Welcome every soul into the sanctuary."
        description="Quick add, bulk import, and manage every client in COTERIE's circle."
        action={
          <div className="flex gap-2">
            {canBulkImport && (
              <button
                onClick={() => setTab("import")}
                className="text-xs uppercase tracking-[0.2em] px-4 py-2.5 border border-border rounded-md hover:bg-muted flex items-center gap-2"
              >
                <Upload className="h-3.5 w-3.5" /> Bulk Import
              </button>
            )}
            <button
              onClick={() => { setEditing(null); setQuickOpen(true); }}
              className="text-xs uppercase tracking-[0.2em] px-4 py-2.5 bg-primary text-primary-foreground rounded-md hover:opacity-90 flex items-center gap-2"
            >
              <UserPlus className="h-3.5 w-3.5" /> New Client
            </button>
          </div>
        }
      />

      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setTab("search")}
          className={`px-4 py-2 text-xs uppercase tracking-[0.2em] border-b-2 -mb-px ${tab === "search" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
        >Smart Search</button>
        {canBulkImport && (
          <button
            onClick={() => setTab("import")}
            className={`px-4 py-2 text-xs uppercase tracking-[0.2em] border-b-2 -mb-px ${tab === "import" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          >Bulk Import</button>
        )}
      </div>

      {tab === "search" && (
        <>
          <div className="bg-card border border-border rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, phone, WhatsApp, email…"
                className="flex-1 bg-transparent text-sm outline-none py-2"
              />
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {[
                ["all", "All Clients"],
                ["regular", "Regular"],
                ["founder", "Founder Circle"],
                ["prospect", "Prospects"],
                ["birthday", "Birthday This Month"],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k as any)}
                  className={`text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border ${filter === k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                >{label}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {(clients ?? []).map((c) => {
              const f = founderMap?.[c.id];
              const last = lastVisits?.[c.id];
              return (
                <div key={c.id} className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
                  <Avatar name={c.full_name} url={c.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium">{c.full_name}</div>
                      {f && (
                        <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                          <Crown className="h-3 w-3" /> Founder {f.number ? `#${f.number}` : ""}
                        </span>
                      )}
                      {c.client_type === "prospect" && (
                        <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700">Prospect</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {c.phone || "—"}
                      {last ? ` · last visit ${last}` : " · new client"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setHistoryFor(c)} title="Backfill history"
                      className="text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 border border-border rounded-md hover:bg-muted flex items-center gap-1">
                      <History className="h-3 w-3" /> History
                    </button>
                    <button onClick={() => sendWelcome(c)} title="Send welcome WhatsApp"
                      className="text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 border border-border rounded-md hover:bg-muted flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> WhatsApp
                    </button>
                    {canEnrollFounder && c.client_type !== "founder" && (
                      <button onClick={() => upgradeToFounder(c)} title="Upgrade to Founder"
                        className="text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 border border-primary/30 text-primary rounded-md hover:bg-primary/5 flex items-center gap-1">
                        <Crown className="h-3 w-3" /> Upgrade
                      </button>
                    )}
                    <button onClick={() => { setEditing(c); setQuickOpen(true); }}
                      className="text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 bg-primary text-primary-foreground rounded-md">Edit</button>
                  </div>
                </div>
              );
            })}
            {clients && clients.length === 0 && (
              <div className="text-center text-muted-foreground py-12 text-sm">No clients found.</div>
            )}
          </div>
        </>
      )}

      {tab === "import" && canBulkImport && <BulkImport onDone={() => { refetch(); setTab("search"); }} />}

      {quickOpen && (
        <QuickAddModal
          client={editing}
          onClose={() => { setQuickOpen(false); setEditing(null); }}
          onSaved={() => refetch()}
        />
      )}

      {historyFor && (
        <HistoryModal client={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  if (url) return <img src={url} alt={name} className="h-12 w-12 rounded-full object-cover" />;
  return (
    <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display text-sm">
      {initials || "?"}
    </div>
  );
}

async function sendWelcome(c: ClientRow) {
  if (!c.whatsapp_number && !c.phone) {
    toast.error("No WhatsApp number on file.");
    return;
  }
  const tmpl = WHATSAPP_TEMPLATES.find((t) => t.key === "just_because");
  const body = `Welcome to COTERIE Nail Sanctuary, ${c.full_name}. You're now in our circle. Book your next sanctuary session via WhatsApp or visit us at Shujaah Mall, Kilimani. — COTERIE`;
  const { error } = await supabase.from("whatsapp_messages").insert({
    client_id: c.id,
    template_key: "welcome_onboard",
    body,
    status: "sent",
  });
  if (error) toast.error(error.message);
  else toast.success(`Welcome message queued for ${c.full_name}`);
  void tmpl;
}

async function upgradeToFounder(c: ClientRow) {
  const ok = window.confirm(`Upgrade ${c.full_name} to Founder Circle? This opens enrollment.`);
  if (!ok) return;
  window.location.href = `/concierge/desk?tab=founders&upgrade=${c.id}`;
}

/* ---------------- Quick Add / Edit ---------------- */

function QuickAddModal({
  client, onClose, onSaved,
}: { client: ClientRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: client?.full_name ?? "",
    phone: client?.phone ?? "",
    whatsapp_number: client?.whatsapp_number ?? "",
    email: client?.email ?? "",
    birthday: client?.birthday ?? "",
    address: client?.address ?? "",
    client_type: (client?.client_type ?? "regular") as "regular" | "prospect",
    referral_source: client?.referral_source ?? "",
    referrer_id: client?.referrer_id ?? "",
    notes: client?.notes ?? "",
    first_visit_date: client?.first_visit_date ?? new Date().toISOString().slice(0, 10),
    avatar_url: client?.avatar_url ?? "",
  });
  const [whatsappSame, setWhatsappSame] = useState(!client?.whatsapp_number || client?.whatsapp_number === client?.phone);
  const [sendWelcomeOpt, setSendWelcomeOpt] = useState(!client);
  const [referrerQ, setReferrerQ] = useState("");

  const { data: referrers } = useQuery({
    queryKey: ["referrer-search", referrerQ],
    queryFn: async () => {
      if (!referrerQ.trim()) return [];
      const { data } = await supabase.from("clients").select("id, full_name, phone").ilike("full_name", `%${referrerQ}%`).limit(5);
      return data ?? [];
    },
    enabled: form.referral_source === "Referral",
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("Name is required");
      const phone = normalizeKePhone(form.phone);
      if (!phone) throw new Error("Invalid phone (use +254… or 07xx…)");
      const wa = whatsappSame ? phone : (form.whatsapp_number ? normalizeKePhone(form.whatsapp_number) : null);
      if (!whatsappSame && form.whatsapp_number && !wa) throw new Error("Invalid WhatsApp number");

      const payload: any = {
        full_name: form.full_name.trim(),
        phone,
        whatsapp_number: wa,
        email: form.email || null,
        birthday: form.birthday || null,
        address: form.address || null,
        client_type: form.client_type,
        referral_source: form.referral_source || null,
        referrer_id: form.referrer_id || null,
        notes: form.notes || null,
        first_visit_date: form.first_visit_date || null,
        avatar_url: form.avatar_url || null,
      };

      let clientId = client?.id;
      if (client) {
        const { error } = await supabase.from("clients").update(payload).eq("id", client.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("clients").insert(payload).select("id").single();
        if (error) throw error;
        clientId = data.id;
      }

      if (form.client_type === "prospect" && clientId) {
        await supabase.from("founder_waitlist").upsert(
          { client_id: clientId, priority_score: 10, notes: form.notes || null },
          { onConflict: "client_id" },
        );
      }

      if (!client && sendWelcomeOpt && clientId && wa) {
        await supabase.from("whatsapp_messages").insert({
          client_id: clientId,
          template_key: "welcome_onboard",
          body: `Welcome to COTERIE Nail Sanctuary, ${form.full_name}. You're now in our circle. Book your next sanctuary session via WhatsApp or visit us at Shujaah Mall, Kilimani. — COTERIE`,
          status: "sent",
        });
      }
    },
    onSuccess: () => {
      toast.success(client ? "Client updated" : "Client added to The Registry");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Modal onClose={onClose} title={client ? "Edit Client" : "New Client"}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Full Name *" span={2}>
          <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input" />
        </Field>
        <Field label="Phone Number *">
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+254712345678 or 0712345678" className="input" />
        </Field>
        <Field label="WhatsApp Number">
          <div className="flex items-center gap-2">
            <input
              disabled={whatsappSame}
              value={whatsappSame ? form.phone : form.whatsapp_number}
              onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
              className="input flex-1 disabled:opacity-50"
            />
            <label className="text-[10px] uppercase tracking-[0.15em] flex items-center gap-1">
              <input type="checkbox" checked={whatsappSame} onChange={(e) => setWhatsappSame(e.target.checked)} /> Same
            </label>
          </div>
        </Field>
        <Field label="Email">
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
        </Field>
        <Field label="Birthday">
          <input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} className="input" />
        </Field>
        <Field label="Address / Location" span={2}>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. Yaya Towers, Kilimani" className="input" />
        </Field>
        <Field label="Client Type">
          <div className="flex gap-2">
            {(["regular", "prospect"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setForm({ ...form, client_type: t })}
                className={`flex-1 text-xs uppercase tracking-[0.2em] px-3 py-2 rounded-md border ${form.client_type === t ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                {t === "regular" ? "Regular" : "Founder Prospect"}
              </button>
            ))}
          </div>
        </Field>
        <Field label="How did they hear about us?">
          <select value={form.referral_source} onChange={(e) => setForm({ ...form, referral_source: e.target.value, referrer_id: "" })} className="input">
            <option value="">—</option>
            {REFERRAL_SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        {form.referral_source === "Referral" && (
          <Field label="Referred by" span={2}>
            <input value={referrerQ} onChange={(e) => setReferrerQ(e.target.value)} placeholder="Search existing client…" className="input" />
            {referrers && referrers.length > 0 && (
              <div className="mt-1 border border-border rounded-md divide-y divide-border bg-card">
                {referrers.map((r: any) => (
                  <button key={r.id} type="button" onClick={() => { setForm({ ...form, referrer_id: r.id }); setReferrerQ(r.full_name); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-muted ${form.referrer_id === r.id ? "bg-primary/10" : ""}`}>
                    {r.full_name} · {r.phone}
                  </button>
                ))}
              </div>
            )}
          </Field>
        )}
        <Field label="First Visit Date">
          <input type="date" value={form.first_visit_date} onChange={(e) => setForm({ ...form, first_visit_date: e.target.value })} className="input" />
        </Field>
        <Field label="Photo URL">
          <input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://…" className="input" />
        </Field>
        <Field label="Notes / Preferences (allergies, polish, nail shape…)" span={2}>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="input" />
        </Field>
        {!client && (
          <Field label="" span={2}>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={sendWelcomeOpt} onChange={(e) => setSendWelcomeOpt(e.target.checked)} />
              Send WhatsApp welcome message after saving
            </label>
          </Field>
        )}
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onClose} className="text-xs uppercase tracking-[0.2em] px-4 py-2.5 border border-border rounded-md">Cancel</button>
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="text-xs uppercase tracking-[0.2em] px-4 py-2.5 bg-primary text-primary-foreground rounded-md flex items-center gap-2">
          {save.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          {client ? "Save Changes" : "Add to Registry"}
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- Bulk Import ---------------- */

type ParsedRow = {
  full_name: string;
  phone: string;
  whatsapp: string;
  email: string;
  birthday: string;
  address: string;
  client_type: string;
  referrer_name: string;
  notes: string;
  first_visit_date: string;
  __valid: boolean;
  __duplicate: boolean;
  __errors: string[];
};

const TEMPLATE_HEADERS = [
  "Full Name", "Phone", "WhatsApp", "Email", "Birthday",
  "Address", "Client Type", "Referrer Name", "Notes", "First Visit Date",
];

function BulkImport({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [dupMode, setDupMode] = useState<"skip" | "update">("skip");
  const [result, setResult] = useState<{ added: number; updated: number; skipped: number; errors: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const csv = TEMPLATE_HEADERS.join(",") + "\n" +
      "Sofia Mwangi,+254712345678,+254712345678,sofia@example.com,1992-03-15,Yaya Centre,regular,,Loves nude polish,2024-01-10\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "coterie-clients-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const parseFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) { toast.error("Empty file"); return; }
    const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

    const idx = (n: string) => headers.indexOf(n.toLowerCase());
    const cols = {
      name: idx("full name"),
      phone: idx("phone"),
      wa: idx("whatsapp"),
      email: idx("email"),
      bday: idx("birthday"),
      addr: idx("address"),
      type: idx("client type"),
      ref: idx("referrer name"),
      notes: idx("notes"),
      first: idx("first visit date"),
    };

    if (cols.name < 0 || cols.phone < 0) {
      toast.error("CSV must include 'Full Name' and 'Phone' columns");
      return;
    }

    // Fetch existing phone numbers for dup check
    const { data: existingClients } = await supabase.from("clients").select("phone");
    const existingPhones = new Set((existingClients ?? []).map((c: any) => c.phone).filter(Boolean));
    setExisting(existingPhones);

    const parsed: ParsedRow[] = lines.slice(1).map((ln) => {
      const c = parseCsvLine(ln);
      const errors: string[] = [];
      const name = (c[cols.name] || "").trim();
      const phoneRaw = (c[cols.phone] || "").trim();
      const phone = normalizeKePhone(phoneRaw);
      if (!name) errors.push("Missing name");
      if (!phone) errors.push("Invalid phone");
      const dup = phone ? existingPhones.has(phone) : false;
      return {
        full_name: name,
        phone: phone ?? phoneRaw,
        whatsapp: (c[cols.wa] || "").trim(),
        email: (c[cols.email] || "").trim(),
        birthday: (c[cols.bday] || "").trim(),
        address: (c[cols.addr] || "").trim(),
        client_type: ((c[cols.type] || "regular").trim().toLowerCase()),
        referrer_name: (c[cols.ref] || "").trim(),
        notes: (c[cols.notes] || "").trim(),
        first_visit_date: (c[cols.first] || "").trim(),
        __valid: errors.length === 0,
        __duplicate: dup,
        __errors: errors,
      };
    });

    setRows(parsed);
    setResult(null);
  };

  const valid = rows.filter((r) => r.__valid && !r.__duplicate);
  const dups = rows.filter((r) => r.__duplicate);
  const errs = rows.filter((r) => !r.__valid);

  const runImport = async () => {
    setImporting(true);
    try {
      const payload = valid.map((r) => ({
        full_name: r.full_name,
        phone: r.phone,
        whatsapp_number: r.whatsapp ? normalizeKePhone(r.whatsapp) : r.phone,
        email: r.email || null,
        birthday: r.birthday || null,
        address: r.address || null,
        client_type: (r.client_type === "founder" || r.client_type === "prospect" ? r.client_type : "regular") as "regular" | "prospect" | "founder",
        notes: r.notes || null,
        first_visit_date: r.first_visit_date || null,
      }));
      const { data, error } = await supabase.from("clients").insert(payload).select("id, client_type");
      if (error) throw error;

      // Add prospects to waitlist
      const prospects = (data ?? []).filter((d: any) => d.client_type === "prospect");
      if (prospects.length) {
        await supabase.from("founder_waitlist").insert(
          prospects.map((p: any) => ({ client_id: p.id, priority_score: 10 })),
        );
      }

      setResult({ added: valid.length, skipped: dups.length, errors: errs.length });
      toast.success(`Imported ${valid.length} clients.`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-display text-xl">Import Existing Clientele</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a CSV with: {TEMPLATE_HEADERS.join(" · ")}
            </p>
          </div>
          <button onClick={downloadTemplate}
            className="text-xs uppercase tracking-[0.2em] px-4 py-2.5 border border-border rounded-md hover:bg-muted flex items-center gap-2">
            <Download className="h-3.5 w-3.5" /> Download Empty Template
          </button>
        </div>

        <div className="mt-6 border-2 border-dashed border-border rounded-lg p-8 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseFile(f); }}>
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm">Drag & drop CSV here, or</p>
          <button onClick={() => inputRef.current?.click()}
            className="mt-2 text-xs uppercase tracking-[0.2em] px-4 py-2 bg-primary text-primary-foreground rounded-md">
            Select file
          </button>
          <input ref={inputRef} type="file" accept=".csv" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
          {fileName && <p className="text-xs text-muted-foreground mt-3">{fileName}</p>}
        </div>
      </div>

      {rows.length > 0 && !result && (
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Stat icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Valid" value={valid.length} />
            <Stat icon={<AlertTriangle className="h-4 w-4 text-amber-600" />} label="Duplicates" value={dups.length} />
            <Stat icon={<X className="h-4 w-4 text-destructive" />} label="Errors" value={errs.length} />
          </div>

          <div className="max-h-96 overflow-auto border border-border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr><th className="text-left p-2">Name</th><th className="text-left p-2">Phone</th><th className="text-left p-2">Type</th><th className="text-left p-2">Status</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className={`border-t border-border ${!r.__valid ? "bg-destructive/5" : r.__duplicate ? "bg-amber-500/5" : ""}`}>
                    <td className="p-2">{r.full_name || <em className="text-muted-foreground">missing</em>}</td>
                    <td className="p-2 font-mono">{r.phone}</td>
                    <td className="p-2">{r.client_type}</td>
                    <td className="p-2">
                      {!r.__valid ? r.__errors.join(", ") : r.__duplicate ? "Duplicate phone — skip" : "Ready"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && <p className="text-center text-xs text-muted-foreground p-2">+{rows.length - 50} more rows</p>}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setRows([]); setFileName(""); }}
              className="text-xs uppercase tracking-[0.2em] px-4 py-2.5 border border-border rounded-md">Cancel</button>
            <button onClick={runImport} disabled={importing || valid.length === 0}
              className="text-xs uppercase tracking-[0.2em] px-4 py-2.5 bg-primary text-primary-foreground rounded-md flex items-center gap-2 disabled:opacity-50">
              {importing && <Loader2 className="h-3 w-3 animate-spin" />}
              Confirm Import ({valid.length})
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
          <h3 className="font-display text-xl">Import complete</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {result.added} added · {result.skipped} duplicates skipped · {result.errors} errors
          </p>
          <button onClick={onDone}
            className="mt-4 text-xs uppercase tracking-[0.2em] px-4 py-2.5 bg-primary text-primary-foreground rounded-md">
            View Registry
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- History Backfill ---------------- */

function HistoryModal({ client, onClose }: { client: ClientRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    appointment_type: "full_manicure",
    scheduled_date: new Date().toISOString().slice(0, 10),
    scheduled_time: "10:00",
    duration_minutes: 60,
    notes: "",
  });

  const { data: past } = useQuery({
    queryKey: ["client-history", client.id],
    queryFn: async () => {
      const { data } = await supabase.from("appointments")
        .select("id, appointment_type, scheduled_date, scheduled_time, status, notes")
        .eq("client_id", client.id)
        .order("scheduled_date", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("appointments").insert({
        client_id: client.id,
        appointment_type: form.appointment_type as any,
        scheduled_date: form.scheduled_date,
        scheduled_time: form.scheduled_time,
        duration_minutes: form.duration_minutes,
        status: "completed" as any,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Past appointment added");
      qc.invalidateQueries({ queryKey: ["client-history", client.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Modal onClose={onClose} title={`History · ${client.full_name}`}>
      <div className="space-y-4">
        <div className="bg-muted/30 border border-border rounded-md p-4">
          <p className="text-xs text-muted-foreground mb-3">
            <Calendar className="h-3 w-3 inline mr-1" />
            Backdate completed appointments. Required for accurate Gel Rescue eligibility (7-day window).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Service">
              <select className="input" value={form.appointment_type} onChange={(e) => setForm({ ...form, appointment_type: e.target.value })}>
                <option value="weekly_refresh">Weekly Refresh</option>
                <option value="full_manicure">Full Manicure</option>
                <option value="gel_rescue">Gel Rescue</option>
                <option value="travel_touchup">Travel Touch-Up</option>
                <option value="surprise">Surprise / Birthday</option>
              </select>
            </Field>
            <Field label="Duration (min)">
              <input type="number" className="input" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 60 })} />
            </Field>
            <Field label="Date">
              <input type="date" className="input" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
            </Field>
            <Field label="Time">
              <input type="time" className="input" value={form.scheduled_time} onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })} />
            </Field>
            <Field label="Notes" span={2}>
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end mt-3">
            <button onClick={() => add.mutate()} disabled={add.isPending}
              className="text-xs uppercase tracking-[0.2em] px-4 py-2 bg-primary text-primary-foreground rounded-md flex items-center gap-2">
              {add.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Add Past Appointment
            </button>
          </div>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Recent History</h4>
          {past && past.length > 0 ? (
            <ul className="border border-border rounded-md divide-y divide-border">
              {past.map((a: any) => (
                <li key={a.id} className="p-3 text-sm flex justify-between">
                  <span>{a.scheduled_date} · {a.appointment_type}</span>
                  <span className="text-muted-foreground text-xs">{a.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No appointments yet.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Primitives ---------------- */

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-background border border-border rounded-lg max-w-3xl w-full my-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-display text-xl">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: 1 | 2 }) {
  return (
    <label className={`block ${span === 2 ? "md:col-span-2" : ""}`}>
      {label && <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block mb-1.5">{label}</span>}
      {children}
    </label>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 bg-muted/40 rounded-md p-3">
      {icon}
      <div>
        <div className="text-xl font-display">{value}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { result.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  result.push(cur);
  return result;
}
