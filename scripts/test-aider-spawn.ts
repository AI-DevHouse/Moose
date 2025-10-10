// Test Aider spawn with different configurations

import { spawn } from 'child_process';
import * as path from 'path';

async function testAiderSpawn(useShell: boolean): Promise<void> {
  console.log(`\n========================================`);
  console.log(`Testing Aider spawn with shell: ${useShell}`);
  console.log(`========================================\n`);

  return new Promise((resolve, reject) => {
    const args = ['-3.11', '-m', 'aider', '--version'];

    const options: any = {
      cwd: 'C:\\dev\\moose-mission-control',
      env: process.env,
      timeout: 10000
    };

    if (useShell) {
      options.shell = true;
      options.windowsHide = true;
    }

    console.log('Command: py', args.join(' '));
    console.log('Options:', JSON.stringify(options, null, 2));
    console.log('');

    const aiderProcess = spawn('py', args, options);

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
      console.log(`\nProcess exited with code: ${code}`);
      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);

      if (code === 0) {
        console.log('✅ SUCCESS\n');
        resolve();
      } else {
        console.log(`❌ FAILED with exit code: ${code}\n`);
        reject(new Error(`Exit code: ${code}`));
      }
    });

    aiderProcess.on('error', (error) => {
      console.log(`\n❌ ERROR: ${error.message}\n`);
      reject(error);
    });
  });
}

async function main() {
  console.log('Testing Aider spawn configurations...\n');

  // Test 1: Without shell (current implementation)
  try {
    await testAiderSpawn(false);
  } catch (error: any) {
    console.log(`Test 1 failed: ${error.message}`);
  }

  // Test 2: With shell (proposed fix)
  try {
    await testAiderSpawn(true);
  } catch (error: any) {
    console.log(`Test 2 failed: ${error.message}`);
  }

  console.log('\n========================================');
  console.log('All tests complete');
  console.log('========================================\n');
}

main();
