import { useState } from "react";
import { WhatsAppSettings } from "./WhatsAppSettings";
import { MessageLogs } from "./MessageLogs";
import { TemplateManager } from "./TemplateManager";

const SECTIONS = [
  { id: "settings", label: "Connection" },
  { id: "logs", label: "Message logs" },
  { id: "templates", label: "Templates" },
] as const;

export function WhatsAppCenter() {
  const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>("settings");
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] uppercase tracking-widest border transition-colors ${
              section === s.id
                ? "border-gold text-gold bg-gold/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === "settings" && <WhatsAppSettings />}
      {section === "logs" && <MessageLogs />}
      {section === "templates" && <TemplateManager />}
    </div>
  );
}
