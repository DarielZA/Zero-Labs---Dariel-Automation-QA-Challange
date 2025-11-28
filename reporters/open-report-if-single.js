const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Module-scoped tracking: timestamp of last lock clear to handle VS Code Test Explorer reusing Node process.
let lastLockClearTime = 0;
const lockPath = path.resolve(process.cwd(), '.pw-html-report-opened');

// Immediately clear any existing lock when this module loads (handles VS Code extension caching)
try {
  if (fs.existsSync(lockPath)) {
    fs.unlinkSync(lockPath);
    console.log('[reporter] cleared stale lock on module load');
  }
} catch {}

function openWithOsDefault(filePath) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🌐 OPENING HTML REPORT IN BROWSER`);
    console.log(`📁 File: ${filePath}`);
    console.log(`${'='.repeat(60)}\n`);
    
    if (process.platform === 'win32') {
      const { execSync } = require('child_process');
      // Try multiple methods to ensure visibility
      try {
        execSync(`powershell -Command "Start-Process '${filePath}'"`, { stdio: 'inherit' });
        console.log('✓ Browser open command executed successfully');
      } catch (err) {
        // Fallback: use cmd start
        execSync(`cmd /c start "" "${filePath}"`, { stdio: 'inherit' });
        console.log('✓ Browser open via fallback method');
      }
    } else if (process.platform === 'darwin') {
      spawn('open', [filePath], { shell: true });
    } else {
      spawn('xdg-open', [filePath], { shell: true });
    }
  } catch (err) {
    console.warn('❌ Failed to open browser:', err?.message || err);
    console.log(`\nℹ️  Manual open: npx playwright show-report\n`);
  }
}

class OpenReportIfSingle {
  constructor(options = {}) {
    this.options = options;
    this.testCount = 0;
    this.lockPath = lockPath; // Use module-scoped path
    this.totalTests = 0; // will be set in onBegin
    this.lockCleared = false; // Track if this instance cleared the lock
  }

  onTestEnd() {
    this.testCount += 1;
  }

  onBegin(config, suite) {
    // ALWAYS force-clear lock at the very start of any new test run
    // This ensures VS Code UI runs can open reports every time
    try {
      if (fs.existsSync(this.lockPath)) {
        fs.unlinkSync(this.lockPath);
        console.log('[reporter] force-cleared lock at onBegin');
      }
    } catch (e) {
      console.warn('[reporter] failed to clear lock:', e?.message);
    }

    // Count tests in this project suite
    const countTests = (s) => s.suites.reduce((acc, child) => acc + countTests(child), s.tests.length);
    this.totalTests = countTests(suite);

    // Update module timestamp
    lastLockClearTime = Date.now();
    this.lockCleared = true;
  }

  async onEnd() {
    try {
      // Log environment info for debugging VS Code UI issues
      console.log(`[reporter] onEnd called: CI=${process.env.CI}, testCount=${this.testCount}, totalTests=${this.totalTests}`);
      console.log(`[reporter] env check: VSCODE_PID=${process.env.VSCODE_PID}, TERM_PROGRAM=${process.env.TERM_PROGRAM}`);
      
      if (process.env.CI) return;

      // Decide whether to auto-open.
      // Always open unless running the entire suite (>8 tests) or explicitly disabled
      const isFullSuite = this.totalTests > 8;
      const forceOpen = process.env.OPEN_HTML_REPORT === '1';
      const forceSkip = process.env.OPEN_HTML_REPORT === '0';
      
      const shouldOpen = forceOpen || (!forceSkip && !isFullSuite);
      
      if (!shouldOpen) {
        console.log(`[reporter] skipping auto-open (testCount=${this.testCount}, totalTests=${this.totalTests}). Set OPEN_HTML_REPORT=1 to force.`);
        return;
      }

      console.log('[reporter] auto-open criteria met, proceeding...');

      // Wait briefly for HTML reporter to finish writing files (especially important for VS Code UI runs).
      await new Promise(resolve => setTimeout(resolve, 500));

      const reportDir = path.resolve(process.cwd(), 'playwright-report');
      const reportPath = path.join(reportDir, 'index.html');
      
      console.log(`[reporter] checking for report at: ${reportPath}`);
      
      // Retry check for report file (HTML reporter may still be writing).
      let reportExists = fs.existsSync(reportPath);
      if (!reportExists) {
        console.log('[reporter] report not found, waiting 1s...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        reportExists = fs.existsSync(reportPath);
      }
      
      if (!reportExists) {
        console.log('[reporter] HTML report not found; generating via show-report command');
        // Fallback: trigger Playwright's show-report which generates and serves the report
        try {
          const { spawn } = require('child_process');
          const autoCloseSeconds = 1;
          
          const showReport = spawn('npx', ['playwright', 'show-report'], {
            shell: true,
            stdio: 'pipe'
          });
          
          let serverStarted = false;
          
          // Monitor output for server start message
          showReport.stdout.on('data', (data) => {
            const output = data.toString();
            process.stdout.write(output);
            
            // Detect when server is ready
            if (output.includes('Serving HTML report') || output.includes('http://localhost')) {
              if (!serverStarted) {
                serverStarted = true;
                console.log(`\n⏱️  Auto-closing server in ${autoCloseSeconds} seconds...`);
                
                // Auto-kill after specified seconds
                setTimeout(() => {
                  console.log('\n⏰ Auto-closing report server...\n');
                  if (process.platform === 'win32') {
                    spawn('taskkill', ['/pid', showReport.pid, '/f', '/t'], { shell: true });
                  } else {
                    showReport.kill('SIGTERM');
                  }
                }, autoCloseSeconds * 1000);
              }
            }
          });
          
          showReport.stderr.on('data', (data) => {
            process.stderr.write(data.toString());
          });
          
          console.log('[reporter] launched show-report server with auto-close');
          return;
        } catch (err) {
          console.warn('[reporter] fallback show-report failed:', err?.message || err);
          return;
        }
      }

      console.log('[reporter] report file found, proceeding to open...');

      // Kill any existing playwright show-report servers
      if (process.platform === 'win32') {
        try {
          const { execSync } = require('child_process');
          execSync('taskkill /F /FI "WINDOWTITLE eq npx*show-report*" 2>nul', { stdio: 'ignore' });
          execSync('taskkill /F /FI "IMAGENAME eq node.exe" /FI "COMMANDLINE eq *show-report*" 2>nul', { stdio: 'ignore' });
        } catch {}
      }

      // For VS Code UI: just open directly, skip lock mechanism
      // The browser will only show one window anyway even if called multiple times
      console.log(`[reporter] opening HTML report (tests=${this.totalTests}, executed=${this.testCount})`);
      
      // Create a trigger file to signal VS Code extension if needed
      const triggerPath = path.resolve(process.cwd(), '.pw-open-report-trigger');
      try {
        fs.writeFileSync(triggerPath, Date.now().toString());
      } catch {}
      
      openWithOsDefault(reportPath);
      
      // Kill any show-report servers after opening (with delay to ensure browser opens first)
      setTimeout(() => {
        if (process.platform === 'win32') {
          try {
            const { exec } = require('child_process');
            exec('for /f "tokens=2" %a in (\'netstat -ano ^| findstr :9323\') do taskkill /F /PID %a 2>nul', { shell: true });
          } catch {}
        }
      }, 1000);
      
      // Clean up trigger file after 2 seconds
      setTimeout(() => {
        try {
          if (fs.existsSync(triggerPath)) fs.unlinkSync(triggerPath);
        } catch {}
      }, 2000);
    } catch (err) {
      console.warn('open-report-if-single reporter error:', err?.message || err);
      console.error(err);
    }
  }
}

module.exports = OpenReportIfSingle;
