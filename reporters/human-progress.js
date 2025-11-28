// Human-friendly progress reporter for Playwright
// Provides natural language updates, emojis, timing summaries, and preserves
// failure detail by not suppressing other reporters.
// Usage: add ['../reporters/human-progress.js'] (adjust path) to playwright.config.ts reporter array.

const path = require('path');

function color(code, text) { return `\u001b[${code}m${text}\u001b[0m`; }
const dim = (t) => color('2', t);
const green = (t) => color('32', t);
const red = (t) => color('31', t);
const yellow = (t) => color('33', t);
const cyan = (t) => color('36', t);
const magenta = (t) => color('35', t);

class HumanProgressReporter {
  constructor() {
    this.total = 0;
    this.startedAt = 0;
    this.projectCounts = new Map();
    this.results = [];
  }

  onBegin(config, suite) {
    // Count tests recursively
    const countTests = (s) => s.suites.reduce((acc, child) => acc + countTests(child), s.tests.length);
    this.total = countTests(suite);
    this.startedAt = Date.now();
    console.log(`\n🚀 Starting test run: ${cyan(String(this.total))} tests across ${cyan(String(config.projects.length))} projects`);
  }

  onTestBegin(test) {
    // Playwright provides project via function in newer versions; support both.
    const projInfo = typeof test.project === 'function' ? test.project() : test.project;
    const proj = projInfo && projInfo.name ? projInfo.name : 'project';
    const count = this.projectCounts.get(proj) || { started: 0, finished: 0 };
    count.started += 1;
    this.projectCounts.set(proj, count);
    const prefix = dim(`[${proj}]`);
    const name = `${test.parent.title} › ${test.title}`;
    console.log(`▶️  ${prefix} ${name}`);
  }

  onTestEnd(test, result) {
    const projInfo = typeof test.project === 'function' ? test.project() : test.project;
    const proj = projInfo && projInfo.name ? projInfo.name : 'project';
    const count = this.projectCounts.get(proj) || { started: 0, finished: 0 };
    count.finished += 1;
    this.projectCounts.set(proj, count);

    const durationMs = result.duration;
    const durationStr = dim(`${(durationMs / 1000).toFixed(2)}s`);
    const statusEmoji = result.status === 'passed' ? '✅' : (result.status === 'failed' ? '❌' : (result.status === 'skipped' ? '↪️' : '⚠️'));
    let statusColorFn = (x) => x;
    if (result.status === 'passed') statusColorFn = green;
    else if (result.status === 'failed') statusColorFn = red;
    else if (result.status === 'skipped') statusColorFn = cyan;
    else statusColorFn = yellow;

    const prefix = statusColorFn(statusEmoji);
    const name = `${test.parent.title} › ${test.title}`;
    // Capture for final summary
    this.results.push({ project: proj, status: result.status, duration: durationMs });

    // Minimal line
    console.log(`${prefix} ${dim('[' + proj + ']')} ${name} ${durationStr}`);

    if (result.status === 'failed') {
      // Show quick failure hint (full error still printed by other reporters)
      const err = result.error;
      if (err) {
        const msgLine = (err.message || '').split('\n')[0];
        console.log(`   ${red('•')} ${red(msgLine.substring(0, 160))}${msgLine.length > 160 ? '…' : ''}`);
      }
    }

    // Progress bar style summary inline (simple counters)
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const done = this.results.length;
    const pct = ((done / this.total) * 100).toFixed(1);
    console.log(dim(`   Progress: ${done}/${this.total} (${pct}%) • Passed: ${passed} • Failed: ${failed} • Skipped: ${skipped}`));
  }

  async onEnd() {
    const totalDuration = Date.now() - this.startedAt;
    const passed = this.results.filter(r => r.status === 'passed').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    const skipped = this.results.filter(r => r.status === 'skipped').length;
    const other = this.results.filter(r => !['passed','failed','skipped'].includes(r.status)).length;
    const statusBlock = [
      green(`Passed: ${passed}`),
      failed ? red(`Failed: ${failed}`) : null,
      skipped ? cyan(`Skipped: ${skipped}`) : null,
      other ? yellow(`Other: ${other}`) : null
    ].filter(Boolean).join(dim(' | '));

    // Group by project summary
    const byProject = {};
    for (const r of this.results) {
      byProject[r.project] = byProject[r.project] || { passed:0, failed:0, skipped:0, other:0 };
      byProject[r.project][r.status] !== undefined ? byProject[r.project][r.status]++ : byProject[r.project].other++;
    }
    console.log('\n' + magenta('──────────────── Final Summary ────────────────'));
    console.log(`🧪 Total: ${this.total} tests in ${(totalDuration/1000).toFixed(2)}s`);
    console.log(`📊 ${statusBlock}`);
    Object.entries(byProject).forEach(([proj, stats]) => {
      console.log(`   • ${proj}: ${green(stats.passed+'✓')} ${stats.failed?red(stats.failed+'✘'):''} ${stats.skipped?cyan(stats.skipped+'↪'):''}`.trim());
    });
    console.log(magenta('────────────────────────────────────────────────'));

    // Return void; other reporters (html, list) handle their own endings.
  }
}

module.exports = HumanProgressReporter;