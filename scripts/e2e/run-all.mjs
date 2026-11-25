import {
  disconnectPrisma,
  discoverFixtures,
  getPrisma,
  snapshotStock,
  verifyStockSnapshot,
} from "./lib/fixtures.mjs";
import { createTestRunner } from "./lib/runner.mjs";
import { tier1Cases } from "./tiers/tier1-features.mjs";
import { tier2Cases } from "./tiers/tier2-boundaries.mjs";
import { tier3Cases } from "./tiers/tier3-cross-concurrency.mjs";
import { tier4Scenarios } from "./tiers/tier4-scenarios.mjs";
import { tier5Cases } from "./tiers/tier5-adversarial.mjs";

function parseArgs(argv) {
  const opts = {
    baseUrl: "http://localhost:3000",
    tiers: [1, 2, 3, 4, 5],
    filter: "",
    verbose: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (arg === "--verbose" || arg === "-v") {
      opts.verbose = true;
    } else if (arg.startsWith("--base-url=")) {
      opts.baseUrl = arg.slice("--base-url=".length).trim();
    } else if (arg.startsWith("--tier=")) {
      opts.tiers = arg
        .slice("--tier=".length)
        .split(",")
        .map((n) => Number(n.trim()))
        .filter((n) => [1, 2, 3, 4, 5].includes(n));
    } else if (arg.startsWith("--filter=")) {
      opts.filter = arg.slice("--filter=".length);
    } else {
      throw new Error(`Unknown CLI argument: ${arg}`);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`TravelVN Member Retention Suite — Opaque-Box E2E Runner

Usage:
  node scripts/e2e/run-all.mjs [options]

Options:
  --base-url=<url>     Target running Next.js server (default: http://localhost:3000)
  --tier=<1,2,3,4,5>   Comma-separated tiers to run (default: 1,2,3,4,5)
  --filter=<pattern>   Case-insensitive substring filter on test id, name, or feature
  --verbose, -v        Show per-test assertion counts, notes, and full stack traces
  --help, -h           Print this help text and exit 0
`);
}

async function verifyServerReachable(baseUrl) {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/client/auth/me`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  } catch (err) {
    throw new Error(
      `Cannot reach TravelVN server at ${baseUrl} (${err?.message || err}). Ensure the server is running before running E2E.`
    );
  }
  if (!res.ok) {
    throw new Error(
      `Server health probe GET ${url} returned HTTP ${res.status}`
    );
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (opts.tiers.length === 0) {
    throw new Error("No valid tiers selected (expected 1, 2, 3, 4, or 5)");
  }

  await verifyServerReachable(opts.baseUrl);

  const prisma = getPrisma();
  const stockBefore = await snapshotStock(prisma);
  const fixtures = await discoverFixtures(prisma);

  const runner = createTestRunner({
    prisma,
    fixtures,
    baseUrl: opts.baseUrl,
    verbose: opts.verbose,
    filter: opts.filter,
  });

  const onSignal = async (sig) => {
    console.error(`\nReceived ${sig}; running emergency DB cleanup...`);
    await runner.cleanupAllActive();
    await disconnectPrisma();
    process.exit(130);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  let exitCode = 0;
  try {
    console.log(
      `Running TravelVN Opaque-Box E2E Suite against ${opts.baseUrl} (tiers: ${opts.tiers.join(
        ","
      )}${opts.filter ? `, filter: "${opts.filter}"` : ""})`
    );

    if (opts.tiers.includes(1)) {
      console.log("\n--- Tier 1: Feature Coverage ---");
      await runner.runCases("Tier 1 (Features)", tier1Cases);
    }
    if (opts.tiers.includes(2)) {
      console.log("\n--- Tier 2: Boundary & Corner Cases ---");
      await runner.runCases("Tier 2 (Boundaries)", tier2Cases);
    }
    if (opts.tiers.includes(3)) {
      console.log("\n--- Tier 3: Cross-Feature & Concurrency ---");
      await runner.runCases("Tier 3 (Cross/Concurrency)", tier3Cases);
    }
    if (opts.tiers.includes(4)) {
      console.log("\n--- Tier 4: Real-World Scenarios ---");
      await runner.runCases("Tier 4 (Scenarios)", tier4Scenarios);
    }
    if (opts.tiers.includes(5)) {
      console.log("\n--- Tier 5: Adversarial & Security Hardening ---");
      await runner.runCases("Tier 5 (Adversarial)", tier5Cases);
    }

    const summary = runner.printSummary();
    if (summary.total === 0) {
      console.error("ERROR: 0 tests matched the selected tiers/filter.");
      exitCode = 1;
    } else if (summary.failed > 0) {
      exitCode = 1;
    }

    await verifyStockSnapshot(prisma, stockBefore);
    console.log("\nStock integrity check: PASSED (zero drift).");
  } catch (err) {
    console.error(`\nSuite fatal error: ${err?.stack || err}`);
    exitCode = 1;
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    await runner.cleanupAllActive();
    await disconnectPrisma();
  }

  process.exit(exitCode);
}

main().catch(async (err) => {
  console.error(err);
  await disconnectPrisma();
  process.exit(1);
});
