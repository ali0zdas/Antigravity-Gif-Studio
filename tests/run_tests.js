#!/usr/bin/env node

/**
 * Antigravity GIF Studio — Standalone E2E Test Runner
 * 
 * Supports executing all 4 tiers or targeted individual tiers,
 * with structured pass/fail reporting, clear assertion messages,
 * timing metrics, and non-zero exit code on failure.
 * 
 * Usage:
 *   node tests/run_tests.js              # Runs all tiers (1-4)
 *   node tests/run_tests.js --tier 1     # Runs only Tier 1 (Feature Coverage)
 *   node tests/run_tests.js --tier 2     # Runs only Tier 2 (Boundary & Corner)
 *   node tests/run_tests.js --tier 3     # Runs only Tier 3 (Combinations)
 *   node tests/run_tests.js --tier 4     # Runs only Tier 4 (Real-World)
 *   node tests/run_tests.js --filter F1  # Filter tests by substring
 *   node tests/run_tests.js --bail       # Stop on first failure
 */

'use strict';

const path = require('node:path');
const { runSuites, clearSuites, colors } = require('./harness.js');

const TIER_MAP = {
  1: {
    id: 1,
    name: 'Tier 1: Feature Coverage',
    file: 'tier1_features.test.js'
  },
  2: {
    id: 2,
    name: 'Tier 2: Boundary & Corner Cases',
    file: 'tier2_boundaries.test.js'
  },
  3: {
    id: 3,
    name: 'Tier 3: Cross-Feature Combinations',
    file: 'tier3_combinations.test.js'
  },
  4: {
    id: 4,
    name: 'Tier 4: Real-World Application Scenarios',
    file: 'tier4_realworld.test.js'
  },
  5: {
    id: 5,
    name: 'Tier 5: Adversarial Coverage Hardening',
    file: 'tier5_adversarial.test.js'
  },
  6: {
    id: 6,
    name: 'Tier 6: MCP Apps & Bug-Fix Regressions',
    file: 'tier6_mcp_app.test.js'
  }
};

function parseArgs(args) {
  const options = {
    tiers: [1, 2, 3, 4, 5, 6],
    filter: null,
    bail: false,
    verbose: true,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--bail' || arg === '-b') {
      options.bail = true;
    } else if (arg === '--tier' || arg === '-t') {
      const val = args[++i];
      if (val === 'all') {
        options.tiers = [1, 2, 3, 4, 5, 6];
      } else {
        const num = parseInt(val, 10);
        if (TIER_MAP[num]) {
          options.tiers = [num];
        } else {
          console.error(`${colors.red}Unknown tier: "${val}". Valid tiers: 1, 2, 3, 4, 5, 6, all${colors.reset}`);
          process.exit(1);
        }
      }
    } else if (/^tier[1-6]$/i.test(arg)) {
      const num = parseInt(arg.replace(/tier/i, ''), 10);
      options.tiers = [num];
    } else if (/^[1-6]$/.test(arg)) {
      options.tiers = [parseInt(arg, 10)];
    } else if (arg === '--filter' || arg === '-f') {
      options.filter = args[++i];
    }
  }

  return options;
}

function printHelp() {
  console.log(`
${colors.bright}${colors.cyan}Antigravity GIF Studio — Test Runner CLI${colors.reset}

${colors.bright}Usage:${colors.reset}
  node tests/run_tests.js [options] [tier]

${colors.bright}Options:${colors.reset}
  --tier, -t <1|2|3|4|5|all> Select test tier to execute (default: all)
  --filter, -f <pattern>     Run only tests matching pattern
  --bail, -b                 Abort immediately on first test failure
  --help, -h                 Show this help message

${colors.bright}Examples:${colors.reset}
  node tests/run_tests.js                Run entire 5-tier suite
  node tests/run_tests.js --tier 1       Run Tier 1 (Feature Coverage)
  node tests/run_tests.js tier2          Run Tier 2 (Boundaries)
  node tests/run_tests.js 3              Run Tier 3 (Combinations)
  node tests/run_tests.js --tier 5       Run Tier 5 (Adversarial Coverage)
  node tests/run_tests.js --filter F1    Run tests matching "F1"
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log(`${colors.bright}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  ANTIGRAVITY GIF STUDIO — STANDALONE E2E TEST SUITE RUNNER${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.dim}Runtime: Node.js ${process.version} | Platform: ${process.platform} (${process.arch})${colors.reset}`);
  console.log(`${colors.dim}Target Tiers: [${options.tiers.join(', ')}]${options.filter ? ` | Filter: "${options.filter}"` : ''}${colors.reset}\n`);

  const globalStart = Date.now();
  const tierReports = [];
  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;
  let grandSkipped = 0;
  const allFailures = [];

  for (const tierNum of options.tiers) {
    const tierConfig = TIER_MAP[tierNum];
    console.log(`\n${colors.bright}${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}  RUNNING ${tierConfig.name.toUpperCase()}${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}════════════════════════════════════════════════════════════════${colors.reset}`);

    clearSuites();

    // Dynamically require tier test file
    const tierFilePath = path.join(__dirname, tierConfig.file);
    try {
      // Clear require cache to allow clean re-runs if necessary
      delete require.cache[require.resolve(tierFilePath)];
      require(tierFilePath);
    } catch (err) {
      console.error(`${colors.red}✖ Failed to load ${tierConfig.file}:${colors.reset}`, err);
      tierReports.push({
        id: tierNum,
        name: tierConfig.name,
        total: 1,
        passed: 0,
        failed: 1,
        skipped: 0,
        durationMs: 0,
        loadError: err
      });
      grandTotal += 1;
      grandFailed += 1;
      allFailures.push({
        tier: tierConfig.name,
        suite: 'Module Loader',
        name: tierConfig.file,
        error: err
      });
      if (options.bail) break;
      continue;
    }

    const tierResult = await runSuites({
      filter: options.filter,
      bail: options.bail,
      verbose: options.verbose
    });

    tierReports.push({
      id: tierNum,
      name: tierConfig.name,
      ...tierResult
    });

    grandTotal += tierResult.total;
    grandPassed += tierResult.passed;
    grandFailed += tierResult.failed;
    grandSkipped += tierResult.skipped;

    tierResult.results.filter(r => r.status === 'fail').forEach(r => {
      allFailures.push({
        tier: tierConfig.name,
        name: r.name,
        error: r.error
      });
    });

    if (options.bail && tierResult.failed > 0) {
      console.log(`\n${colors.yellow}[BAIL] Stopping immediately on failure.${colors.reset}`);
      break;
    }
  }

  const globalDurationMs = Date.now() - globalStart;

  // Print Summary Table
  console.log(`\n\n${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}                    TEST EXECUTION SUMMARY                      ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}`);

  console.log(`${colors.dim}Tier Breakdown:${colors.reset}`);
  for (const report of tierReports) {
    const statusIcon = report.failed === 0 ? `${colors.green}✔ PASS${colors.reset}` : `${colors.red}✖ FAIL${colors.reset}`;
    console.log(
      `  ${statusIcon}  ${colors.bright}${report.name.padEnd(42)}${colors.reset} ` +
      `[Pass: ${colors.green}${report.passed}${colors.reset} | ` +
      `Fail: ${report.failed > 0 ? colors.red : colors.dim}${report.failed}${colors.reset} | ` +
      `Skip: ${report.skipped > 0 ? colors.yellow : colors.dim}${report.skipped}${colors.reset}] ` +
      `${colors.gray}(${report.durationMs}ms)${colors.reset}`
    );
  }

  console.log(`${colors.dim}────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(
    `  ${colors.bright}GRAND TOTAL:${colors.reset}   ` +
    `Total: ${grandTotal} | ` +
    `Passed: ${colors.green}${grandPassed}${colors.reset} | ` +
    `Failed: ${grandFailed > 0 ? colors.red + grandFailed : colors.dim + '0'}${colors.reset} | ` +
    `Skipped: ${grandSkipped > 0 ? colors.yellow + grandSkipped : colors.dim + '0'}${colors.reset} | ` +
    `Duration: ${(globalDurationMs / 1000).toFixed(2)}s`
  );
  console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════════════${colors.reset}`);

  // Detailed failure breakdown
  if (allFailures.length > 0) {
    console.log(`\n${colors.bright}${colors.red}Detailed Failures (${allFailures.length}):${colors.reset}`);
    allFailures.forEach((f, idx) => {
      console.log(`\n  ${colors.red}${idx + 1}) [${f.tier}] ${f.name}${colors.reset}`);
      const errLines = f.error && f.error.stack ? f.error.stack.split('\n').slice(0, 4) : [(f.error && f.error.message) || 'Unknown error'];
      errLines.forEach(l => console.log(`     ${colors.gray}${l}${colors.reset}`));
    });
  }

  if (grandFailed > 0) {
    console.log(`\n${colors.red}${colors.bright}Result: FAILED (${grandFailed} failed tests)${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bright}Result: PASSED (All tests passed cleanly)${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(`${colors.red}Fatal test runner error:${colors.reset}`, err);
  process.exit(1);
});
