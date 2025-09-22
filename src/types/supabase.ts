// types/supabase.ts
// Database types generated from Supabase schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      work_orders: {
        Row: {
          id: string
          title: string
          description: string
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'escalated'
          risk_level: 'low' | 'medium' | 'high'
          proposer_id: string
          estimated_cost: number
          actual_cost: number | null
          pattern_confidence: number
          metadata: Json | null
          created_at: string
          updated_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description: string
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'escalated'
          risk_level: 'low' | 'medium' | 'high'
          proposer_id: string
          estimated_cost: number
          actual_cost?: number | null
          pattern_confidence?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'escalated'
          risk_level?: 'low' | 'medium' | 'high'
          proposer_id?: string
          estimated_cost?: number
          actual_cost?: number | null
          pattern_confidence?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
      }
      proposer_configs: {
        Row: {
          id: string
          name: string
          provider: string
          endpoint: string
          context_limit: number
          cost_profile: Json
          strengths: string[]
          complexity_threshold: number
          success_patterns: Json | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          provider: string
          endpoint: string
          context_limit: number
          cost_profile: Json
          strengths: string[]
          complexity_threshold?: number
          success_patterns?: Json | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          provider?: string
          endpoint?: string
          context_limit?: number
          cost_profile?: Json
          strengths?: string[]
          complexity_threshold?: number
          success_patterns?: Json | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      system_status: {
        Row: {
          id: string
          component_name: string
          status: 'online' | 'offline' | 'degraded'
          last_heartbeat: string
          response_time_ms: number
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          component_name: string
          status: 'online' | 'offline' | 'degraded'
          last_heartbeat: string
          response_time_ms?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          component_name?: string
          status?: 'online' | 'offline' | 'degraded'
          last_heartbeat?: string
          response_time_ms?: number
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      escalations: {
        Row: {
          id: string
          work_order_id: string
          reason: string
          status: 'open' | 'in_progress' | 'resolved' | 'dismissed'
          escalation_data: Json | null
          resolution_notes: string | null
          assigned_to: string | null
          created_at: string
          updated_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          work_order_id: string
          reason: string
          status?: 'open' | 'in_progress' | 'resolved' | 'dismissed'
          escalation_data?: Json | null
          resolution_notes?: string | null
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          work_order_id?: string
          reason?: string
          status?: 'open' | 'in_progress' | 'resolved' | 'dismissed'
          escalation_data?: Json | null
          resolution_notes?: string | null
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
        }
      }
      pattern_confidence_scores: {
        Row: {
          id: string
          work_order_type: string
          pattern_hash: string
          confidence_score: number
          success_count: number
          failure_count: number
          last_success_at: string | null
          last_failure_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_order_type: string
          pattern_hash: string
          confidence_score?: number
          success_count?: number
          failure_count?: number
          last_success_at?: string | null
          last_failure_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_order_type?: string
          pattern_hash?: string
          confidence_score?: number
          success_count?: number
          failure_count?: number
          last_success_at?: string | null
          last_failure_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      outcome_vectors: {
        Row: {
          id: string
          work_order_id: string
          success: boolean
          execution_time_ms: number
          cost: number
          model_used: string
          route_reason: string
          diff_size_lines: number
          test_duration_ms: number | null
          failure_classes: string[] | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          success: boolean
          execution_time_ms: number
          cost: number
          model_used: string
          route_reason: string
          diff_size_lines: number
          test_duration_ms?: number | null
          failure_classes?: string[] | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          success?: boolean
          execution_time_ms?: number
          cost?: number
          model_used?: string
          route_reason?: string
          diff_size_lines?: number
          test_duration_ms?: number | null
          failure_classes?: string[] | null
          metadata?: Json | null
          created_at?: string
        }
      }
      cost_tracking: {
        Row: {
          id: string
          service_name: string
          cost: number
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          service_name: string
          cost: number
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          service_name?: string
          cost?: number
          metadata?: Json | null
          created_at?: string
        }
      }
      decision_logs: {
        Row: {
          id: string
          work_order_id: string | null
          decision_type: string
          decision_data: Json
          approved: boolean
          approved_by: string | null
          reasoning: string | null
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id?: string | null
          decision_type: string
          decision_data: Json
          approved?: boolean
          approved_by?: string | null
          reasoning?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string | null
          decision_type?: string
          decision_data?: Json
          approved?: boolean
          approved_by?: string | null
          reasoning?: string | null
          created_at?: string
        }
      }
      contracts: {
        Row: {
          id: string
          contract_type: 'api' | 'event' | 'domain' | 'ux' | 'nfr'
          name: string
          version: string
          specification: Json
          breaking_changes: Json | null
          validation_rules: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          contract_type: 'api' | 'event' | 'domain' | 'ux' | 'nfr'
          name: string
          version: string
          specification: Json
          breaking_changes?: Json | null
          validation_rules: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contract_type?: 'api' | 'event' | 'domain' | 'ux' | 'nfr'
          name?: string
          version?: string
          specification?: Json
          breaking_changes?: Json | null
          validation_rules?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      playbook_memory: {
        Row: {
          id: string
          pattern_name: string
          pattern_type: string
          prompts: Json
          fixes: Json | null
          confidence_score: number
          success_variations: Json | null
          usage_count: number
          last_used_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pattern_name: string
          pattern_type: string
          prompts: Json
          fixes?: Json | null
          confidence_score?: number
          success_variations?: Json | null
          usage_count?: number
          last_used_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pattern_name?: string
          pattern_type?: string
          prompts?: Json
          fixes?: Json | null
          confidence_score?: number
          success_variations?: Json | null
          usage_count?: number
          last_used_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}