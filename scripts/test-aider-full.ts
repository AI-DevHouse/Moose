// Test Aider with full arguments like the orchestrator does

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function testAiderFull(): Promise<void> {
  console.log('Testing Aider with full execution arguments...\n');

  // 1. Create a test instruction file
  const instruction = `
Work Order ID: test-123
Title: Test Aider Execution

Description:
Add a simple comment to README.md

Files to modify:
- README.md

Instructions:
1. Add a comment "# Test comment" at the end of README.md
2. Commit the change
`.trim();

  const tmpDir = os.tmpdir();
  const instructionPath = path.join(tmpDir, 'test-aider-instruction.txt');
  fs.writeFileSync(instructionPath, instruction, 'utf-8');

  console.log(`✅ Created instruction file: ${instructionPath}\n`);

  // 2. Test with actual arguments
  return new Promise((resolve, reject) => {
    const args = [
      '-3.11',
      '-m',
      'aider',
      '--message-file', instructionPath,
      '--model', 'claude-sonnet-4-20250514',
      '--yes',
      '--auto-commits',
      'README.md'
    ];

    console.log('Command: py', args.join(' '));
    console.log('Working directory:', process.cwd());
    console.log('');

    const aiderProcess = spawn('py', args, {
      cwd: process.cwd(),
      env: process.env,
      timeout: 30000, // 30 seconds
      shell: true,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';

    aiderProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log('[stdout]', output);
    });

    aiderProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.log('[stderr]', output);
    });

    aiderProcess.on('close', (code) => {
      console.log(`\n========================================`);
      console.log(`Process exited with code: ${code}`);
      console.log(`stdout length: ${stdout.length}`);
      console.log(`stderr length: ${stderr.length}`);
      console.log(`========================================\n`);

      // Clean up
      try {
        fs.unlinkSync(instructionPath);
        console.log('✅ Cleaned up instruction file\n');
      } catch (e) {
        console.log('⚠️  Could not delete instruction file:', e);
      }

      if (code === 0) {
        console.log('✅ SUCCESS - Aider executed successfully\n');
        resolve();
      } else if (code === 3221225794) {
        console.log(`❌ REPRODUCED THE ERROR! Exit code: ${code} (0xC0000142)\n`);
        reject(new Error(`Exit code: ${code}`));
      } else {
        console.log(`❌ FAILED with different exit code: ${code}\n`);
        reject(new Error(`Exit code: ${code}`));
      }
    });

    aiderProcess.on('error', (error) => {
      console.log(`\n❌ ERROR: ${error.message}\n`);

      // Clean up
      try {
        fs.unlinkSync(instructionPath);
      } catch (e) {
        // Ignore
      }

      reject(error);
    });
  });
}

testAiderFull().catch((error) => {
  console.log('Test failed:', error.message);
  process.exit(1);
});
