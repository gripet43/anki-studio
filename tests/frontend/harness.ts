// ============================================================================
// Anki Studio — Frontend Unit Suite Harness
// A tiny, dependency-free assertion wrapper (node:assert + section/test) so the
// suite reads like the existing `tests/test_frontend_bundle.mjs` gates and does
// not need vitest/jest/jsdom.
// ============================================================================

import { strict as assert } from 'node:assert';

interface Failure {
  name: string;
  error: unknown;
}

const failures: Failure[] = [];
let executed = 0;
let currentSection = '(top)';

export function section(name: string): void {
  currentSection = name;
}

export function test(name: string, fn: () => void): void {
  executed += 1;
  try {
    fn();
  } catch (error) {
    failures.push({ name: `${currentSection} › ${name}`, error });
  }
}

export function eq<T>(actual: T, expected: T, message?: string): void {
  assert.deepEqual(actual, expected, message);
}

export function equal<T>(actual: T, expected: T, message?: string): void {
  assert.equal(actual, expected, message);
}

export function ok(value: unknown, message?: string): void {
  assert.ok(value, message);
}

export function notEqual<T>(actual: T, expected: T, message?: string): void {
  assert.notEqual(actual as unknown, expected as unknown, message);
}

export function matches(value: string, pattern: RegExp, message?: string): void {
  assert.match(value, pattern, message);
}

export function doesNotMatch(value: string, pattern: RegExp, message?: string): void {
  assert.doesNotMatch(value, pattern, message);
}

export function throws(fn: () => unknown, message?: string): void {
  assert.throws(fn, message);
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || `${error.name}: ${error.message}`;
  }
  return String(error);
}

export function report(label = 'Anki Studio Frontend Unit Suite'): void {
  if (failures.length > 0) {
    console.error(`\n✗ [${label}] ${failures.length}/${executed} CHECKS FAILED\n`);
    for (const failure of failures) {
      console.error(`  [FAIL] ${failure.name}`);
      console.error(
        describeError(failure.error)
          .split('\n')
          .map((line) => `         ${line}`)
          .join('\n')
      );
      console.error('');
    }
    process.exitCode = 1;
    return;
  }
  console.log(`[${label}] ALL ${executed} CHECKS PASSED!`);
}
