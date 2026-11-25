import assert from "node:assert/strict";
import { createTracker } from "./fixtures.mjs";

export function createTestRunner({
  prisma,
  fixtures,
  baseUrl,
  verbose = false,
  filter = "",
}) {
  const results = [];
  const activeTrackers = new Set();
  const normalizedFilter = filter.trim().toLowerCase();

  function matchesFilter(testCase) {
    if (!normalizedFilter) return true;
    return (
      testCase.id.toLowerCase().includes(normalizedFilter) ||
      testCase.name.toLowerCase().includes(normalizedFilter) ||
      testCase.feature.toLowerCase().includes(normalizedFilter)
    );
  }

  function createCountedAssert() {
    let count = 0;
    const wrapped = {
      get count() {
        return count;
      },
      ok(value, message) {
        count++;
        return assert.ok(value, message);
      },
      equal(actual, expected, message) {
        count++;
        return assert.equal(actual, expected, message);
      },
      notEqual(actual, expected, message) {
        count++;
        return assert.notEqual(actual, expected, message);
      },
      deepEqual(actual, expected, message) {
        count++;
        return assert.deepEqual(actual, expected, message);
      },
      match(string, regexp, message) {
        count++;
        return assert.match(string, regexp, message);
      },
      doesNotMatch(string, regexp, message) {
        count++;
        return assert.doesNotMatch(string, regexp, message);
      },
      fail(message) {
        count++;
        return assert.fail(message);
      },
      async rejects(fn, error, message) {
        count++;
        return assert.rejects(fn, error, message);
      },
      includes(haystack, needle, message) {
        count++;
        assert.ok(
          Array.isArray(haystack)
            ? haystack.includes(needle)
            : String(haystack).includes(String(needle)),
          message || `Expected ${haystack} to include ${needle}`
        );
      },
      inSet(actual, allowed, message) {
        count++;
        const list = Array.isArray(allowed) ? allowed : [allowed];
        assert.ok(
          list.includes(actual),
          message || `Expected ${actual} to be in [${list.join(", ")}]`
        );
      },
    };
    return wrapped;
  }

  async function runCases(tierLabel, cases) {
    const tierResults = [];
    for (const testCase of cases) {
      if (!matchesFilter(testCase)) continue;

      const tracker = createTracker(prisma, fixtures.category.id);
      activeTrackers.add(tracker);
      const a = createCountedAssert();
      const notes = [];
      const startedAt = Date.now();
      let status = "PASS";
      let error = null;

      try {
        await testCase.run({
          baseUrl,
          prisma,
          fixtures,
          tracker,
          assert: a,
          note: (msg) => notes.push(msg),
        });
        if (a.count === 0) {
          throw new Error(
            `Test ${testCase.id} executed 0 assertions (facade tests are forbidden)`
          );
        }
      } catch (err) {
        status = "FAIL";
        error = err;
      } finally {
        try {
          await tracker.cleanup();
        } catch (cleanupErr) {
          status = "FAIL";
          error = error || cleanupErr;
        }
        activeTrackers.delete(tracker);
      }

      const durationMs = Date.now() - startedAt;
      const entry = {
        tier: tierLabel,
        id: testCase.id,
        feature: testCase.feature,
        name: testCase.name,
        status,
        assertions: a.count,
        durationMs,
        notes,
        error,
      };
      results.push(entry);
      tierResults.push(entry);

      const icon = status === "PASS" ? "PASS" : "FAIL";
      if (verbose || status === "FAIL") {
        console.log(
          `[${icon}] ${testCase.id} (${testCase.feature}) - ${testCase.name} [${a.count} asserts, ${durationMs}ms]`
        );
        if (notes.length > 0 && verbose) {
          for (const n of notes) console.log(`       note: ${n}`);
        }
        if (error) {
          console.error(`       error: ${error.stack || error.message || error}`);
        }
      } else {
        console.log(
          `[${icon}] ${testCase.id} - ${testCase.name} (${durationMs}ms)`
        );
      }
    }
    return tierResults;
  }

  async function cleanupAllActive() {
    for (const tracker of Array.from(activeTrackers)) {
      try {
        await tracker.cleanup();
      } catch {
        // best-effort on signal abort
      }
      activeTrackers.delete(tracker);
    }
  }

  function printSummary() {
    const byTier = new Map();
    for (const r of results) {
      if (!byTier.has(r.tier)) {
        byTier.set(r.tier, {
          total: 0,
          passed: 0,
          failed: 0,
          assertions: 0,
          durationMs: 0,
        });
      }
      const bucket = byTier.get(r.tier);
      bucket.total++;
      if (r.status === "PASS") bucket.passed++;
      else bucket.failed++;
      bucket.assertions += r.assertions;
      bucket.durationMs += r.durationMs;
    }

    console.log("\n=== TravelVN Member Retention E2E Summary ===");
    console.log(
      "Tier                     | Total | Pass | Fail | Assertions | Time(ms)"
    );
    console.log(
      "-------------------------+-------+------+------+------------+---------"
    );
    let grandTotal = 0;
    let grandPass = 0;
    let grandFail = 0;
    let grandAsserts = 0;
    let grandMs = 0;
    for (const [tier, s] of byTier.entries()) {
      grandTotal += s.total;
      grandPass += s.passed;
      grandFail += s.failed;
      grandAsserts += s.assertions;
      grandMs += s.durationMs;
      console.log(
        `${tier.padEnd(24)} | ${String(s.total).padStart(5)} | ${String(
          s.passed
        ).padStart(4)} | ${String(s.failed).padStart(4)} | ${String(
          s.assertions
        ).padStart(10)} | ${String(s.durationMs).padStart(7)}`
      );
    }
    console.log(
      "-------------------------+-------+------+------+------------+---------"
    );
    console.log(
      `${"TOTAL".padEnd(24)} | ${String(grandTotal).padStart(5)} | ${String(
        grandPass
      ).padStart(4)} | ${String(grandFail).padStart(4)} | ${String(
        grandAsserts
      ).padStart(10)} | ${String(grandMs).padStart(7)}`
    );

    const failures = results.filter((r) => r.status === "FAIL");
    if (failures.length > 0) {
      console.log("\n=== Failures ===");
      for (const f of failures) {
        console.log(
          `- ${f.id} (${f.name}): ${f.error?.message || String(f.error)}`
        );
      }
    }

    return {
      total: grandTotal,
      passed: grandPass,
      failed: grandFail,
    };
  }

  return {
    runCases,
    cleanupAllActive,
    printSummary,
    results,
  };
}
