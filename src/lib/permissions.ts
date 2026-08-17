export type StaffRole = "admin" | "manager" | "technician" | "reception" | "guardian" | "partner";

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "The Sanctuary",
  manager: "The Steward",
  technician: "The Artisan",
  reception: "The Concierge",
  guardian: "The Guardian",
  partner: "The Partner",
};

// Only 3 portals remain; admin/manager land at the concierge desk by default.
export const PORTAL_PATH: Record<StaffRole, string> = {
  admin: "/concierge/desk",
  manager: "/concierge/desk",
  technician: "/artisan/today",
  reception: "/concierge/desk",
  guardian: "/guardian/view",
  partner: "/guardian/view",
};

export const INACTIVITY_MINUTES: Record<StaffRole, number> = {
  admin: 60, manager: 30, technician: 15, reception: 30, guardian: 30, partner: 30,
};

export const ONBOARDING_TIP: Record<StaffRole, string> = {
  admin: "Welcome to The Sanctuary. You have full control over The Circle.",
  manager: "Welcome, Steward. You manage operations but cannot change system settings.",
  technician: "Welcome, Artisan. Tap an appointment to begin. Swipe right to check in.",
  reception: "Welcome, Concierge. Search clients to book or check them in.",
  guardian: "Welcome, Guardian. All data is view-only. Use the Export Center for reports.",
  partner: "Welcome, Partner. You have view-only access to reports and audits.",
};

export type NavKey = "checkin" | "payments" | "reports" | "tech";

export const NAV_BY_ROLE: Record<StaffRole, NavKey[]> = {
  admin: ["checkin", "payments", "reports", "tech"],
  manager: ["checkin", "reports"],
  technician: ["tech"],
  reception: ["checkin", "payments"],
  guardian: ["reports"],
  partner: ["reports"],
};

/** Roles allowed to take payments. Technicians never bill clients. */
export const CAN_BILL: StaffRole[] = ["reception", "admin", "manager"];


export const CAN = {
  awardJustBecause: (r: StaffRole) => r === "admin",
  awardSurprise: (r: StaffRole) => r === "admin" || r === "manager",
  approveGelRescue: (r: StaffRole) => r === "admin" || r === "manager",
  enrollFounder: (r: StaffRole) => r === "admin",
  refund: (r: StaffRole) => r === "admin",
  export: (r: StaffRole) => r === "admin" || r === "guardian" || r === "partner",
  changeSettings: (r: StaffRole) => r === "admin",
  rescheduleAppt: (r: StaffRole) => r === "admin" || r === "manager",
  switchPortal: (r: StaffRole) => r === "admin",
};

// Derive the booking source from appointments.created_by tag.
// Tags: "tech:<id>" | "reception:<id>" | "admin:<id>" | "client:<id>" | null
export type ApptSource = "technician" | "reception" | "admin" | "client" | "walk-in";

export function apptSource(createdBy: string | null | undefined): ApptSource {
  if (!createdBy) return "walk-in";
  const prefix = createdBy.split(":")[0];
  if (prefix === "tech") return "technician";
  if (prefix === "reception") return "reception";
  if (prefix === "admin") return "admin";
  if (prefix === "client") return "client";
  return "walk-in";
}

export const APPT_SOURCE_LABEL: Record<ApptSource, string> = {
  technician: "Technician Self-Booked",
  reception: "Reception Booked",
  admin: "Admin Booked",
  client: "Client Booked",
  "walk-in": "Walk-in",
};

export const APPT_SOURCE_CLASS: Record<ApptSource, string> = {
  technician: "bg-gold/15 text-gold border-gold/30",
  reception: "bg-muted text-muted-foreground border-border",
  admin: "bg-primary/10 text-primary border-primary/30",
  client: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  "walk-in": "bg-secondary text-secondary-foreground border-border",
};
