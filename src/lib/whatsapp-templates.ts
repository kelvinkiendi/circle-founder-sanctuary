export type TemplateKey =
  | "founder_welcome"
  | "weekly_refresh_reminder"
  | "priority_window"
  | "gel_rescue_decision"
  | "surprise_full"
  | "birthday_invite"
  | "travel_confirmation"
  | "no_show_forfeit"
  | "term_expiry"
  | "just_because"
  | "emergency_response"
  | "installment_reminder"
  | "appointment_confirmation"
  | "appointment_cancellation"
  | "payment_confirmation"
  | "tech_reminder"
  | "new_client_welcome"
  | "service_followup_24h";

export interface TemplateMeta {
  key: TemplateKey;
  label: string;
  description: string;
  variables: string[];
  render: (vars: Record<string, string>) => string;
}

const v = (vars: Record<string, string>, k: string, fallback = "—") => vars[k] ?? fallback;

export const WHATSAPP_TEMPLATES: TemplateMeta[] = [
  {
    key: "founder_welcome",
    label: "1 · Founder Welcome",
    description: "Sent on enrollment.",
    variables: ["name", "number", "start_date", "end_date"],
    render: (x) =>
      `Welcome to The Circle, ${v(x, "name")}. You are Founder #${v(x, "number")} of COTERIE Nail Sanctuary. Your 6-month sanctuary begins ${v(x, "start_date")} and ends ${v(x, "end_date")}. Your perks are now active: Weekly Refresh, Gel Rescue, Travel Touch-Up, Priority Booking, Birthday Sanctuary, and more. Book via this chat. — COTERIE`,
  },
  {
    key: "weekly_refresh_reminder",
    label: "2 · Weekly Refresh Reminder",
    description: "Monday 9 AM.",
    variables: ["name"],
    render: (x) =>
      `Good morning ${v(x, "name")}. Your Weekly Refresh is available this week. Reply with your preferred day/time or 'SKIP' to forfeit. Book same-day or 24hrs in advance. — COTERIE`,
  },
  {
    key: "priority_window",
    label: "3 · Priority Window Alert",
    description: "Founder-exclusive 48hr window.",
    variables: ["date_range"],
    render: (x) =>
      `Founder Exclusive: New appointment slots for ${v(x, "date_range")} are now available to Circle members only. Public release in 48 hours. Reply with your preferred slot to claim. — COTERIE`,
  },
  {
    key: "gel_rescue_decision",
    label: "4 · Gel Rescue Approval/Rejection",
    description: "Approved or rejected outcome.",
    variables: ["name", "decision", "link"],
    render: (x) => {
      const approved = v(x, "decision", "approved").toLowerCase().startsWith("appro");
      const tail = approved
        ? "Visit us at your earliest convenience."
        : `This requires a full re-service at your Founder Rate (15% off). Book here: ${v(x, "link", "—")}`;
      return `${v(x, "name")}, your Gel Rescue request has been ${approved ? "APPROVED" : "REJECTED"}. ${tail} — COTERIE`;
    },
  },
  {
    key: "surprise_full",
    label: "5 · Surprise Full Manicure",
    description: "Morning-of upgrade.",
    variables: ["name", "time"],
    render: (x) =>
      `Your Refresh today is becoming a full Sanctuary Session. See you at ${v(x, "time")}, ${v(x, "name")}. — COTERIE ✨`,
  },
  {
    key: "birthday_invite",
    label: "6 · Birthday Sanctuary Invite",
    description: "7 days before birthday week.",
    variables: ["start_date", "end_date"],
    render: (x) =>
      `Your Birthday Sanctuary week is approaching (${v(x, "start_date")} - ${v(x, "end_date")}). Book your complimentary mani-pedi + gift bag. Reply CONFIRM to reserve your slot. — COTERIE 🎂`,
  },
  {
    key: "travel_confirmation",
    label: "7 · Travel Touch-Up Confirmation",
    description: "Send on booking.",
    variables: ["date", "address", "amount"],
    render: (x) =>
      `Travel Touch-Up confirmed for ${v(x, "date")} at ${v(x, "address")}. Duration: 10 minutes. Please ensure: safe workspace, good lighting, power outlet, and a suitable chair. Transport charge: ${v(x, "amount", "0")} KSH. — COTERIE`,
  },
  {
    key: "no_show_forfeit",
    label: "8 · No-Show Forfeiture",
    description: "Missed refresh.",
    variables: ["name", "date", "next_monday"],
    render: (x) =>
      `${v(x, "name")}, you missed your Weekly Refresh on ${v(x, "date")} without 24-hour notice. This week's Refresh has been forfeited. Your next Refresh is available ${v(x, "next_monday")}. — COTERIE`,
  },
  {
    key: "term_expiry",
    label: "9 · Term Expiry Warning",
    description: "30 / 7 / 1 day cadence.",
    variables: ["date", "perks_remaining"],
    render: (x) =>
      `Reminder: Your Founder Circle term expires on ${v(x, "date")}. You have ${v(x, "perks_remaining", "0")} perks remaining. Renew to maintain your Founder Rate (15% off for life). — COTERIE`,
  },
  {
    key: "just_because",
    label: "10 · Just Because Delivery",
    description: "Top-5 founder surprise.",
    variables: ["name", "date"],
    render: (x) =>
      `A surprise is on its way to you, ${v(x, "name")}. COTERIE cuticle oil, a handwritten note, and something special. Expect delivery by ${v(x, "date")}. — COTERIE 💌`,
  },
  {
    key: "emergency_response",
    label: "11 · Emergency Line Response",
    description: "Auto-ack within 2hr SLA.",
    variables: ["name"],
    render: (x) =>
      `We received your emergency request, ${v(x, "name")}. COTERIE is assessing and will respond within 2 hours. If severe allergic reaction or injury, please seek medical attention immediately. — COTERIE 🚨`,
  },
  {
    key: "installment_reminder",
    label: "12 · Installment Reminder",
    description: "2nd installment due.",
    variables: ["amount", "date", "paybill", "founder_number"],
    render: (x) =>
      `Reminder: Your 2nd Founder Circle installment of ${v(x, "amount")} KSH is due on ${v(x, "date")}. Pay via M-Pesa Paybill ${v(x, "paybill", "—")} Account: ${v(x, "founder_number", "—")}. — COTERIE`,
  },
  {
    key: "appointment_confirmation",
    label: "13 · Appointment Confirmation",
    description: "Sent when an appointment is booked.",
    variables: ["name", "service", "date", "time"],
    render: (x) =>
      `${v(x, "name")}, your ${v(x, "service")} is confirmed for ${v(x, "date")} at ${v(x, "time")}. See you at COTERIE Nail Sanctuary, Shujaah Mall, Kilimani. — COTERIE`,
  },
  {
    key: "appointment_cancellation",
    label: "14 · Appointment Cancellation",
    description: "Sent on cancellation.",
    variables: ["name", "service", "date", "time"],
    render: (x) =>
      `${v(x, "name")}, your ${v(x, "service")} on ${v(x, "date")} at ${v(x, "time")} has been cancelled. Reply to rebook. — COTERIE`,
  },
  {
    key: "payment_confirmation",
    label: "15 · Payment Confirmation",
    description: "Sent after successful M-Pesa payment.",
    variables: ["name", "amount", "receipt"],
    render: (x) =>
      `Thank you ${v(x, "name")}. We've received ${v(x, "amount")} KSH. M-Pesa receipt: ${v(x, "receipt")}. — COTERIE`,
  },
  {
    key: "tech_reminder",
    label: "16 · Artisan 1-Hour Reminder",
    description: "Sent to technician 1 hour before a self-booked appointment.",
    variables: ["service", "time", "client"],
    render: (x) =>
      `Reminder: ${v(x, "service")} with ${v(x, "client")} at ${v(x, "time")} (in 1 hour). — COTERIE`,
  },
  {
    key: "new_client_welcome",
    label: "17 · New Client Welcome",
    description: "Auto-sent on first registration.",
    variables: ["name", "date", "time"],
    render: (x) =>
      `Welcome to COTERIE Nail Sanctuary, ${v(x, "name")}! You're now part of our circle. Your first visit is booked for ${v(x, "date")} at ${v(x, "time")}. We can't wait to pamper you. — COTERIE 💅`,
  },
  {
    key: "service_followup_24h",
    label: "18 · Service Follow-Up (24h)",
    description: "Sent 24hrs after a service to check in.",
    variables: ["name", "service"],
    render: (x) =>
      `Hi ${v(x, "name")}, how are your nails feeling after yesterday's ${v(x, "service")}? If you need a Gel Rescue within 7 days, just WhatsApp us. — COTERIE`,
  },
];

export function getTemplate(key: TemplateKey) {
  return WHATSAPP_TEMPLATES.find((t) => t.key === key)!;
}

export function autoFillForFounder(founder: any): Record<string, string> {
  const c = founder?.clients ?? {};
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
  return {
    name: c.full_name?.split(" ")[0] ?? "Founder",
    number: String(founder?.founder_number ?? "—"),
    start_date: fmt(founder?.enrollment_date),
    end_date: fmt(founder?.term_end_date),
    date: fmt(new Date().toISOString().slice(0, 10)),
    address: c.address ?? "—",
    paybill: "247247",
    founder_number: String(founder?.founder_number ?? "—"),
  };
}
