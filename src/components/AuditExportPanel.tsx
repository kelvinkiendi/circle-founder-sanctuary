import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Filter, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAuditFiltersFn, listAuditEventsFn } from "@/lib/audit.functions";
import { useSession } from "@/lib/session";

const ANY = "__any__";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(n: number) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }

function toCsv(rows: any[]) {
  const headers = ["When", "Action", "Entity", "Entity ID", "Actor", "Metadata"];
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r) => [
    new Date(r.created_at).toISOString(),
    r.action ?? "",
    r.entity ?? "",
    r.entity_id ?? "",
    r.actor ?? "",
    r.metadata ? JSON.stringify(r.metadata) : "",
  ].map(esc).join(","));
  return [headers.join(","), ...body].join("\n");
}

function downloadBlob(content: string | Blob, filename: string, type = "text/csv") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AuditExportPanel() {
  const { session } = useSession();
  const sessionId = session?.sessionId ?? "";

  const fetchFilters = useServerFn(getAuditFiltersFn);
  const fetchEvents = useServerFn(listAuditEventsFn);

  const [from, setFrom] = useState<string>(daysAgoISO(30));
  const [to, setTo] = useState<string>(todayISO());
  const [action, setAction] = useState<string>(ANY);
  const [entity, setEntity] = useState<string>(ANY);
  const [actor, setActor] = useState<string>(ANY);
  const [limit, setLimit] = useState<number>(500);

  const filterArgs = useMemo(() => ({
    sessionId,
    from,
    to,
    action: action === ANY ? undefined : action,
    entity: entity === ANY ? undefined : entity,
    actor: actor === ANY ? undefined : actor,
    limit,
  }), [sessionId, from, to, action, entity, actor, limit]);

  const filtersQ = useQuery({
    queryKey: ["audit-filters", sessionId],
    enabled: !!sessionId,
    queryFn: () => fetchFilters({ data: { sessionId } }),
  });

  const eventsQ = useQuery({
    queryKey: ["audit-events", filterArgs],
    enabled: !!sessionId,
    queryFn: () => fetchEvents({ data: filterArgs }),
  });

  const rows = eventsQ.data ?? [];

  function exportCsv() {
    if (!rows.length) { toast.error("Nothing to export"); return; }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadBlob(toCsv(rows), `audit-${from}_${to}_${stamp}.csv`);
    toast.success(`Exported ${rows.length} events as CSV`);
  }

  async function exportPdf() {
    if (!rows.length) { toast.error("Nothing to export"); return; }
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("COTERIE · Audit Report", 40, 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Range: ${from} → ${to}   ·   Filters: action=${action === ANY ? "any" : action}, entity=${entity === ANY ? "any" : entity}, actor=${actor === ANY ? "any" : actor}   ·   ${rows.length} events`,
      40, 52,
    );
    doc.text(`Generated ${new Date().toLocaleString()}`, w - 40, 36, { align: "right" });

    autoTable(doc, {
      startY: 70,
      head: [["When", "Action", "Entity", "Actor", "Detail"]],
      body: rows.map((r: any) => [
        new Date(r.created_at).toLocaleString(),
        r.action ?? "",
        r.entity ?? "",
        r.actor ?? "",
        r.metadata ? JSON.stringify(r.metadata).slice(0, 120) : (r.entity_id ?? ""),
      ]),
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [93, 64, 55], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 240, 235] },
      columnStyles: { 0: { cellWidth: 110 }, 4: { cellWidth: 280 } },
      margin: { left: 40, right: 40 },
    });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    doc.save(`audit-${from}_${to}_${stamp}.pdf`);
    toast.success(`Exported ${rows.length} events as PDF`);
  }

  return (
    <div className="space-y-6">
      <section className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-xl">Filters</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any action</SelectItem>
                {(filtersQ.data?.actions ?? []).map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Entity</Label>
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any entity</SelectItem>
                {(filtersQ.data?.entities ?? []).map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Actor / Staff</Label>
            <Select value={actor} onValueChange={setActor}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any actor</SelectItem>
                {(filtersQ.data?.actors ?? []).map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Row Limit</Label>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[100, 250, 500, 1000, 2000].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={() => eventsQ.refetch()} variant="outline" size="sm">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Button onClick={exportCsv} size="sm">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
          <Button onClick={exportPdf} size="sm" variant="secondary">
            <FileText className="h-3.5 w-3.5 mr-1.5" /> Export PDF
          </Button>
          <Badge variant="outline" className="ml-auto self-center">
            {eventsQ.isFetching ? "Loading…" : `${rows.length} events`}
          </Badge>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell className="capitalize">{r.action?.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{r.entity ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.actor ?? "system"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                    {r.metadata ? JSON.stringify(r.metadata) : r.entity_id ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && !eventsQ.isFetching && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground italic">No events match these filters.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
