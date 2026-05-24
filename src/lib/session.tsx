import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { getSessionFn, logoutFn } from "./auth.functions";
import { INACTIVITY_MINUTES, type StaffRole } from "./permissions";

export type StaffSession = {
  sessionId: string;
  staffId: string;
  fullName: string;
  role: StaffRole;
  mustChangePin: boolean;
  lastLoginAt: string | null;
};

const KEY = "coterie_session_v1";

type Ctx = {
  session: StaffSession | null;
  loading: boolean;
  setSession: (s: StaffSession | null) => void;
  logout: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

function read(): StaffSession | null {
  if (typeof window === "undefined") return null;
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<StaffSession | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const lastActive = useRef(Date.now());

  const setSession = useCallback((s: StaffSession | null) => {
    setSessionState(s);
    if (typeof window !== "undefined") {
      if (s) localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    }
  }, []);

  const logout = useCallback(async () => {
    const cur = read();
    if (cur) { try { await logoutFn({ data: { sessionId: cur.sessionId } }); } catch {} }
    setSession(null);
    router.navigate({ to: "/" });
  }, [router, setSession]);

  // Hydrate after mount (avoid SSR mismatch)
  useEffect(() => {
    const stored = read();
    if (!stored) { setLoading(false); return; }
    getSessionFn({ data: { sessionId: stored.sessionId } })
      .then((r) => {
        if (r.ok) setSession({ ...stored, ...r, role: r.role as StaffRole });
        else setSession(null);
      })
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, [setSession]);

  // Inactivity timer
  useEffect(() => {
    if (!session) return;
    const bump = () => { lastActive.current = Date.now(); };
    const events = ["mousemove","keydown","touchstart","click"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const limitMs = INACTIVITY_MINUTES[session.role] * 60_000;
    const t = window.setInterval(() => {
      if (Date.now() - lastActive.current > limitMs) {
        logout();
      }
    }, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(t);
    };
  }, [session, logout]);

  const value = useMemo(() => ({ session, loading, setSession, logout }), [session, loading, setSession, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside provider");
  return ctx;
}

export function RequireRole({ roles, children }: { roles: StaffRole[]; children: React.ReactNode }) {
  const { session, loading } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!session) { router.navigate({ to: "/" }); return; }
    if (!roles.includes(session.role)) { router.navigate({ to: "/" }); return; }
    if (session.mustChangePin) { router.navigate({ to: "/change-pin" }); }
  }, [session, loading, roles, router]);
  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }
  if (!roles.includes(session.role) || session.mustChangePin) return null;
  return <>{children}</>;
}
