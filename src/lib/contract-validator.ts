import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export type ContractType = 'api' | 'event' | 'domain' | 'ux' | 'nfr';

export interface Contract {
  id: string;
  contract_type: ContractType;
  name: string;
  version: string;
  specification: any;
  breaking_changes?: any;
  validation_rules: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ValidationResult {
  valid: boolean;
  breaking_changes: BreakingChange[];
  warnings: ValidationWarning[];
  recommendations: string[];
  confidence_score: number;
  pattern_hash: string;
  risk_assessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    mitigation_steps: string[];
  };
}

export interface BreakingChange {
  type: 'field_removal' | 'type_change' | 'endpoint_removal' | 'schema_change' | 'behavior_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  field_path: string;
  old_value: any;
  new_value: any;
  impact_description: string;
  migration_suggestion?: string;
  affected_consumers?: string[];
}

export interface ValidationWarning {
  type: 'deprecation' | 'style_violation' | 'performance_concern' | 'security_concern';
  severity: 'info' | 'warning' | 'error';
  message: string;
  field_path: string;
  suggestion?: string;
}

export interface DiffAnalysis {
  file_path: string;
  change_type: 'added' | 'modified' | 'removed';
  contract_impact: ContractImpact[];
  complexity_score: number;
}

export interface ContractImpact {
  contract_name: string;
  contract_type: ContractType;
  impact_level: 'none' | 'low' | 'medium' | 'high' | 'breaking';
  affected_fields: string[];
  backward_compatible: boolean;
}

export class ContractValidator {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase configuration');
    }
    
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }

  /**
   * Validates a contract against existing contracts to detect breaking changes
   */
  async validateContract(
    contractData: Partial<Contract>,
    existingVersion?: Contract
  ): Promise<ValidationResult> {
    try {
      const breakingChanges: BreakingChange[] = [];
      const warnings: ValidationWarning[] = [];
      const recommendations: string[] = [];

      // Generate pattern hash for pattern confidence tracking
      const patternHash = this.generatePatternHash(contractData);

      // Perform breaking change detection if we have an existing version
      if (existingVersion) {
        const changes = await this.detectBreakingChanges(existingVersion, contractData);
        breakingChanges.push(...changes);
      }

      // Validate against contract rules
      const ruleViolations = this.validateContractRules(contractData);
      warnings.push(...ruleViolations);

      // Generate recommendations
      const autoRecommendations = this.generateRecommendations(breakingChanges, warnings);
      recommendations.push(...autoRecommendations);

      // Calculate confidence score based on pattern recognition
      const confidenceScore = await this.calculateConfidenceScore(patternHash, contractData.contract_type);

      // Assess risk level
      const riskAssessment = this.assessRisk(breakingChanges, warnings);

      return {
        valid: breakingChanges.filter(bc => bc.severity === 'high' || bc.severity === 'critical').length === 0,
        breaking_changes: breakingChanges,
        warnings,
        recommendations,
        confidence_score: confidenceScore,
        pattern_hash: patternHash,
        risk_assessment: riskAssessment
      };

    } catch (error) {
      console.error('Contract validation failed:', error);
      throw new Error(`Contract validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyzes repository changes for contract violations
   */
  async analyzeRepositoryChanges(
    repositoryName: string,
    changes: DiffAnalysis[]
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Get active contracts for this repository
    const { data: contracts, error } = await this.supabase
      .from('contracts')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch contracts: ${error.message}`);
    }

    // Analyze each change against relevant contracts
    for (const change of changes) {
      const relevantContracts = this.identifyRelevantContracts(contracts || [], change);
      
      for (const contract of relevantContracts) {
        const validation = await this.validateChangeAgainstContract(change, contract);
        if (validation) {
          results.push(validation);
        }
      }
    }

    return results;
  }

  /**
   * Detects breaking changes between contract versions
   */
  private async detectBreakingChanges(
    oldContract: Contract,
    newContract: Partial<Contract>
  ): Promise<BreakingChange[]> {
    const changes: BreakingChange[] = [];

    if (!newContract.specification || !oldContract.specification) {
      return changes;
    }

    // Deep comparison of specifications
    const diffs = this.deepCompare(oldContract.specification, newContract.specification, '');

    for (const diff of diffs) {
      const breakingChange = this.classifyChange(diff, oldContract.contract_type);
      if (breakingChange) {
        changes.push(breakingChange);
      }
    }

    return changes;
  }

  /**
   * Deep comparison utility for detecting specification changes
   */
  private deepCompare(oldObj: any, newObj: any, path: string): any[] {
    const diffs: any[] = [];

    // Check for removed fields
    for (const key in oldObj) {
      if (!(key in newObj)) {
        diffs.push({
          type: 'removal',
          path: path ? `${path}.${key}` : key,
          oldValue: oldObj[key],
          newValue: undefined
        });
      } else if (typeof oldObj[key] === 'object' && typeof newObj[key] === 'object') {
        // Recursively check nested objects
        const nestedDiffs = this.deepCompare(oldObj[key], newObj[key], path ? `${path}.${key}` : key);
        diffs.push(...nestedDiffs);
      } else if (oldObj[key] !== newObj[key]) {
        diffs.push({
          type: 'modification',
          path: path ? `${path}.${key}` : key,
          oldValue: oldObj[key],
          newValue: newObj[key]
        });
      }
    }

    // Check for added fields
    for (const key in newObj) {
      if (!(key in oldObj)) {
        diffs.push({
          type: 'addition',
          path: path ? `${path}.${key}` : key,
          oldValue: undefined,
          newValue: newObj[key]
        });
      }
    }

    return diffs;
  }

  /**
   * Classifies a change as breaking or non-breaking
   */
  private classifyChange(diff: any, contractType: ContractType): BreakingChange | null {
    // API contract breaking change rules
    if (contractType === 'api') {
      if (diff.type === 'removal') {
        return {
          type: 'field_removal',
          severity: 'high',
          field_path: diff.path,
          old_value: diff.oldValue,
          new_value: diff.newValue,
          impact_description: `API field '${diff.path}' was removed, breaking existing clients`,
          migration_suggestion: `Deprecate field first, then remove in next major version`
        };
      }

      if (diff.type === 'modification' && this.isTypeChange(diff)) {
        return {
          type: 'type_change',
          severity: 'medium',
          field_path: diff.path,
          old_value: diff.oldValue,
          new_value: diff.newValue,
          impact_description: `API field '${diff.path}' type changed from ${typeof diff.oldValue} to ${typeof diff.newValue}`,
          migration_suggestion: `Consider creating new field with new type and deprecating old field`
        };
      }
    }

    // Event contract breaking change rules
    if (contractType === 'event') {
      if (diff.type === 'removal' && diff.path.includes('schema')) {
        return {
          type: 'schema_change',
          severity: 'high',
          field_path: diff.path,
          old_value: diff.oldValue,
          new_value: diff.newValue,
          impact_description: `Event schema field '${diff.path}' was removed`,
          migration_suggestion: `Maintain backward compatibility by keeping field optional`
        };
      }
    }

    return null; // Non-breaking change
  }

  /**
   * Validates contract against predefined rules
   */
  private validateContractRules(contractData: Partial<Contract>): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check required fields
    if (!contractData.name || !contractData.version || !contractData.specification) {
      warnings.push({
        type: 'style_violation',
        severity: 'error',
        message: 'Contract missing required fields (name, version, specification)',
        field_path: 'root',
        suggestion: 'Ensure all required fields are provided'
      });
    }

    // Version format validation
    if (contractData.version && !this.isValidSemanticVersion(contractData.version)) {
      warnings.push({
        type: 'style_violation',
        severity: 'warning',
        message: 'Contract version should follow semantic versioning (x.y.z)',
        field_path: 'version',
        suggestion: 'Use semantic versioning format like 1.2.3'
      });
    }

    return warnings;
  }

  /**
   * Generates recommendations based on analysis results
   */
  private generateRecommendations(
    breakingChanges: BreakingChange[],
    warnings: ValidationWarning[]
  ): string[] {
    const recommendations: string[] = [];

    if (breakingChanges.length > 0) {
      recommendations.push('Consider implementing backward compatibility measures');
      recommendations.push('Update API documentation to reflect breaking changes');
      recommendations.push('Plan migration timeline for affected consumers');
    }

    const criticalWarnings = warnings.filter(w => w.severity === 'error');
    if (criticalWarnings.length > 0) {
      recommendations.push('Address critical validation errors before deployment');
    }

    return recommendations;
  }

  /**
   * Calculates confidence score based on historical patterns
   */
  private async calculateConfidenceScore(patternHash: string, contractType?: ContractType): Promise<number> {
    try {
      const { data: patterns } = await this.supabase
        .from('pattern_confidence_scores')
        .select('*')
        .eq('pattern_hash', patternHash)
        .eq('work_order_type', contractType || 'api')
        .single();

      if (patterns) {
        const totalAttempts = patterns.success_count + patterns.failure_count;
        return totalAttempts > 0 ? patterns.success_count / totalAttempts : 0.5;
      }

      return 0.5; // Default confidence for new patterns
    } catch (error) {
      return 0.5; // Fallback confidence score
    }
  }

  /**
   * Assesses overall risk level
   */
  private assessRisk(breakingChanges: BreakingChange[], warnings: ValidationWarning[]): {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    mitigation_steps: string[];
  } {
    const factors: string[] = [];
    const mitigationSteps: string[] = [];

    const criticalBreaking = breakingChanges.filter(bc => bc.severity === 'critical').length;
    const highBreaking = breakingChanges.filter(bc => bc.severity === 'high').length;
    const criticalWarnings = warnings.filter(w => w.severity === 'error').length;

    if (criticalBreaking > 0 || criticalWarnings > 2) {
      factors.push('Critical breaking changes detected');
      mitigationSteps.push('Review all breaking changes before deployment');
      mitigationSteps.push('Implement backward compatibility layer');
      return { level: 'critical', factors, mitigation_steps: mitigationSteps };
    }

    if (highBreaking > 0 || criticalWarnings > 0) {
      factors.push('High-impact changes detected');
      mitigationSteps.push('Coordinate with affected teams');
      mitigationSteps.push('Plan phased rollout');
      return { level: 'high', factors, mitigation_steps: mitigationSteps };
    }

    if (breakingChanges.length > 0 || warnings.length > 3) {
      factors.push('Multiple contract violations');
      mitigationSteps.push('Address warnings before deployment');
      return { level: 'medium', factors, mitigation_steps: mitigationSteps };
    }

    return { level: 'low', factors: ['No significant contract violations'], mitigation_steps: [] };
  }

  // Utility methods
  private generatePatternHash(contractData: Partial<Contract>): string {
    const hashData = {
      type: contractData.contract_type,
      hasSpec: !!contractData.specification,
      hasRules: !!contractData.validation_rules
    };
    return Buffer.from(JSON.stringify(hashData)).toString('base64').substring(0, 16);
  }

  private isValidSemanticVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(version);
  }

  private isTypeChange(diff: any): boolean {
    return typeof diff.oldValue !== typeof diff.newValue;
  }

  private identifyRelevantContracts(contracts: Contract[], change: DiffAnalysis): Contract[] {
    // Simple implementation - can be enhanced with more sophisticated matching
    return contracts.filter(contract => {
      return change.file_path.includes('api') && contract.contract_type === 'api' ||
             change.file_path.includes('event') && contract.contract_type === 'event' ||
             change.file_path.includes('schema') && contract.contract_type === 'domain';
    });
  }

  private async validateChangeAgainstContract(
    change: DiffAnalysis,
    contract: Contract
  ): Promise<ValidationResult | null> {
    // This would contain logic to validate specific file changes against contract rules
    // For now, return null to indicate no violations found
    return null;
  }
}