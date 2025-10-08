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
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          specification: Json
          updated_at: string | null
          validation_rules: Json
          version: string
        }
        Insert: {
          breaking_changes?: Json | null
          contract_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          specification: Json
          updated_at?: string | null
          validation_rules: Json
          version: string
        }
        Update: {
          breaking_changes?: Json | null
          contract_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          specification?: Json
          updated_at?: string | null
          validation_rules?: Json
          version?: string
        }
        Relationships: []
      }
      cost_tracking: {
        Row: {
          cost: number
          created_at: string | null
          id: string
          metadata: Json | null
          service_name: string
        }
        Insert: {
          cost: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          service_name: string
        }
        Update: {
          cost?: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          service_name?: string
        }
        Relationships: []
      }
      decision_logs: {
        Row: {
          agent_type: string
          confidence: number | null
          created_at: string | null
          decision_output: Json
          decision_type: string
          execution_time_ms: number | null
          id: string
          input_context: Json
        }
        Insert: {
          agent_type: string
          confidence?: number | null
          created_at?: string | null
          decision_output: Json
          decision_type: string
          execution_time_ms?: number | null
          id?: string
          input_context: Json
        }
        Update: {
          agent_type?: string
          confidence?: number | null
          created_at?: string | null
          decision_output?: Json
          decision_type?: string
          execution_time_ms?: number | null
          id?: string
          input_context?: Json
        }
        Relationships: []
      }
      escalation_scripts: {
        Row: {
          created_at: string | null
          effectiveness_score: number | null
          escalation_type: string
          id: string
          resolution_options: Json
          updated_at: string | null
          usage_patterns: Json | null
        }
        Insert: {
          created_at?: string | null
          effectiveness_score?: number | null
          escalation_type: string
          id?: string
          resolution_options: Json
          updated_at?: string | null
          usage_patterns?: Json | null
        }
        Update: {
          created_at?: string | null
          effectiveness_score?: number | null
          escalation_type?: string
          id?: string
          resolution_options?: Json
          updated_at?: string | null
          usage_patterns?: Json | null
        }
        Relationships: []
      }
      escalations: {
        Row: {
          context: Json
          created_at: string | null
          id: string
          resolution_notes: string | null
          resolution_type: string | null
          resolved_at: string | null
          status: string
          trigger_type: string
          updated_at: string | null
          work_order_id: string | null
        }
        Insert: {
          context: Json
          created_at?: string | null
          id?: string
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          status?: string
          trigger_type: string
          updated_at?: string | null
          work_order_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string | null
          id?: string
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          status?: string
          trigger_type?: string
          updated_at?: string | null
          work_order_id?: string | null
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
          created_at: string | null
          event_type: string
          id: string
          payload: Json
          status: string | null
          work_order_id: string | null
          workflow_name: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          payload: Json
          status?: string | null
          work_order_id?: string | null
          workflow_name?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json
          status?: string | null
          work_order_id?: string | null
          workflow_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "github_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      outcome_vectors: {
        Row: {
          cost: number
          created_at: string | null
          diff_size_lines: number | null
          execution_time_ms: number
          failure_classes: Json | null
          id: string
          metadata: Json | null
          model_used: string
          route_reason: string | null
          success: boolean
          work_order_id: string
        }
        Insert: {
          cost: number
          created_at?: string | null
          diff_size_lines?: number | null
          execution_time_ms: number
          failure_classes?: Json | null
          id?: string
          metadata?: Json | null
          model_used: string
          route_reason?: string | null
          success: boolean
          work_order_id: string
        }
        Update: {
          cost?: number
          created_at?: string | null
          diff_size_lines?: number | null
          execution_time_ms?: number
          failure_classes?: Json | null
          id?: string
          metadata?: Json | null
          model_used?: string
          route_reason?: string | null
          success?: boolean
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
          avg_cost: number | null
          avg_execution_time_ms: number | null
          confidence_score: number | null
          created_at: string | null
          failure_count: number | null
          id: string
          last_updated: string | null
          pattern_signature: string
          pattern_type: string
          success_count: number | null
        }
        Insert: {
          avg_cost?: number | null
          avg_execution_time_ms?: number | null
          confidence_score?: number | null
          created_at?: string | null
          failure_count?: number | null
          id?: string
          last_updated?: string | null
          pattern_signature: string
          pattern_type: string
          success_count?: number | null
        }
        Update: {
          avg_cost?: number | null
          avg_execution_time_ms?: number | null
          confidence_score?: number | null
          created_at?: string | null
          failure_count?: number | null
          id?: string
          last_updated?: string | null
          pattern_signature?: string
          pattern_type?: string
          success_count?: number | null
        }
        Relationships: []
      }
      playbook_memory: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          solution_steps: Json
          solution_type: string
          success_rate: number | null
          trigger_pattern: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          solution_steps: Json
          solution_type: string
          success_rate?: number | null
          trigger_pattern: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          solution_steps?: Json
          solution_type?: string
          success_rate?: number | null
          trigger_pattern?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string | null
          default_branch: string | null
          description: string | null
          git_initialized: boolean | null
          github_org: string | null
          github_repo_name: string | null
          github_repo_url: string | null
          id: string
          infrastructure_status: string | null
          local_path: string
          name: string
          setup_notes: Json | null
          status: string
          supabase_anon_key: string | null
          supabase_project_url: string | null
          updated_at: string | null
          vercel_team_id: string | null
        }
        Insert: {
          created_at?: string | null
          default_branch?: string | null
          description?: string | null
          git_initialized?: boolean | null
          github_org?: string | null
          github_repo_name?: string | null
          github_repo_url?: string | null
          id?: string
          infrastructure_status?: string | null
          local_path: string
          name: string
          setup_notes?: Json | null
          status?: string
          supabase_anon_key?: string | null
          supabase_project_url?: string | null
          updated_at?: string | null
          vercel_team_id?: string | null
        }
        Update: {
          created_at?: string | null
          default_branch?: string | null
          description?: string | null
          git_initialized?: boolean | null
          github_org?: string | null
          github_repo_name?: string | null
          github_repo_url?: string | null
          id?: string
          infrastructure_status?: string | null
          local_path?: string
          name?: string
          setup_notes?: Json | null
          status?: string
          supabase_anon_key?: string | null
          supabase_project_url?: string | null
          updated_at?: string | null
          vercel_team_id?: string | null
        }
        Relationships: []
      }
      proposer_configs: {
        Row: {
          active: boolean | null
          complexity_threshold: number
          cost_profile: Json
          created_at: string | null
          id: string
          model: string
          name: string
          provider: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          complexity_threshold?: number
          cost_profile: Json
          created_at?: string | null
          id?: string
          model: string
          name: string
          provider: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          complexity_threshold?: number
          cost_profile?: Json
          created_at?: string | null
          id?: string
          model?: string
          name?: string
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_config: {
        Row: {
          created_at: string | null
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          acceptance_criteria: Json | null
          actual_cost: number | null
          architect_version: string | null
          completed_at: string | null
          context_budget_estimate: number | null
          created_at: string | null
          decomposition_doc: string | null
          description: string
          estimated_cost: number | null
          files_in_scope: Json | null
          github_branch: string | null
          github_pr_number: number | null
          github_pr_url: string | null
          id: string
          metadata: Json | null
          pattern_confidence: number | null
          project_id: string | null
          proposer_id: string | null
          risk_level: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          acceptance_criteria?: Json | null
          actual_cost?: number | null
          architect_version?: string | null
          completed_at?: string | null
          context_budget_estimate?: number | null
          created_at?: string | null
          decomposition_doc?: string | null
          description: string
          estimated_cost?: number | null
          files_in_scope?: Json | null
          github_branch?: string | null
          github_pr_number?: number | null
          github_pr_url?: string | null
          id?: string
          metadata?: Json | null
          pattern_confidence?: number | null
          project_id?: string | null
          proposer_id?: string | null
          risk_level?: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          acceptance_criteria?: Json | null
          actual_cost?: number | null
          architect_version?: string | null
          completed_at?: string | null
          context_budget_estimate?: number | null
          created_at?: string | null
          decomposition_doc?: string | null
          description?: string
          estimated_cost?: number | null
          files_in_scope?: Json | null
          github_branch?: string | null
          github_pr_number?: number | null
          github_pr_url?: string | null
          id?: string
          metadata?: Json | null
          pattern_confidence?: number | null
          project_id?: string | null
          proposer_id?: string | null
          risk_level?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_reserve_budget: {
        Args: {
          p_estimated_cost: number
          p_metadata?: Json
          p_service_name: string
        }
        Returns: {
          can_proceed: boolean
          current_total: number
          reservation_id: string
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
