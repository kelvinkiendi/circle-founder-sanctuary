export type StaffRole = "admin" | "manager" | "technician" | "reception" | "guardian";

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "The Sanctuary",
  manager: "The Steward",
  technician: "The Artisan",
  reception: "The Concierge",
  guardian: "The Guardian",
};

export const PORTAL_PATH: Record<StaffRole, string> = {
  admin: "/admin",
  manager: "/manager",
  technician: "/artisan/today",
  reception: "/concierge/desk",
  guardian: "/guardian/view",
};

export const INACTIVITY_MINUTES: Record<StaffRole, number> = {
  admin: 60,
  manager: 30,
  technician: 15,
  reception: 30,
  guardian: 30,
};

export const ONBOARDING_TIP: Record<StaffRole, string> = {
  admin: "Welcome to The Sanctuary. You have full control over The Circle.",
  manager: "Welcome, Steward. You manage operations but cannot change system settings.",
  technician: "Welcome, Artisan. Tap an appointment to begin. Swipe right to check in.",
  reception: "Welcome, Concierge. Search clients to book or check them in.",
  guardian: "Welcome, Guardian. All data is view-only. Use the Export Center for reports.",
};

export type NavKey =
  | "dashboard" | "clients" | "founders" | "appointments" | "perks"
  | "surprises" | "products" | "brunch" | "payments" | "tech"
  | "whatsapp" | "settings" | "reports" | "checkin" | "exports";

export const NAV_BY_ROLE: Record<StaffRole, NavKey[]> = {
  admin: ["dashboard","clients","founders","appointments","perks","surprises","products","brunch","payments","tech","whatsapp","settings"],
  manager: ["dashboard","clients","founders","appointments","perks","surprises","products","brunch","payments","whatsapp"],
  technician: ["tech"],
  reception: ["clients","appointments","payments","whatsapp"],
  guardian: ["dashboard","payments","appointments","founders","products"],
};

export const CAN = {
  awardJustBecause: (r: StaffRole) => r === "admin",
  awardSurprise: (r: StaffRole) => r === "admin" || r === "manager",
  approveGelRescue: (r: StaffRole) => r === "admin" || r === "manager",
  enrollFounder: (r: StaffRole) => r === "admin",
  refund: (r: StaffRole) => r === "admin",
  export: (r: StaffRole) => r === "admin" || r === "guardian",
  changeSettings: (r: StaffRole) => r === "admin",
  rescheduleAppt: (r: StaffRole) => r === "admin" || r === "manager",
  switchPortal: (r: StaffRole) => r === "admin",
};
