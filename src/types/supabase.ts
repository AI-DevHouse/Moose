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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      contracts: {
        Row: {
          breaking_changes: Json | null
          contract_type: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          specification: Json
          updated_at: string
          validation_rules: Json
          version: string
        }
        Insert: {
          breaking_changes?: Json | null
          contract_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          specification: Json
          updated_at?: string
          validation_rules: Json
          version: string
        }
        Update: {
          breaking_changes?: Json | null
          contract_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          specification?: Json
          updated_at?: string
          validation_rules?: Json
          version?: string
        }
        Relationships: []
      }
      cost_tracking: {
        Row: {
          cost: number
          created_at: string
          id: string
          metadata: Json | null
          service_name: string
        }
        Insert: {
          cost: number
          created_at?: string
          id?: string
          metadata?: Json | null
          service_name: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          service_name?: string
        }
        Relationships: []
      }
      decision_logs: {
        Row: {
          approved: boolean
          approved_by: string | null
          created_at: string
          decision_data: Json
          decision_type: string
          id: string
          reasoning: string | null
          work_order_id: string | null
        }
        Insert: {
          approved?: boolean
          approved_by?: string | null
          created_at?: string
          decision_data: Json
          decision_type: string
          id?: string
          reasoning?: string | null
          work_order_id?: string | null
        }
        Update: {
          approved?: boolean
          approved_by?: string | null
          created_at?: string
          decision_data?: Json
          decision_type?: string
          id?: string
          reasoning?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_logs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      escalations: {
        Row: {
          assigned_to: string | null
          created_at: string
          escalation_data: Json | null
          id: string
          reason: string
          resolution_notes: string | null
          resolved_at: string | null
          status: string
          updated_at: string
          work_order_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          escalation_data?: Json | null
          id?: string
          reason: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
          work_order_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          escalation_data?: Json | null
          id?: string
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalations_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      github_events: {
        Row: {
          action: string
          branch_name: string | null
          check_name: string | null
          commit_sha: string | null
          conclusion: string | null
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          pr_number: number | null
          repository_id: number
          repository_name: string
          status: string | null
          workflow_name: string | null
        }
        Insert: {
          action: string
          branch_name?: string | null
          check_name?: string | null
          commit_sha?: string | null
          conclusion?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          pr_number?: number | null
          repository_id: number
          repository_name: string
          status?: string | null
          workflow_name?: string | null
        }
        Update: {
          action?: string
          branch_name?: string | null
          check_name?: string | null
          commit_sha?: string | null
          conclusion?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          pr_number?: number | null
          repository_id?: number
          repository_name?: string
          status?: string | null
          workflow_name?: string | null
        }
        Relationships: []
      }
      outcome_vectors: {
        Row: {
          cost: number
          created_at: string
          diff_size_lines: number
          execution_time_ms: number
          failure_classes: string[] | null
          id: string
          metadata: Json | null
          model_used: string
          route_reason: string
          success: boolean
          test_duration_ms: number | null
          work_order_id: string
        }
        Insert: {
          cost: number
          created_at?: string
          diff_size_lines?: number
          execution_time_ms: number
          failure_classes?: string[] | null
          id?: string
          metadata?: Json | null
          model_used: string
          route_reason: string
          success: boolean
          test_duration_ms?: number | null
          work_order_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          diff_size_lines?: number
          execution_time_ms?: number
          failure_classes?: string[] | null
          id?: string
          metadata?: Json | null
          model_used?: string
          route_reason?: string
          success?: boolean
          test_duration_ms?: number | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcome_vectors_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_confidence_scores: {
        Row: {
          confidence_score: number
          created_at: string
          failure_count: number
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          pattern_hash: string
          success_count: number
          updated_at: string
          work_order_type: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          pattern_hash: string
          success_count?: number
          updated_at?: string
          work_order_type: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          pattern_hash?: string
          success_count?: number
          updated_at?: string
          work_order_type?: string
        }
        Relationships: []
      }
      playbook_memory: {
        Row: {
          confidence_score: number
          created_at: string
          fixes: Json | null
          id: string
          last_used_at: string | null
          pattern_name: string
          pattern_type: string
          prompts: Json
          success_variations: Json | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          fixes?: Json | null
          id?: string
          last_used_at?: string | null
          pattern_name: string
          pattern_type: string
          prompts: Json
          success_variations?: Json | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          confidence_score?: number
          created_at?: string
          fixes?: Json | null
          id?: string
          last_used_at?: string | null
          pattern_name?: string
          pattern_type?: string
          prompts?: Json
          success_variations?: Json | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      proposer_configs: {
        Row: {
          complexity_threshold: number
          context_limit: number
          cost_profile: Json
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          provider: string
          strengths: string[]
          success_patterns: Json | null
          updated_at: string
        }
        Insert: {
          complexity_threshold?: number
          context_limit?: number
          cost_profile: Json
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          provider: string
          strengths?: string[]
          success_patterns?: Json | null
          updated_at?: string
        }
        Update: {
          complexity_threshold?: number
          context_limit?: number
          cost_profile?: Json
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          provider?: string
          strengths?: string[]
          success_patterns?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      system_status: {
        Row: {
          component_name: string
          created_at: string
          id: string
          last_heartbeat: string
          metadata: Json | null
          response_time_ms: number
          status: string
          updated_at: string
        }
        Insert: {
          component_name: string
          created_at?: string
          id?: string
          last_heartbeat?: string
          metadata?: Json | null
          response_time_ms?: number
          status: string
          updated_at?: string
        }
        Update: {
          component_name?: string
          created_at?: string
          id?: string
          last_heartbeat?: string
          metadata?: Json | null
          response_time_ms?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          actual_cost: number | null
          completed_at: string | null
          created_at: string
          description: string
          estimated_cost: number
          github_branch: string | null
          github_pr_number: number | null
          github_pr_url: string | null
          id: string
          metadata: Json | null
          pattern_confidence: number
          proposer_id: string
          risk_level: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          completed_at?: string | null
          created_at?: string
          description: string
          estimated_cost?: number
          github_branch?: string | null
          github_pr_number?: number | null
          github_pr_url?: string | null
          id?: string
          metadata?: Json | null
          pattern_confidence?: number
          proposer_id: string
          risk_level: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          completed_at?: string | null
          created_at?: string
          description?: string
          estimated_cost?: number
          github_branch?: string | null
          github_pr_number?: number | null
          github_pr_url?: string | null
          id?: string
          metadata?: Json | null
          pattern_confidence?: number
          proposer_id?: string
          risk_level?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_proposer_id_fkey"
            columns: ["proposer_id"]
            isOneToOne: false
            referencedRelation: "proposer_configs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dashboard_summary: {
        Row: {
          avg_confidence_7d: number | null
          daily_spend: number | null
          escalated_work_orders: number | null
          monthly_spend: number | null
          open_escalations: number | null
          pending_work_orders: number | null
          processing_work_orders: number | null
        }
        Relationships: []
      }
      github_integration_status: {
        Row: {
          events_last_24h: number | null
          integration_status: string | null
          last_api_check: string | null
          last_event_received: string | null
          prs_last_24h: number | null
          pushes_last_24h: number | null
          webhook_status: string | null
          work_orders_with_prs: number | null
          workflows_last_24h: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_work_order_github_events: {
        Args: { work_order_id_param: string }
        Returns: {
          action: string
          branch_name: string
          commit_sha: string
          conclusion: string
          created_at: string
          event_id: string
          event_summary: Json
          event_type: string
          pr_number: number
          status: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
