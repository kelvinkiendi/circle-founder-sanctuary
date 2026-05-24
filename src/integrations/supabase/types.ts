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
      activity_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
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
          service_description: string | null
          service_id: string | null
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
          service_description?: string | null
          service_id?: string | null
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
          service_description?: string | null
          service_id?: string | null
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
          avatar_url: string | null
          birthday: string | null
          client_type: Database["public"]["Enums"]["client_type"]
          created_at: string
          email: string | null
          first_visit_date: string | null
          full_name: string
          id: string
          last_appointment_date: string | null
          next_visit_predicted_date: string | null
          notes: string | null
          phone: string | null
          referral_source: string | null
          referrer_id: string | null
          service_area: string | null
          status: Database["public"]["Enums"]["client_status"]
          whatsapp_number: string | null
          whatsapp_opt_out: boolean
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          birthday?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          created_at?: string
          email?: string | null
          first_visit_date?: string | null
          full_name: string
          id?: string
          last_appointment_date?: string | null
          next_visit_predicted_date?: string | null
          notes?: string | null
          phone?: string | null
          referral_source?: string | null
          referrer_id?: string | null
          service_area?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          whatsapp_number?: string | null
          whatsapp_opt_out?: boolean
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          birthday?: string | null
          client_type?: Database["public"]["Enums"]["client_type"]
          created_at?: string
          email?: string | null
          first_visit_date?: string | null
          full_name?: string
          id?: string
          last_appointment_date?: string | null
          next_visit_predicted_date?: string | null
          notes?: string | null
          phone?: string | null
          referral_source?: string | null
          referrer_id?: string | null
          service_area?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          whatsapp_number?: string | null
          whatsapp_opt_out?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clients_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      founder_waitlist: {
        Row: {
          added_by: string | null
          client_id: string
          created_at: string
          id: string
          notes: string | null
          priority_score: number
        }
        Insert: {
          added_by?: string | null
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          priority_score?: number
        }
        Update: {
          added_by?: string | null
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          priority_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "founder_waitlist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          founder_id: string | null
          id: string
          kind: string
          message: string
          read: boolean
        }
        Insert: {
          created_at?: string
          founder_id?: string | null
          id?: string
          kind: string
          message: string
          read?: boolean
        }
        Update: {
          created_at?: string
          founder_id?: string | null
          id?: string
          kind?: string
          message?: string
          read?: boolean
        }
        Relationships: []
      }
      payment_line_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          payment_id: string
          quantity: number
          service_id: string | null
          service_name: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          payment_id: string
          quantity?: number
          service_id?: string | null
          service_name: string
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          payment_id?: string
          quantity?: number
          service_id?: string | null
          service_name?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_ksh: number
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          failure_reason: string | null
          founder_id: string | null
          id: string
          mpesa_checkout_request_id: string | null
          mpesa_receipt_number: string | null
          paid_at: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          phone: string
          related_appointment_id: string | null
          related_product_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_ksh: number
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          failure_reason?: string | null
          founder_id?: string | null
          id?: string
          mpesa_checkout_request_id?: string | null
          mpesa_receipt_number?: string | null
          paid_at?: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          phone: string
          related_appointment_id?: string | null
          related_product_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_ksh?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          failure_reason?: string | null
          founder_id?: string | null
          id?: string
          mpesa_checkout_request_id?: string | null
          mpesa_receipt_number?: string | null
          paid_at?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          phone?: string
          related_appointment_id?: string | null
          related_product_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: []
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
      product_access_windows: {
        Row: {
          closes_at: string
          created_at: string
          id: string
          opens_at: string
          product_id: string
        }
        Insert: {
          closes_at: string
          created_at?: string
          id?: string
          opens_at?: string
          product_id: string
        }
        Update: {
          closes_at?: string
          created_at?: string
          id?: string
          opens_at?: string
          product_id?: string
        }
        Relationships: []
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
      receipts: {
        Row: {
          amount_ksh: number
          client_id: string
          description: string | null
          founder_id: string | null
          id: string
          issued_at: string
          payment_id: string
          pdf_url: string | null
          receipt_number: string
        }
        Insert: {
          amount_ksh: number
          client_id: string
          description?: string | null
          founder_id?: string | null
          id?: string
          issued_at?: string
          payment_id: string
          pdf_url?: string | null
          receipt_number: string
        }
        Update: {
          amount_ksh?: number
          client_id?: string
          description?: string | null
          founder_id?: string | null
          id?: string
          issued_at?: string
          payment_id?: string
          pdf_url?: string | null
          receipt_number?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_order: number
          duration_minutes: number
          eligible_roles: string[]
          id: string
          name: string
          price_ksh: number
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes?: number
          eligible_roles?: string[]
          id?: string
          name: string
          price_ksh?: number
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes?: number
          eligible_roles?: string[]
          id?: string
          name?: string
          price_ksh?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          failed_attempts: number
          full_name: string
          id: string
          last_login_at: string | null
          locked_until: string | null
          must_change_pin: boolean
          phone: string | null
          pin: string | null
          pin_hash: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          failed_attempts?: number
          full_name: string
          id?: string
          last_login_at?: string | null
          locked_until?: string | null
          must_change_pin?: boolean
          phone?: string | null
          pin?: string | null
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          status?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          failed_attempts?: number
          full_name?: string
          id?: string
          last_login_at?: string | null
          locked_until?: string | null
          must_change_pin?: boolean
          phone?: string | null
          pin?: string | null
          pin_hash?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          status?: string
        }
        Relationships: []
      }
      staff_commission_settings: {
        Row: {
          commission_percentage: number
          commission_type: string
          created_at: string
          effective_date: string
          fixed_amount_ksh: number
          id: string
          is_active: boolean
          notes: string | null
          set_by: string | null
          staff_id: string
        }
        Insert: {
          commission_percentage?: number
          commission_type?: string
          created_at?: string
          effective_date?: string
          fixed_amount_ksh?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          set_by?: string | null
          staff_id: string
        }
        Update: {
          commission_percentage?: number
          commission_type?: string
          created_at?: string
          effective_date?: string
          fixed_amount_ksh?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          set_by?: string | null
          staff_id?: string
        }
        Relationships: []
      }
      staff_earnings: {
        Row: {
          appointment_id: string | null
          commission_earned_ksh: number
          commission_percentage: number
          created_at: string
          earnings_date: string
          fixed_bonus_ksh: number
          id: string
          payment_id: string | null
          sale_amount_ksh: number
          service_id: string | null
          service_name: string | null
          staff_id: string
          total_commission_ksh: number
        }
        Insert: {
          appointment_id?: string | null
          commission_earned_ksh?: number
          commission_percentage?: number
          created_at?: string
          earnings_date?: string
          fixed_bonus_ksh?: number
          id?: string
          payment_id?: string | null
          sale_amount_ksh?: number
          service_id?: string | null
          service_name?: string | null
          staff_id: string
          total_commission_ksh?: number
        }
        Update: {
          appointment_id?: string | null
          commission_earned_ksh?: number
          commission_percentage?: number
          created_at?: string
          earnings_date?: string
          fixed_bonus_ksh?: number
          id?: string
          payment_id?: string | null
          sale_amount_ksh?: number
          service_id?: string | null
          service_name?: string | null
          staff_id?: string
          total_commission_ksh?: number
        }
        Relationships: []
      }
      staff_login_log: {
        Row: {
          attempted_at: string
          id: string
          ip: string | null
          reason: string | null
          staff_id: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip?: string | null
          reason?: string | null
          staff_id?: string | null
          success: boolean
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          id?: string
          ip?: string | null
          reason?: string | null
          staff_id?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      staff_sessions: {
        Row: {
          device_label: string | null
          ended_at: string | null
          id: string
          last_active_at: string
          portal: string | null
          staff_id: string
          started_at: string
        }
        Insert: {
          device_label?: string | null
          ended_at?: string | null
          id?: string
          last_active_at?: string
          portal?: string | null
          staff_id: string
          started_at?: string
        }
        Update: {
          device_label?: string | null
          ended_at?: string | null
          id?: string
          last_active_at?: string
          portal?: string | null
          staff_id?: string
          started_at?: string
        }
        Relationships: []
      }
      studio_locations: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          is_primary: boolean
          name: string
          phone: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
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
      whatsapp_messages: {
        Row: {
          appointment_id: string | null
          body: string
          client_id: string
          created_by: string | null
          delivered_at: string | null
          error: string | null
          id: string
          message_type: string | null
          phone_number: string | null
          read_at: string | null
          sent_at: string
          status: string
          template_key: string
        }
        Insert: {
          appointment_id?: string | null
          body: string
          client_id: string
          created_by?: string | null
          delivered_at?: string | null
          error?: string | null
          id?: string
          message_type?: string | null
          phone_number?: string | null
          read_at?: string | null
          sent_at?: string
          status?: string
          template_key: string
        }
        Update: {
          appointment_id?: string | null
          body?: string
          client_id?: string
          created_by?: string | null
          delivered_at?: string | null
          error?: string | null
          id?: string
          message_type?: string | null
          phone_number?: string | null
          read_at?: string | null
          sent_at?: string
          status?: string
          template_key?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_reset_pin: {
        Args: { p_admin_session: string; p_new_pin: string; p_staff_id: string }
        Returns: boolean
      }
      change_staff_pin: {
        Args: { p_new_pin: string; p_session: string }
        Returns: boolean
      }
      end_staff_session: { Args: { p_session: string }; Returns: undefined }
      get_staff_session: {
        Args: { p_session: string }
        Returns: {
          full_name: string
          last_login_at: string
          must_change_pin: boolean
          role: Database["public"]["Enums"]["staff_role"]
          session_id: string
          staff_id: string
        }[]
      }
      record_failed_pin: { Args: { p_pin: string }; Returns: undefined }
      record_staff_earnings_for_payment: {
        Args: { p_payment_id: string }
        Returns: number
      }
      set_staff_pin: {
        Args: { p_pin: string; p_staff_id: string }
        Returns: boolean
      }
      suspend_overdue_founders: { Args: never; Returns: number }
      verify_staff_pin: {
        Args: { p_device?: string; p_pin: string; p_user_agent?: string }
        Returns: {
          full_name: string
          last_login_at: string
          must_change_pin: boolean
          role: Database["public"]["Enums"]["staff_role"]
          session_id: string
          staff_id: string
        }[]
      }
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
      client_type: "regular" | "founder" | "prospect"
      founder_status: "active" | "expired" | "pending"
      payment_method: "full" | "installment"
      payment_status: "pending" | "paid" | "failed" | "cancelled"
      payment_type:
        | "enrollment_full"
        | "enrollment_installment_1"
        | "enrollment_installment_2"
        | "travel_transport"
        | "full_service_founder"
        | "product_purchase"
        | "emergency_service"
        | "other"
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
      staff_role: "admin" | "manager" | "technician" | "reception" | "guardian"
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
      client_type: ["regular", "founder", "prospect"],
      founder_status: ["active", "expired", "pending"],
      payment_method: ["full", "installment"],
      payment_status: ["pending", "paid", "failed", "cancelled"],
      payment_type: [
        "enrollment_full",
        "enrollment_installment_1",
        "enrollment_installment_2",
        "travel_transport",
        "full_service_founder",
        "product_purchase",
        "emergency_service",
        "other",
      ],
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
      staff_role: ["admin", "manager", "technician", "reception", "guardian"],
    },
  },
} as const
