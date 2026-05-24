import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { loginWithPin } from "@/lib/auth.functions";
import { useSession } from "@/lib/session";
import { PORTAL_PATH, type StaffRole } from "@/lib/permissions";

export const Route = createFileRoute("/")({
  component: LoginPage,
  ssr: false,
});

function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { session, setSession, loading } = useSession();

  useEffect(() => { setMounted(true); }, []);

  // If already logged in, bounce to portal
  useEffect(() => {
    if (loading || !session) return;
    if (session.mustChangePin) router.navigate({ to: "/change-pin" });
    else router.navigate({ to: PORTAL_PATH[session.role] as any });
  }, [session, loading, router]);

  useEffect(() => {
    if (pin.length !== 4 || busy) return;
    const submit = async () => {
      setBusy(true); setError(null);
      try {
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : undefined;
        const res = await loginWithPin({ data: { pin, userAgent: ua, device: deviceLabel() } });
        if (!res.ok) {
          setShake(true); setError("Invalid PIN"); setPin("");
          setTimeout(() => setShake(false), 500);
        } else {
          const role = res.role as StaffRole;
          setSession({
            sessionId: res.sessionId, staffId: res.staffId,
            fullName: res.fullName, role,
            mustChangePin: res.mustChangePin, lastLoginAt: res.lastLoginAt,
          });
          setWelcome(`Welcome, ${res.fullName.split(" ")[0]}`);
          setTimeout(() => {
            if (res.mustChangePin) router.navigate({ to: "/change-pin" });
            else router.navigate({ to: PORTAL_PATH[role] as any });
          }, 700);
        }
      } catch (e: any) {
        setError(e?.message ?? "Login failed");
        setShake(true); setPin("");
        setTimeout(() => setShake(false), 500);
      } finally { setBusy(false); }
    };
    submit();
  }, [pin, busy, setSession, router]);

  const press = (d: string) => { if (pin.length < 4 && !welcome) setPin((p) => p + d); };
  const back = () => setPin((p) => p.slice(0, -1));
  const clear = () => setPin("");

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-10" style={{ background: "#5D4037", color: "#F5F5DC" }}>
      <div className={`w-full max-w-sm transition-opacity duration-700 ${mounted ? "opacity-100" : "opacity-0"}`}>
        <div className="text-center mb-10">
          <div className="font-display text-5xl tracking-[0.35em]" style={{ color: "#F5F5DC" }}>COTERIE</div>
          <div className="mt-3 text-[10px] tracking-[0.5em]" style={{ color: "#F5F5DC", opacity: 0.65 }}>NAIL SANCTUARY</div>
          <h1 className="mt-8 font-display text-3xl tracking-[0.25em]" style={{ color: "#F5F5DC" }}>THE CIRCLE</h1>
          <p className="mt-3 text-xs tracking-[0.2em] uppercase" style={{ color: "#F5F5DC", opacity: 0.7 }}>POS System</p>
        </div>

        <div className="text-center text-xs tracking-[0.25em] uppercase mb-4" style={{ color: "#F5F5DC", opacity: 0.75 }}>
          Enter your 4-digit access code
        </div>

        <div className={`flex justify-center gap-4 mb-2 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}>
          {[0,1,2,3].map((i) => (
            <div key={i} className="w-4 h-4 rounded-full border" style={{
              borderColor: "#F5F5DC",
              background: pin.length > i ? "#F5F5DC" : "transparent",
            }} />
          ))}
        </div>

        <div className="h-5 text-center text-xs mt-2 mb-4" style={{ color: welcome ? "#F5F5DC" : "#f8a8a8" }}>
          {welcome ?? error ?? ""}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <PadButton key={d} onClick={() => press(d)} disabled={busy || !!welcome}>{d}</PadButton>
          ))}
          <PadButton onClick={clear} disabled={busy || !!welcome} small>Clear</PadButton>
          <PadButton onClick={() => press("0")} disabled={busy || !!welcome}>0</PadButton>
          <PadButton onClick={back} disabled={busy || !!welcome} small><Delete className="h-5 w-5 mx-auto" /></PadButton>
        </div>

        <p className="text-center text-[10px] tracking-[0.3em] uppercase mt-10" style={{ color: "#F5F5DC", opacity: 0.45 }}>
          The Circle · Staff Only
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          50% { transform: translateX(8px); }
          75% { transform: translateX(-4px); }
        }
      `}</style>
    </div>
  );
}

function PadButton({ children, onClick, disabled, small }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; small?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className="aspect-square rounded-full font-display text-2xl transition-all active:scale-95 disabled:opacity-40"
      style={{
        background: "rgba(245,245,220,0.08)",
        color: "#F5F5DC",
        border: "1px solid rgba(245,245,220,0.25)",
        fontSize: small ? "0.75rem" : undefined,
        letterSpacing: small ? "0.2em" : undefined,
        textTransform: small ? "uppercase" : "none",
      }}
    >
      {children}
    </button>
  );
}

function deviceLabel(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  return "Desktop";
}
