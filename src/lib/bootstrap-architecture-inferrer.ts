import type { TechnicalSpec, WorkOrder } from '../types/architect';

/**
 * Describes the inferred architecture from spec and work orders
 */
export interface InferredArchitecture {
  framework: 'react' | 'vue' | 'angular' | 'express' | 'nextjs' | 'electron' | 'node' | null;
  ui_library: boolean; // React/Vue/Angular detected
  needs_jsx: boolean;
  state_management: 'redux' | 'zustand' | 'mobx' | null;
  testing_framework: 'jest' | 'vitest' | 'mocha' | null;
  required_dependencies: string[]; // npm package names
  required_dev_dependencies: string[];
  tsconfig_settings: {
    jsx?: 'react' | 'react-jsx';
    paths?: Record<string, string[]>;
    baseUrl?: string;
    lib?: string[];
  };
}

/**
 * Infers project architecture from technical spec and generated work orders
 *
 * Uses keyword detection to identify frameworks, libraries, and dependencies
 * needed for the project.
 *
 * @param spec - Technical specification describing the feature
 * @param workOrders - Generated work orders from decomposition
 * @returns InferredArchitecture with framework, dependencies, and config
 */
export function inferArchitecture(
  spec: TechnicalSpec,
  workOrders: WorkOrder[]
): InferredArchitecture {
  // Combine all text from spec and work orders for keyword analysis
  const allText = [
    spec.feature_name,
    ...spec.objectives,
    ...spec.constraints,
    ...workOrders.map(wo => wo.title + ' ' + wo.description)
  ].join(' ').toLowerCase();

  // Framework detection (keywords in spec + WO descriptions)
  let framework: InferredArchitecture['framework'] = null;

  // Priority order matters - more specific frameworks first
  if (allText.includes('electron')) {
    framework = 'electron';
  } else if (allText.includes('next.js') || allText.includes('nextjs')) {
    framework = 'nextjs';
  } else if (allText.includes('react')) {
    framework = 'react';
  } else if (allText.includes('express')) {
    framework = 'express';
  } else if (allText.includes('vue')) {
    framework = 'vue';
  } else if (allText.includes('angular')) {
    framework = 'angular';
  } else if (allText.includes('node.js') || allText.includes('nodejs')) {
    framework = 'node';
  }

  // UI library detection
  const uiLibrary = framework ? ['react', 'vue', 'angular', 'nextjs', 'electron'].includes(framework) : false;

  // JSX detection
  const needsJsx = (framework ? ['react', 'nextjs'].includes(framework) : false) ||
                   allText.includes('jsx') ||
                   allText.includes('.tsx') ||
                   workOrders.some(wo =>
                     wo.files_in_scope?.some(f => f.endsWith('.tsx') || f.endsWith('.jsx'))
                   );

  // State management detection
  let stateManagement: InferredArchitecture['state_management'] = null;
  if (allText.includes('redux')) {
    stateManagement = 'redux';
  } else if (allText.includes('zustand')) {
    stateManagement = 'zustand';
  } else if (allText.includes('mobx')) {
    stateManagement = 'mobx';
  }

  // Testing framework detection
  let testingFramework: InferredArchitecture['testing_framework'] = null;
  if (allText.includes('vitest')) {
    testingFramework = 'vitest';
  } else if (allText.includes('jest')) {
    testingFramework = 'jest';
  } else if (allText.includes('mocha')) {
    testingFramework = 'mocha';
  }

  // Build dependency list based on detected frameworks
  const deps: string[] = [];
  const devDeps: string[] = ['typescript', '@types/node'];

  // Framework-specific dependencies
  if (framework === 'react' || framework === 'nextjs') {
    deps.push('react', 'react-dom');
    devDeps.push('@types/react', '@types/react-dom');
  }

  if (framework === 'nextjs') {
    deps.push('next');
  }

  if (framework === 'electron') {
    devDeps.push('electron');
    // Electron typically uses React or Vue for renderer
    if (allText.includes('react')) {
      deps.push('react', 'react-dom');
      devDeps.push('@types/react', '@types/react-dom');
    }
  }

  if (framework === 'express') {
    deps.push('express');
    devDeps.push('@types/express');
  }

  if (framework === 'vue') {
    deps.push('vue');
  }

  if (framework === 'angular') {
    deps.push('@angular/core', '@angular/common', '@angular/platform-browser');
  }

  // State management dependencies
  if (stateManagement === 'redux') {
    deps.push('@reduxjs/toolkit', 'react-redux');
    devDeps.push('@types/react-redux');
  } else if (stateManagement === 'zustand') {
    deps.push('zustand');
  } else if (stateManagement === 'mobx') {
    deps.push('mobx', 'mobx-react-lite');
  }

  // Testing framework dependencies
  if (testingFramework === 'jest') {
    devDeps.push('jest', '@types/jest', 'ts-jest');
  } else if (testingFramework === 'vitest') {
    devDeps.push('vitest');
  } else if (testingFramework === 'mocha') {
    devDeps.push('mocha', '@types/mocha', 'ts-node');
  }

  // Build tsconfig settings
  const tsconfigSettings: InferredArchitecture['tsconfig_settings'] = {};

  if (needsJsx) {
    tsconfigSettings.jsx = 'react-jsx';
    tsconfigSettings.lib = ['ES2020', 'DOM'];
  }

  // Check if any WO uses @/ path aliases
  const usesPathAliases = workOrders.some(wo =>
    wo.description.includes('@/') ||
    wo.files_in_scope?.some(f => f.includes('@/'))
  );

  if (usesPathAliases) {
    tsconfigSettings.paths = {
      '@/*': ['./src/*']
    };
    tsconfigSettings.baseUrl = '.';
  }

  return {
    framework,
    ui_library: uiLibrary,
    needs_jsx: needsJsx,
    state_management: stateManagement,
    testing_framework: testingFramework,
    required_dependencies: deps,
    required_dev_dependencies: devDeps,
    tsconfig_settings: tsconfigSettings
  };
}
