import { execSync } from 'child_process';

async function testGitCommand() {
  const testPath = 'C:\\dev\\moose-mission-control';

  console.log('Testing git remote command...\n');
  console.log('Test directory:', testPath);
  console.log();

  // Test 1: Original approach (what was failing)
  console.log('Test 1: Original approach (stdio: pipe)');
  try {
    const result1 = execSync('git remote -v', {
      cwd: testPath,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    console.log('✅ Success!');
    console.log('Output:', result1);
  } catch (error: any) {
    console.log('❌ Failed!');
    console.log('Error message:', error.message);
    console.log('Stderr:', error.stderr?.toString());
    console.log('Stdout:', error.stdout?.toString());
  }
  console.log();

  // Test 2: With shell: true (my attempted fix)
  console.log('Test 2: With shell: true and windowsHide: true');
  try {
    const result2 = execSync('git remote -v', {
      cwd: testPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      windowsHide: true
    }).toString();
    console.log('✅ Success!');
    console.log('Output:', result2);
  } catch (error: any) {
    console.log('❌ Failed!');
    console.log('Error message:', error.message);
    console.log('Stderr:', error.stderr?.toString());
    console.log('Stdout:', error.stdout?.toString());
  }
  console.log();

  // Test 3: Try with full git path (if git is in PATH)
  console.log('Test 3: Check if git is in PATH');
  try {
    const gitVersion = execSync('git --version', {
      encoding: 'utf-8',
      stdio: 'pipe'
    }).toString();
    console.log('✅ Git found!');
    console.log('Version:', gitVersion.trim());
  } catch (error: any) {
    console.log('❌ Git not found in PATH!');
    console.log('Error:', error.message);
  }
}

testGitCommand().catch(console.error);
