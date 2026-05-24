export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          client_id: string
          created_at: string
          created_by: string | null
          duration_minutes: number
          id: string
          location: Database["public"]["Enums"]["appointment_location"]
          notes: string | null
          scheduled_date: string
          scheduled_time: string
          status: Database["public"]["Enums"]["appointment_status"]
        }
        Insert: {
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          client_id: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          location?: Database["public"]["Enums"]["appointment_location"]
          notes?: string | null
          scheduled_date: string
          scheduled_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Update: {
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          client_id?: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          id?: string
          location?: Database["public"]["Enums"]["appointment_location"]
          notes?: string | null
          scheduled_date?: string
          scheduled_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      brunch_attendance: {
        Row: {
          attendance_status: Database["public"]["Enums"]["brunch_attendance_status"]
          created_at: string
          dietary_notes: string | null
          event_id: string
          founder_id: string
          id: string
          photo_consent: boolean
        }
        Insert: {
          attendance_status?: Database["public"]["Enums"]["brunch_attendance_status"]
          created_at?: string
          dietary_notes?: string | null
          event_id: string
          founder_id: string
          id?: string
          photo_consent?: boolean
        }
        Update: {
          attendance_status?: Database["public"]["Enums"]["brunch_attendance_status"]
          created_at?: string
          dietary_notes?: string | null
          event_id?: string
          founder_id?: string
          id?: string
          photo_consent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "brunch_attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "founder_brunch_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brunch_attendance_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founder_circle"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          birthday: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          service_area: string | null
          status: Database["public"]["Enums"]["client_status"]
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          birthday?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          service_area?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          birthday?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          service_area?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      founder_brunch_events: {
        Row: {
          created_at: string
          event_date: string
          event_name: string
          id: string
          status: Database["public"]["Enums"]["brunch_event_status"]
          venue: string | null
        }
        Insert: {
          created_at?: string
          event_date: string
          event_name: string
          id?: string
          status?: Database["public"]["Enums"]["brunch_event_status"]
          venue?: string | null
        }
        Update: {
          created_at?: string
          event_date?: string
          event_name?: string
          id?: string
          status?: Database["public"]["Enums"]["brunch_event_status"]
          venue?: string | null
        }
        Relationships: []
      }
      founder_circle: {
        Row: {
          client_id: string
          created_at: string
          engagement_score: number
          enrollment_date: string
          enrollment_fee_paid: boolean
          founder_number: number | null
          id: string
          installment_count: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          referral_count: number
          status: Database["public"]["Enums"]["founder_status"]
          term_end_date: string | null
          total_paid_ksh: number | null
          total_spend: number
        }
        Insert: {
          client_id: string
          created_at?: string
          engagement_score?: number
          enrollment_date?: string
          enrollment_fee_paid?: boolean
          founder_number?: number | null
          id?: string
          installment_count?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          referral_count?: number
          status?: Database["public"]["Enums"]["founder_status"]
          term_end_date?: string | null
          total_paid_ksh?: number | null
          total_spend?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          engagement_score?: number
          enrollment_date?: string
          enrollment_fee_paid?: boolean
          founder_number?: number | null
          id?: string
          installment_count?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          referral_count?: number
          status?: Database["public"]["Enums"]["founder_status"]
          term_end_date?: string | null
          total_paid_ksh?: number | null
          total_spend?: number
        }
        Relationships: [
          {
            foreignKeyName: "founder_circle_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_purchases: {
        Row: {
          created_at: string
          founder_id: string
          id: string
          prelaunch_window: boolean
          price_applied: number
          product_id: string
          purchase_date: string
          quantity: number
        }
        Insert: {
          created_at?: string
          founder_id: string
          id?: string
          prelaunch_window?: boolean
          price_applied: number
          product_id: string
          purchase_date?: string
          quantity?: number
        }
        Update: {
          created_at?: string
          founder_id?: string
          id?: string
          prelaunch_window?: boolean
          price_applied?: number
          product_id?: string
          purchase_date?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "founder_purchases_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founder_circle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      perks_usage: {
        Row: {
          created_at: string
          expiry_date: string | null
          founder_id: string
          id: string
          month_number: number | null
          perk_type: Database["public"]["Enums"]["perk_type"]
          related_appointment_id: string | null
          status: Database["public"]["Enums"]["perk_status"]
          used_date: string | null
          week_number: number | null
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          founder_id: string
          id?: string
          month_number?: number | null
          perk_type: Database["public"]["Enums"]["perk_type"]
          related_appointment_id?: string | null
          status?: Database["public"]["Enums"]["perk_status"]
          used_date?: string | null
          week_number?: number | null
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          founder_id?: string
          id?: string
          month_number?: number | null
          perk_type?: Database["public"]["Enums"]["perk_type"]
          related_appointment_id?: string | null
          status?: Database["public"]["Enums"]["perk_status"]
          used_date?: string | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "perks_usage_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founder_circle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perks_usage_related_appointment_id_fkey"
            columns: ["related_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: Database["public"]["Enums"]["product_category"]
          cost_price: number
          created_at: string
          founder_price: number
          id: string
          launch_status: Database["public"]["Enums"]["product_launch"]
          name: string
          retail_price: number
          stock_quantity: number
        }
        Insert: {
          category: Database["public"]["Enums"]["product_category"]
          cost_price?: number
          created_at?: string
          founder_price?: number
          id?: string
          launch_status?: Database["public"]["Enums"]["product_launch"]
          name: string
          retail_price?: number
          stock_quantity?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["product_category"]
          cost_price?: number
          created_at?: string
          founder_price?: number
          id?: string
          launch_status?: Database["public"]["Enums"]["product_launch"]
          name?: string
          retail_price?: number
          stock_quantity?: number
        }
        Relationships: []
      }
      surprise_moments_log: {
        Row: {
          awarded_date: string
          awarded_reason: string | null
          created_at: string
          documented_by: string | null
          founder_id: string
          id: string
          related_appointment_id: string | null
          surprise_type: string
        }
        Insert: {
          awarded_date?: string
          awarded_reason?: string | null
          created_at?: string
          documented_by?: string | null
          founder_id: string
          id?: string
          related_appointment_id?: string | null
          surprise_type: string
        }
        Update: {
          awarded_date?: string
          awarded_reason?: string | null
          created_at?: string
          documented_by?: string | null
          founder_id?: string
          id?: string
          related_appointment_id?: string | null
          surprise_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "surprise_moments_log_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "founder_circle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surprise_moments_log_related_appointment_id_fkey"
            columns: ["related_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      appointment_location: "studio" | "travel"
      appointment_status:
        | "booked"
        | "completed"
        | "no-show"
        | "cancelled"
        | "forfeited"
      appointment_type:
        | "weekly_refresh"
        | "gel_rescue"
        | "travel_touchup"
        | "full_manicure"
        | "pedicure"
        | "surprise_full"
        | "random_upgrade"
        | "birthday_sanctuary"
        | "emergency"
      brunch_attendance_status: "confirmed" | "attended" | "no_show"
      brunch_event_status: "upcoming" | "completed" | "cancelled"
      client_status: "active" | "inactive"
      client_type: "regular" | "founder"
      founder_status: "active" | "expired" | "pending"
      payment_method: "full" | "installment"
      perk_status: "available" | "used" | "expired" | "forfeited"
      perk_type:
        | "weekly_refresh"
        | "gel_rescue"
        | "travel_touchup"
        | "surprise_full"
        | "birthday_sanctuary"
        | "random_upgrade"
        | "just_because"
      product_category:
        | "cuticle_oil"
        | "shoe_horn"
        | "gloves"
        | "magnetic_clasp"
      product_launch: "prelaunch" | "public"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_location: ["studio", "travel"],
      appointment_status: [
        "booked",
        "completed",
        "no-show",
        "cancelled",
        "forfeited",
      ],
      appointment_type: [
        "weekly_refresh",
        "gel_rescue",
        "travel_touchup",
        "full_manicure",
        "pedicure",
        "surprise_full",
        "random_upgrade",
        "birthday_sanctuary",
        "emergency",
      ],
      brunch_attendance_status: ["confirmed", "attended", "no_show"],
      brunch_event_status: ["upcoming", "completed", "cancelled"],
      client_status: ["active", "inactive"],
      client_type: ["regular", "founder"],
      founder_status: ["active", "expired", "pending"],
      payment_method: ["full", "installment"],
      perk_status: ["available", "used", "expired", "forfeited"],
      perk_type: [
        "weekly_refresh",
        "gel_rescue",
        "travel_touchup",
        "surprise_full",
        "birthday_sanctuary",
        "random_upgrade",
        "just_because",
      ],
      product_category: [
        "cuticle_oil",
        "shoe_horn",
        "gloves",
        "magnetic_clasp",
      ],
      product_launch: ["prelaunch", "public"],
    },
  },
} as const
