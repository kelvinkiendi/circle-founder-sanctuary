import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { changePinFn } from "@/lib/auth.functions";
import { useSession } from "@/lib/session";
import { PORTAL_PATH } from "@/lib/permissions";

export const Route = createFileRoute("/change-pin")({
  component: ChangePinPage,
  ssr: false,
});

function ChangePinPage() {
  const { session, setSession } = useSession();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session) {
    if (typeof window !== "undefined") router.navigate({ to: "/" });
    return null;
  }

  const submit = async () => {
    setErr(null);
    if (!/^\d{4}$/.test(pin)) return setErr("PIN must be 4 digits");
    if (pin !== confirm) return setErr("PINs do not match");
    if (pin === "0000") return setErr("Choose a PIN other than the default");
    setBusy(true);
    try {
      const r = await changePinFn({ data: { sessionId: session.sessionId, newPin: pin } });
      if (!r.ok) { setErr("Could not update PIN"); return; }
      setSession({ ...session, mustChangePin: false });
      router.navigate({ to: PORTAL_PATH[session.role] as any });
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#5D4037", color: "#F5F5DC" }}>
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl tracking-[0.2em] text-center mb-2">SET YOUR PIN</h1>
        <p className="text-center text-xs tracking-[0.2em] uppercase opacity-70 mb-8">
          Welcome, {session.fullName}. Please choose a new 4-digit code.
        </p>
        <label className="block text-xs tracking-[0.2em] uppercase opacity-70 mb-2">New PIN</label>
        <input type="password" inputMode="numeric" maxLength={4} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="w-full p-3 rounded text-center text-2xl tracking-[0.5em] bg-white/10 border border-white/30 mb-4"
          style={{ color: "#F5F5DC" }}
        />
        <label className="block text-xs tracking-[0.2em] uppercase opacity-70 mb-2">Confirm PIN</label>
        <input type="password" inputMode="numeric" maxLength={4} value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
          className="w-full p-3 rounded text-center text-2xl tracking-[0.5em] bg-white/10 border border-white/30 mb-4"
          style={{ color: "#F5F5DC" }}
        />
        {err && <div className="text-center text-sm mb-3" style={{ color: "#f8a8a8" }}>{err}</div>}
        <button onClick={submit} disabled={busy}
          className="w-full py-3 rounded font-display tracking-[0.3em] uppercase text-sm disabled:opacity-50"
          style={{ background: "#F5F5DC", color: "#5D4037" }}>
          {busy ? "Saving…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
