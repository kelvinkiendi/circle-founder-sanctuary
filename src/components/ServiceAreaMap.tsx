import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

type LatLng = { lat: number; lng: number };

interface Props {
  corePolygon: LatLng[];
  extendedPolygon: LatLng[];
  onChange: (next: { core: LatLng[]; extended: LatLng[] }) => void;
}

// Shujaah Mall, Kilimani, Nairobi
const KILIMANI: LatLng = { lat: -1.2921, lng: 36.7833 };

declare global {
  interface Window {
    google: any;
    __initCoterieMap?: () => void;
  }
}

export function ServiceAreaMap({ corePolygon, extendedPolygon, onChange }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const coreRef = useRef<any>(null);
  const extRef = useRef<any>(null);
  const [drawing, setDrawing] = useState<"core" | "extended" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

  // Load Google Maps script
  useEffect(() => {
    if (!key) {
      setError("Google Maps not connected. Connect via the Maps connector to draw zones.");
      return;
    }
    if (window.google?.maps) {
      setLoaded(true);
      return;
    }
    window.__initCoterieMap = () => setLoaded(true);
    const existing = document.getElementById("gmaps-script") as HTMLScriptElement | null;
    if (existing) return;
    const s = document.createElement("script");
    s.id = "gmaps-script";
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initCoterieMap${channel ? `&channel=${channel}` : ""}`;
    s.onerror = () => setError("Failed to load Google Maps");
    document.head.appendChild(s);
  }, [key, channel]);

  // Init map
  useEffect(() => {
    if (!loaded || !mapEl.current || mapRef.current) return;
    const g = window.google.maps;
    mapRef.current = new g.Map(mapEl.current, {
      center: KILIMANI,
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    coreRef.current = new g.Polygon({
      paths: corePolygon,
      strokeColor: "#5D4037",
      strokeWeight: 2,
      fillColor: "#5D4037",
      fillOpacity: 0.25,
      editable: true,
      map: mapRef.current,
    });
    extRef.current = new g.Polygon({
      paths: extendedPolygon,
      strokeColor: "#C9A84C",
      strokeWeight: 2,
      fillColor: "#C9A84C",
      fillOpacity: 0.18,
      editable: true,
      map: mapRef.current,
    });

    const wirePath = (poly: any, kind: "core" | "extended") => {
      const path = poly.getPath();
      const emit = () => {
        const pts: LatLng[] = [];
        path.forEach((p: any) => pts.push({ lat: p.lat(), lng: p.lng() }));
        onChange(
          kind === "core"
            ? { core: pts, extended: extractPath(extRef.current) }
            : { core: extractPath(coreRef.current), extended: pts },
        );
      };
      g.event.addListener(path, "set_at", emit);
      g.event.addListener(path, "insert_at", emit);
      g.event.addListener(path, "remove_at", emit);
    };
    wirePath(coreRef.current, "core");
    wirePath(extRef.current, "extended");

    // Click-to-add points when drawing
    mapRef.current.addListener("click", (e: any) => {
      if (!drawingRef.current) return;
      const target = drawingRef.current === "core" ? coreRef.current : extRef.current;
      target.getPath().push(e.latLng);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // Track current drawing mode in a ref for the click listener
  const drawingRef = useRef<"core" | "extended" | null>(null);
  useEffect(() => { drawingRef.current = drawing; }, [drawing]);

  const extractPath = (poly: any): LatLng[] => {
    if (!poly) return [];
    const out: LatLng[] = [];
    poly.getPath().forEach((p: any) => out.push({ lat: p.lat(), lng: p.lng() }));
    return out;
  };

  const clear = (kind: "core" | "extended") => {
    const ref = kind === "core" ? coreRef.current : extRef.current;
    if (!ref) return;
    ref.setPath([]);
    onChange({ core: extractPath(coreRef.current), extended: extractPath(extRef.current) });
  };

  if (error) {
    return (
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-center text-xs text-muted-foreground space-y-2">
        <MapPin className="h-6 w-6 mx-auto opacity-50" />
        <p>{error}</p>
        <p className="text-[10px] opacity-70">Zones defined as text labels above will still apply.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => setDrawing(drawing === "core" ? null : "core")}
          className={`px-3 py-1.5 rounded border transition ${drawing === "core" ? "bg-[#5D4037] text-white border-[#5D4037]" : "bg-card hover:bg-muted"}`}
        >
          {drawing === "core" ? "Click map to add ✓" : "Draw Core Zone"}
        </button>
        <button
          type="button"
          onClick={() => setDrawing(drawing === "extended" ? null : "extended")}
          className={`px-3 py-1.5 rounded border transition ${drawing === "extended" ? "bg-[#C9A84C] text-white border-[#C9A84C]" : "bg-card hover:bg-muted"}`}
        >
          {drawing === "extended" ? "Click map to add ✓" : "Draw Extended Zone"}
        </button>
        <button type="button" onClick={() => clear("core")} className="px-3 py-1.5 rounded border bg-card hover:bg-muted">
          Clear Core
        </button>
        <button type="button" onClick={() => clear("extended")} className="px-3 py-1.5 rounded border bg-card hover:bg-muted">
          Clear Extended
        </button>
      </div>
      <div ref={mapEl} className="w-full h-[360px] rounded-lg border bg-muted" />
      <p className="text-[10px] text-muted-foreground">
        Tip: drag existing vertices to refine. Click "Draw" then tap the map to add points. Brown = core (free) · Gold = extended (transport charge).
      </p>
    </div>
  );
}
