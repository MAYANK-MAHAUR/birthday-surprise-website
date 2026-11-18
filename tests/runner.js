#!/usr/bin/env node

/**
 * Master E2E Test Runner CLI for Canva Birthday Surprise Website
 * Usage:
 *   node tests/runner.js           # Run all 4 test tiers sequentially
 *   node tests/runner.js --tier=1  # Run Tier 1 (Core Feature Coverage)
 *   node tests/runner.js --tier=2  # Run Tier 2 (Boundary & Security)
 *   node tests/runner.js --tier=3  # Run Tier 3 (Cross-Feature Workflows)
 *   node tests/runner.js --tier=4  # Run Tier 4 (Real-World Scenarios)
 */

import { createStaticServer } from './server.js';
import { CDPDriver } from './cdp-driver.js';
import { runTier1Tests } from './tier1_feature_tests.js';
import { runTier2Tests } from './tier2_boundary_tests.js';
import { runTier3Tests } from './tier3_cross_feature_tests.js';
import { runTier4Tests } from './tier4_real_world_tests.js';

function parseTierArg() {
  const arg = process.argv.find(a => a.startsWith('--tier=') || a === '-t');
  if (!arg) return null;
  if (arg.startsWith('--tier=')) {
    return parseInt(arg.split('=')[1], 10);
  }
  const idx = process.argv.indexOf(arg);
  return parseInt(process.argv[idx + 1], 10);
}

async function main() {
  const targetTier = parseTierArg();
  const runnerStart = Date.now();

  console.log('\n======================================================================');
  console.log('       CANVA BIRTHDAY SURPRISE WEBSITE — E2E TEST RUNNER');
  console.log('======================================================================');
  console.log(` Target: ${targetTier ? `Tier ${targetTier} only` : 'All Tiers (1, 2, 3, 4)'}`);
  console.log(` Node.js: ${process.version} | OS: ${process.platform} (${process.arch})`);

  let staticServer = null;
  let cdp = null;
  const overallStats = {
    total: 0,
    passed: 0,
    failed: 0,
    duration: 0
  };

  try {
    // 1. Start zero-dependency static HTTP server
    staticServer = createStaticServer();
    const { baseUrl, port } = await staticServer.start();
    console.log(` Static HTTP Server active at: ${baseUrl} (Port: ${port})`);

    // 2. Launch headless Chrome via CDP
    console.log(' Spawning Headless Chrome and initializing CDP WebSocket client...');
    cdp = new CDPDriver();
    await cdp.launch();
    console.log(` Chrome CDP connected successfully on port ${cdp.port}\n`);

    // 3. Execute selected or all tiers
    const tiersToRun = targetTier
      ? [targetTier]
      : [1, 2, 3, 4];

    for (const tier of tiersToRun) {
      let stats = null;
      if (tier === 1) {
        stats = await runTier1Tests({ baseUrl, cdp });
      } else if (tier === 2) {
        stats = await runTier2Tests({ baseUrl, cdp });
      } else if (tier === 3) {
        stats = await runTier3Tests({ baseUrl, cdp });
      } else if (tier === 4) {
        stats = await runTier4Tests({ baseUrl, cdp });
      } else {
        console.warn(`[WARN] Unknown tier specified: ${tier}`);
        continue;
      }

      if (stats) {
        overallStats.total += stats.total;
        overallStats.passed += stats.passed;
        overallStats.failed += stats.failed;
      }
    }
  } catch (fatalError) {
    console.error('\n\x1b[31m[FATAL RUNNER ERROR]\x1b[0m', fatalError);
    overallStats.failed++;
  } finally {
    // Cleanup Chrome and HTTP server
    console.log(' Cleaning up test environment...');
    if (cdp) {
      await cdp.close();
      console.log('   Chrome CDP terminated and profile cleaned.');
    }
    if (staticServer) {
      await staticServer.stop();
      console.log('   Static HTTP server closed.');
    }
  }

  overallStats.duration = Date.now() - runnerStart;

  // Final Summary Banner
  console.log('\n======================================================================');
  console.log('                    FINAL TEST EXECUTION SUMMARY');
  console.log('======================================================================');
  console.log(`  Total Test Assertions: ${overallStats.total}`);
  console.log(`  Passed:                \x1b[32m${overallStats.passed}\x1b[0m`);
  console.log(`  Failed:                ${overallStats.failed > 0 ? `\x1b[31m${overallStats.failed}\x1b[0m` : `\x1b[32m0\x1b[0m`}`);
  console.log(`  Total Elapsed Time:    ${overallStats.duration}ms`);
  console.log('======================================================================');

  if (overallStats.failed === 0 && overallStats.total > 0) {
    console.log('  \x1b[32m✔ ALL TEST TIERS PASSED SUCCESSFULLY!\x1b[0m\n');
    process.exit(0);
  } else {
    console.log(`  \x1b[31m✖ TEST SUITE RUN COMPLETED WITH ${overallStats.failed} FAILURES\x1b[0m\n`);
    process.exit(1);
  }
}

main();
