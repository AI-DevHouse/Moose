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
      bootstrap_events: {
        Row: {
          branch_name: string | null
          commit_hash: string | null
          created_at: string
          decomposition_id: string | null
          error_message: string | null
          execution_time_ms: number | null
          files_created: string[] | null
          id: string
          project_id: string
          requirements_summary: Json | null
          status: string
          validation_errors: string[] | null
        }
        Insert: {
          branch_name?: string | null
          commit_hash?: string | null
          created_at?: string
          decomposition_id?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          files_created?: string[] | null
          id?: string
          project_id: string
          requirements_summary?: Json | null
          status: string
          validation_errors?: string[] | null
        }
        Update: {
          branch_name?: string | null
          commit_hash?: string | null
          created_at?: string
          decomposition_id?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          files_created?: string[] | null
          id?: string
          project_id?: string
          requirements_summary?: Json | null
          status?: string
          validation_errors?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "bootstrap_events_decomposition_id_fkey"
            columns: ["decomposition_id"]
            isOneToOne: false
            referencedRelation: "decomposition_metadata"
            referencedColumns: ["decomposition_id"]
          },
          {
            foreignKeyName: "bootstrap_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
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
          work_order_id: string | null
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
          work_order_id?: string | null
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
      decomposition_metadata: {
        Row: {
          aggregated_requirements: Json | null
          bootstrap_commit_hash: string | null
          bootstrap_executed: boolean | null
          bootstrap_needed: boolean
          bootstrap_result: Json | null
          conflict_report: Json | null
          conflicts_resolved_at: string | null
          created_at: string
          decomposition_id: string
          has_conflicts: boolean
          id: string
          project_id: string
          resolved_by: string | null
          updated_at: string
          work_order_ids: string[]
        }
        Insert: {
          aggregated_requirements?: Json | null
          bootstrap_commit_hash?: string | null
          bootstrap_executed?: boolean | null
          bootstrap_needed?: boolean
          bootstrap_result?: Json | null
          conflict_report?: Json | null
          conflicts_resolved_at?: string | null
          created_at?: string
          decomposition_id: string
          has_conflicts?: boolean
          id?: string
          project_id: string
          resolved_by?: string | null
          updated_at?: string
          work_order_ids: string[]
        }
        Update: {
          aggregated_requirements?: Json | null
          bootstrap_commit_hash?: string | null
          bootstrap_executed?: boolean | null
          bootstrap_needed?: boolean
          bootstrap_result?: Json | null
          conflict_report?: Json | null
          conflicts_resolved_at?: string | null
          created_at?: string
          decomposition_id?: string
          has_conflicts?: boolean
          id?: string
          project_id?: string
          resolved_by?: string | null
          updated_at?: string
          work_order_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "decomposition_metadata_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          failure_class:
            | Database["public"]["Enums"]["failure_class_enum"]
            | null
          id: string
          resolution_notes: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          trigger_type: string
          updated_at: string | null
          work_order_id: string | null
        }
        Insert: {
          context: Json
          created_at?: string | null
          failure_class?:
            | Database["public"]["Enums"]["failure_class_enum"]
            | null
          id?: string
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          trigger_type: string
          updated_at?: string | null
          work_order_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string | null
          failure_class?:
            | Database["public"]["Enums"]["failure_class_enum"]
            | null
          id?: string
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
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
      moose_improvements: {
        Row: {
          actual_impact: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          description: string
          expected_impact: string | null
          files_changed: string[] | null
          from_iteration_id: string | null
          git_commit_hash: string | null
          id: string
          improvement_type: string | null
          proposal_details: Json | null
          proposed_at: string | null
          to_iteration_id: string | null
        }
        Insert: {
          actual_impact?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description: string
          expected_impact?: string | null
          files_changed?: string[] | null
          from_iteration_id?: string | null
          git_commit_hash?: string | null
          id?: string
          improvement_type?: string | null
          proposal_details?: Json | null
          proposed_at?: string | null
          to_iteration_id?: string | null
        }
        Update: {
          actual_impact?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string
          expected_impact?: string | null
          files_changed?: string[] | null
          from_iteration_id?: string | null
          git_commit_hash?: string | null
          id?: string
          improvement_type?: string | null
          proposal_details?: Json | null
          proposed_at?: string | null
          to_iteration_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moose_improvements_from_iteration_id_fkey"
            columns: ["from_iteration_id"]
            isOneToOne: false
            referencedRelation: "test_iterations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moose_improvements_to_iteration_id_fkey"
            columns: ["to_iteration_id"]
            isOneToOne: false
            referencedRelation: "test_iterations"
            referencedColumns: ["id"]
          },
        ]
      }
      outcome_vectors: {
        Row: {
          cost: number
          created_at: string | null
          diff_size_lines: number | null
          error_context: Json | null
          execution_time_ms: number
          failure_class:
            | Database["public"]["Enums"]["failure_class_enum"]
            | null
          id: string
          metadata: Json | null
          model_used: string
          route_reason: string | null
          success: boolean
          test_duration_ms: number | null
          work_order_id: string
        }
        Insert: {
          cost: number
          created_at?: string | null
          diff_size_lines?: number | null
          error_context?: Json | null
          execution_time_ms: number
          failure_class?:
            | Database["public"]["Enums"]["failure_class_enum"]
            | null
          id?: string
          metadata?: Json | null
          model_used: string
          route_reason?: string | null
          success: boolean
          test_duration_ms?: number | null
          work_order_id: string
        }
        Update: {
          cost?: number
          created_at?: string | null
          diff_size_lines?: number | null
          error_context?: Json | null
          execution_time_ms?: number
          failure_class?:
            | Database["public"]["Enums"]["failure_class_enum"]
            | null
          id?: string
          metadata?: Json | null
          model_used?: string
          route_reason?: string | null
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
      package_version_corrections: {
        Row: {
          id: string
          project_id: string
          work_order_id: string
          package_name: string
          old_version: string
          new_version: string
          correction_reason: string
          source_work_order_id: string | null
          confidence_level: string
          validated_at: string
          execution_context: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          work_order_id: string
          package_name: string
          old_version: string
          new_version: string
          correction_reason: string
          source_work_order_id?: string | null
          confidence_level: string
          validated_at?: string
          execution_context: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          work_order_id?: string
          package_name?: string
          old_version?: string
          new_version?: string
          correction_reason?: string
          source_work_order_id?: string | null
          confidence_level?: string
          validated_at?: string
          execution_context?: string
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_version_corrections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_version_corrections_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_version_corrections_source_work_order_id_fkey"
            columns: ["source_work_order_id"]
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
      prompt_enhancements: {
        Row: {
          applications_count: number
          created_at: string
          enhancement_text: string
          enhancement_version: number
          error_code: string
          error_pattern: string | null
          failure_count: number
          id: string
          improvement_reason: string | null
          is_active: boolean
          last_effectiveness_check: string | null
          parent_enhancement_id: string | null
          reduction_rate: number | null
          success_count: number
          target_complexity_max: number | null
          target_complexity_min: number | null
          target_proposer_names: string[] | null
          updated_at: string
        }
        Insert: {
          applications_count?: number
          created_at?: string
          enhancement_text: string
          enhancement_version?: number
          error_code: string
          error_pattern?: string | null
          failure_count?: number
          id?: string
          improvement_reason?: string | null
          is_active?: boolean
          last_effectiveness_check?: string | null
          parent_enhancement_id?: string | null
          reduction_rate?: number | null
          success_count?: number
          target_complexity_max?: number | null
          target_complexity_min?: number | null
          target_proposer_names?: string[] | null
          updated_at?: string
        }
        Update: {
          applications_count?: number
          created_at?: string
          enhancement_text?: string
          enhancement_version?: number
          error_code?: string
          error_pattern?: string | null
          failure_count?: number
          id?: string
          improvement_reason?: string | null
          is_active?: boolean
          last_effectiveness_check?: string | null
          parent_enhancement_id?: string | null
          reduction_rate?: number | null
          success_count?: number
          target_complexity_max?: number | null
          target_complexity_min?: number | null
          target_proposer_names?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_enhancements_parent_enhancement_id_fkey"
            columns: ["parent_enhancement_id"]
            isOneToOne: false
            referencedRelation: "prompt_enhancements"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_versions: {
        Row: {
          activated_at: string | null
          author: string | null
          avg_success_rate: number | null
          change_notes: string | null
          created_at: string
          deactivated_at: string | null
          id: string
          is_active: boolean
          parent_version_id: string | null
          prompt_template: string
          prompt_type: string
          template_variables: Json | null
          usage_count: number
          version_number: number
          version_tag: string | null
        }
        Insert: {
          activated_at?: string | null
          author?: string | null
          avg_success_rate?: number | null
          change_notes?: string | null
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          parent_version_id?: string | null
          prompt_template: string
          prompt_type: string
          template_variables?: Json | null
          usage_count?: number
          version_number: number
          version_tag?: string | null
        }
        Update: {
          activated_at?: string | null
          author?: string | null
          avg_success_rate?: number | null
          change_notes?: string | null
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          parent_version_id?: string | null
          prompt_template?: string
          prompt_type?: string
          template_variables?: Json | null
          usage_count?: number
          version_number?: number
          version_tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      proposer_attempts: {
        Row: {
          complexity_band: string
          created_at: string
          final_errors: number
          id: string
          proposer_name: string
          refinement_count: number
          sequence_num: number
          was_success: boolean
          work_order_id: string | null
        }
        Insert: {
          complexity_band: string
          created_at?: string
          final_errors?: number
          id?: string
          proposer_name: string
          refinement_count?: number
          sequence_num?: number
          was_success: boolean
          work_order_id?: string | null
        }
        Update: {
          complexity_band?: string
          created_at?: string
          final_errors?: number
          id?: string
          proposer_name?: string
          refinement_count?: number
          sequence_num?: number
          was_success?: boolean
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposer_attempts_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
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
      proposer_failures: {
        Row: {
          complexity_band: string | null
          complexity_score: number | null
          created_at: string
          error_codes: string[] | null
          error_samples: Json | null
          failure_category: string | null
          final_errors: number
          id: string
          initial_errors: number
          is_success: boolean
          proposer_name: string
          refinement_count: number
          refinement_success: boolean
          sanitizer_changes: string[] | null
          sanitizer_functions_triggered: number | null
          work_order_id: string | null
        }
        Insert: {
          complexity_band?: string | null
          complexity_score?: number | null
          created_at?: string
          error_codes?: string[] | null
          error_samples?: Json | null
          failure_category?: string | null
          final_errors?: number
          id?: string
          initial_errors?: number
          is_success?: boolean
          proposer_name: string
          refinement_count?: number
          refinement_success?: boolean
          sanitizer_changes?: string[] | null
          sanitizer_functions_triggered?: number | null
          work_order_id?: string | null
        }
        Update: {
          complexity_band?: string | null
          complexity_score?: number | null
          created_at?: string
          error_codes?: string[] | null
          error_samples?: Json | null
          failure_category?: string | null
          final_errors?: number
          id?: string
          initial_errors?: number
          is_success?: boolean
          proposer_name?: string
          refinement_count?: number
          refinement_success?: boolean
          sanitizer_changes?: string[] | null
          sanitizer_functions_triggered?: number | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposer_failures_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      proposer_success_metrics: {
        Row: {
          avg_final_errors: number | null
          avg_improvement_rate: number | null
          avg_initial_errors: number | null
          avg_refinement_cycles: number | null
          complexity_band: string
          created_at: string
          failed_attempts: number
          id: string
          proposer_name: string
          success_rate: number | null
          successful_attempts: number
          top_error_codes: Json | null
          total_attempts: number
          updated_at: string
          window_end: string
          window_start: string
          zero_refinement_success_rate: number | null
        }
        Insert: {
          avg_final_errors?: number | null
          avg_improvement_rate?: number | null
          avg_initial_errors?: number | null
          avg_refinement_cycles?: number | null
          complexity_band: string
          created_at?: string
          failed_attempts?: number
          id?: string
          proposer_name: string
          success_rate?: number | null
          successful_attempts?: number
          top_error_codes?: Json | null
          total_attempts?: number
          updated_at?: string
          window_end: string
          window_start: string
          zero_refinement_success_rate?: number | null
        }
        Update: {
          avg_final_errors?: number | null
          avg_improvement_rate?: number | null
          avg_initial_errors?: number | null
          avg_refinement_cycles?: number | null
          complexity_band?: string
          created_at?: string
          failed_attempts?: number
          id?: string
          proposer_name?: string
          success_rate?: number | null
          successful_attempts?: number
          top_error_codes?: Json | null
          total_attempts?: number
          updated_at?: string
          window_end?: string
          window_start?: string
          zero_refinement_success_rate?: number | null
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
      test_iterations: {
        Row: {
          analysis_summary: Json | null
          architecture_score: number | null
          builds_successfully: boolean | null
          completed_at: string | null
          completeness_score: number | null
          created_at: string | null
          failures_by_class: Json | null
          id: string
          isolation_verified: boolean | null
          iteration_number: number
          lint_errors: number | null
          moose_files_modified: boolean | null
          moose_version: string | null
          overall_score: number | null
          project_name: string
          readability_score: number | null
          scoring_details: Json | null
          started_at: string
          status: string | null
          test_coverage_score: number | null
          tests_pass: boolean | null
          total_cost_usd: number | null
          total_execution_time_seconds: number | null
          total_work_orders: number | null
          user_experience_score: number | null
          work_orders_failed: number | null
          work_orders_succeeded: number | null
        }
        Insert: {
          analysis_summary?: Json | null
          architecture_score?: number | null
          builds_successfully?: boolean | null
          completed_at?: string | null
          completeness_score?: number | null
          created_at?: string | null
          failures_by_class?: Json | null
          id?: string
          isolation_verified?: boolean | null
          iteration_number: number
          lint_errors?: number | null
          moose_files_modified?: boolean | null
          moose_version?: string | null
          overall_score?: number | null
          project_name: string
          readability_score?: number | null
          scoring_details?: Json | null
          started_at?: string
          status?: string | null
          test_coverage_score?: number | null
          tests_pass?: boolean | null
          total_cost_usd?: number | null
          total_execution_time_seconds?: number | null
          total_work_orders?: number | null
          user_experience_score?: number | null
          work_orders_failed?: number | null
          work_orders_succeeded?: number | null
        }
        Update: {
          analysis_summary?: Json | null
          architecture_score?: number | null
          builds_successfully?: boolean | null
          completed_at?: string | null
          completeness_score?: number | null
          created_at?: string | null
          failures_by_class?: Json | null
          id?: string
          isolation_verified?: boolean | null
          iteration_number?: number
          lint_errors?: number | null
          moose_files_modified?: boolean | null
          moose_version?: string | null
          overall_score?: number | null
          project_name?: string
          readability_score?: number | null
          scoring_details?: Json | null
          started_at?: string
          status?: string | null
          test_coverage_score?: number | null
          tests_pass?: boolean | null
          total_cost_usd?: number | null
          total_execution_time_seconds?: number | null
          total_work_orders?: number | null
          user_experience_score?: number | null
          work_orders_failed?: number | null
          work_orders_succeeded?: number | null
        }
        Relationships: []
      }
      threshold_experiments: {
        Row: {
          attempts_count: number
          completed_at: string | null
          complexity_band: string
          created_at: string
          current_threshold: number
          experiment_notes: string | null
          experimental_threshold: number
          failure_count: number
          id: string
          min_attempts: number
          promotion_reason: string | null
          proposer_name: string
          started_at: string
          status: string
          success_count: number
          success_rate: number | null
          target_success_rate: number
          updated_at: string
        }
        Insert: {
          attempts_count?: number
          completed_at?: string | null
          complexity_band: string
          created_at?: string
          current_threshold: number
          experiment_notes?: string | null
          experimental_threshold: number
          failure_count?: number
          id?: string
          min_attempts?: number
          promotion_reason?: string | null
          proposer_name: string
          started_at?: string
          status?: string
          success_count?: number
          success_rate?: number | null
          target_success_rate?: number
          updated_at?: string
        }
        Update: {
          attempts_count?: number
          completed_at?: string | null
          complexity_band?: string
          created_at?: string
          current_threshold?: number
          experiment_notes?: string | null
          experimental_threshold?: number
          failure_count?: number
          id?: string
          min_attempts?: number
          promotion_reason?: string | null
          proposer_name?: string
          started_at?: string
          status?: string
          success_count?: number
          success_rate?: number | null
          target_success_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          acceptance_criteria: Json | null
          acceptance_result: Json | null
          actual_cost: number | null
          architect_version: string | null
          completed_at: string | null
          complexity_score: number | null
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
          technical_requirements: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          acceptance_criteria?: Json | null
          acceptance_result?: Json | null
          actual_cost?: number | null
          architect_version?: string | null
          completed_at?: string | null
          complexity_score?: number | null
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
          technical_requirements?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          acceptance_criteria?: Json | null
          acceptance_result?: Json | null
          actual_cost?: number | null
          architect_version?: string | null
          completed_at?: string | null
          complexity_score?: number | null
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
          technical_requirements?: Json | null
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
      improvement_impact_report: {
        Row: {
          actual_impact: string | null
          approved_at: string | null
          approved_by: string | null
          description: string | null
          expected_impact: string | null
          improvement_type: string | null
          score_after: number | null
          score_before: number | null
          score_delta: number | null
        }
        Relationships: []
      }
      iteration_progress: {
        Row: {
          builds_successfully: boolean | null
          completed_at: string | null
          isolation_verified: boolean | null
          iteration_number: number | null
          overall_score: number | null
          project_name: string | null
          status: string | null
          tests_pass: boolean | null
          total_cost_usd: number | null
          work_orders_failed: number | null
          work_orders_succeeded: number | null
        }
        Insert: {
          builds_successfully?: boolean | null
          completed_at?: string | null
          isolation_verified?: boolean | null
          iteration_number?: number | null
          overall_score?: number | null
          project_name?: string | null
          status?: string | null
          tests_pass?: boolean | null
          total_cost_usd?: number | null
          work_orders_failed?: number | null
          work_orders_succeeded?: number | null
        }
        Update: {
          builds_successfully?: boolean | null
          completed_at?: string | null
          isolation_verified?: boolean | null
          iteration_number?: number | null
          overall_score?: number | null
          project_name?: string | null
          status?: string | null
          tests_pass?: boolean | null
          total_cost_usd?: number | null
          work_orders_failed?: number | null
          work_orders_succeeded?: number | null
        }
        Relationships: []
      }
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
      failure_class_enum:
        | "compile_error"
        | "contract_violation"
        | "test_fail"
        | "lint_error"
        | "orchestration_error"
        | "budget_exceeded"
        | "dependency_missing"
        | "timeout"
        | "unknown"
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
      failure_class_enum: [
        "compile_error",
        "contract_violation",
        "test_fail",
        "lint_error",
        "orchestration_error",
        "budget_exceeded",
        "dependency_missing",
        "timeout",
        "unknown",
      ],
    },
  },
} as const
