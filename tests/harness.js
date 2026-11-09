/**
 * Antigravity GIF Studio — Standalone Test Harness
 * 
 * Provides zero-dependency BDD test functions (describe, it, test, hooks),
 * async lifecycle management, timeout enforcement, and structured reporting.
 */

'use strict';

const assert = require('node:assert/strict');

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m'
};

const suites = [];
let currentSuite = null;

class Suite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.beforeAllHooks = [];
    this.afterAllHooks = [];
    this.beforeEachHooks = [];
    this.afterEachHooks = [];
  }
}

class TestCase {
  constructor(name, fn, isSkipped = false, timeout = 20000) {
    this.name = name;
    this.fn = fn;
    this.isSkipped = isSkipped;
    this.timeout = timeout;
    this.status = 'pending';
    this.durationMs = 0;
    this.error = null;
  }
}

function describe(name, fn) {
  const suite = new Suite(name);
  suites.push(suite);
  const prevSuite = currentSuite;
  currentSuite = suite;
  try {
    fn();
  } finally {
    currentSuite = prevSuite;
  }
}

function it(name, fn, timeout = 20000) {
  if (!currentSuite) {
    describe('Default Suite', () => {
      currentSuite.tests.push(new TestCase(name, fn, false, timeout));
    });
    return;
  }
  currentSuite.tests.push(new TestCase(name, fn, false, timeout));
}

const test = it;

it.skip = function(name, fn) {
  if (!currentSuite) {
    describe('Default Suite', () => {
      currentSuite.tests.push(new TestCase(name, fn, true));
    });
    return;
  }
  currentSuite.tests.push(new TestCase(name, fn, true));
};
test.skip = it.skip;

function beforeAll(fn) {
  if (currentSuite) currentSuite.beforeAllHooks.push(fn);
}

function afterAll(fn) {
  if (currentSuite) currentSuite.afterAllHooks.push(fn);
}

function beforeEach(fn) {
  if (currentSuite) currentSuite.beforeEachHooks.push(fn);
}

function afterEach(fn) {
  if (currentSuite) currentSuite.afterEachHooks.push(fn);
}

async function runWithTimeout(fn, timeoutMs) {
  return new Promise((resolve, reject) => {
    let timer = null;
    let completed = false;

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          reject(new Error(`Test timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    }

    try {
      const res = fn();
      if (res && typeof res.then === 'function') {
        res.then(
          (val) => {
            if (!completed) {
              completed = true;
              if (timer) clearTimeout(timer);
              resolve(val);
            }
          },
          (err) => {
            if (!completed) {
              completed = true;
              if (timer) clearTimeout(timer);
              reject(err);
            }
          }
        );
      } else {
        completed = true;
        if (timer) clearTimeout(timer);
        resolve(res);
      }
    } catch (err) {
      completed = true;
      if (timer) clearTimeout(timer);
      reject(err);
    }
  });
}

function clearSuites() {
  suites.length = 0;
  currentSuite = null;
}

async function runSuites(options = {}) {
  const { filter = null, bail = false, verbose = true } = options;
  const startTime = Date.now();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;
  const results = [];

  for (const suite of suites) {
    let suitePrinted = false;

    // Run beforeAll hooks
    let beforeAllFailed = false;
    for (const hook of suite.beforeAllHooks) {
      try {
        await hook();
      } catch (err) {
        beforeAllFailed = true;
        console.error(`${colors.red}✖ beforeAll hook failed in "${suite.name}":${colors.reset}`, err);
        break;
      }
    }

    for (const testCase of suite.tests) {
      if (filter && !testCase.name.includes(filter) && !suite.name.includes(filter)) {
        continue;
      }

      totalTests++;

      if (!suitePrinted && verbose) {
        console.log(`\n${colors.bright}${colors.cyan}▶ ${suite.name}${colors.reset}`);
        suitePrinted = true;
      }

      if (testCase.isSkipped || beforeAllFailed) {
        testCase.status = 'skip';
        skippedTests++;
        if (verbose) {
          console.log(`  ${colors.yellow}○ [SKIP]${colors.reset} ${testCase.name}`);
        }
        results.push(testCase);
        continue;
      }

      // Run beforeEach hooks
      let beforeEachError = null;
      for (const hook of suite.beforeEachHooks) {
        try {
          await hook();
        } catch (err) {
          beforeEachError = err;
          break;
        }
      }

      if (beforeEachError) {
        testCase.status = 'fail';
        testCase.error = beforeEachError;
        failedTests++;
        if (verbose) {
          console.log(`  ${colors.red}✖ [FAIL]${colors.reset} ${testCase.name} (beforeEach error: ${beforeEachError.message})`);
        }
        results.push(testCase);
        if (bail) break;
        continue;
      }

      // Run test
      const testStart = Date.now();
      try {
        await runWithTimeout(testCase.fn, testCase.timeout);
        testCase.durationMs = Date.now() - testStart;
        testCase.status = 'pass';
        passedTests++;
        if (verbose) {
          console.log(`  ${colors.green}✔ [PASS]${colors.reset} ${testCase.name} ${colors.gray}(${testCase.durationMs}ms)${colors.reset}`);
        }
      } catch (err) {
        testCase.durationMs = Date.now() - testStart;
        testCase.status = 'fail';
        testCase.error = err;
        failedTests++;
        if (verbose) {
          console.log(`  ${colors.red}✖ [FAIL]${colors.reset} ${testCase.name} ${colors.gray}(${testCase.durationMs}ms)${colors.reset}`);
          const msg = err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : err.message;
          console.log(`    ${colors.red}${msg.split('\n').join('\n    ')}${colors.reset}`);
        }
        if (bail) break;
      }

      // Run afterEach hooks
      for (const hook of suite.afterEachHooks) {
        try {
          await hook();
        } catch (err) {
          console.error(`  ${colors.red}✖ afterEach error:${colors.reset}`, err.message);
        }
      }

      results.push(testCase);
    }

    // Run afterAll hooks
    for (const hook of suite.afterAllHooks) {
      try {
        await hook();
      } catch (err) {
        console.error(`${colors.red}✖ afterAll hook failed in "${suite.name}":${colors.reset}`, err);
      }
    }

    if (bail && failedTests > 0) break;
  }

  const totalDurationMs = Date.now() - startTime;
  return {
    total: totalTests,
    passed: passedTests,
    failed: failedTests,
    skipped: skippedTests,
    durationMs: totalDurationMs,
    success: failedTests === 0,
    results
  };
}

module.exports = {
  describe,
  it,
  test,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  assert,
  runSuites,
  clearSuites,
  colors
};
