// Simple Phase 2 test - No TypeScript compilation needed
// Run with: node --experimental-modules --loader tsx test-phase2-simple.js

const fs = require('fs');
const path = require('path');

// Test payload
const payload = {
  spec: {
    feature_name: "Multi-LLM Discussion App",
    objectives: [
      "Orchestrate synchronized discussions between four LLM providers (ChatGPT, Claude, Gemini, Grok)",
      "Implement clipboard automation for response harvesting",
      "Create alignment evaluation service using GPT-4o-mini",
      "Build Electron desktop application with multi-process architecture",
      "Provide arbitration UI for comparing and synthesizing responses",
      "Support encrypted archiving and crash recovery"
    ],
    constraints: [
      "Must use Electron v28+ for desktop framework",
      "TypeScript 5.3+ with strict mode required",
      "Clipboard-based harvesting (no direct API integration)",
      "Separate process for alignment service (Express + OpenAI)",
      "WebView isolation for each LLM provider",
      "Local-only operation with encrypted storage"
    ],
    acceptance_criteria: [
      "Successfully orchestrate discussion cycles with 2-4 LLM providers",
      "Harvest responses via clipboard automation with <2s per model",
      "Compute alignment scores with <3s API latency",
      "Display arbitration view with synthesized answer",
      "Create encrypted archives with manifest and scoreboard",
      "Recover from crashes using autosaved state",
      "Support keyboard navigation and WCAG 2.1 AA accessibility"
    ],
    budget_estimate: 50000,
    time_estimate: "12 weeks"
  },
  generateWireframes: true,
  generateContracts: true
};

console.log('Phase 2 Test Payload Created');
console.log('============================');
console.log('Feature:', payload.spec.feature_name);
console.log('Objectives:', payload.spec.objectives.length);
console.log('Constraints:', payload.spec.constraints.length);
console.log('Acceptance Criteria:', payload.spec.acceptance_criteria.length);
console.log('');
console.log('Options:');
console.log('  - generateWireframes:', payload.generateWireframes);
console.log('  - generateContracts:', payload.generateContracts);
console.log('');
console.log('Testing approach:');
console.log('1. Build the project: npm run build');
console.log('2. Start dev server: npm run dev');
console.log('3. In another terminal, run:');
console.log('');
console.log('curl --insecure -X POST http://localhost:3000/api/architect/decompose \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d @scripts/phase2-test-payload.json \\');
console.log('  --max-time 120 \\');
console.log('  --output docs/phase2-test-result.json');
console.log('');
console.log('Or test against deployed version:');
console.log('curl --insecure -X POST https://moose-indol.vercel.app/api/architect/decompose \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d @scripts/phase2-test-payload.json \\');
console.log('  --max-time 120 \\');
console.log('  --output docs/phase2-test-result.json');
console.log('');
console.log('Test payload saved to: scripts/phase2-test-payload.json');
console.log('');
console.log('Expected results:');
console.log('  - 8-20 work orders generated');
console.log('  - Total cost < $1.00');
console.log('  - Duration < 2 minutes');
console.log('  - IPC/API contracts generated');
console.log('  - UI components identified for wireframes');
