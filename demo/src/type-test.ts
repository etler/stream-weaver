/**
 * Type test file - testing type-safe createHandler
 * Run: cd demo && npx tsc --noEmit
 *
 * This file should have exactly 2 errors - the @ts-expect-error lines
 * for the invalid cases should be USED (meaning they catch real errors)
 */
import { createSignal, createLogic, createHandler } from "stream-weaver";

// Create signals of different types
const numberSignal = createSignal(0);
const stringSignal = createSignal("hello");

// Create typed logic
const incrementLogic = createLogic(import("./logic/increment"));

// ===== VALID CASES (should NOT error) =====
const validHandler = createHandler(incrementLogic, [numberSignal]);

// ===== INVALID CASES (should error) =====
// @ts-expect-error - Type mismatch: string signal passed to handler expecting number
const invalidHandler = createHandler(incrementLogic, [stringSignal]);

// Multiple signals - also invalid (one string where number expected)
// @ts-expect-error - Type mismatch in deps array
const invalidMultiple = createHandler(incrementLogic, [stringSignal, numberSignal]);

export { validHandler, invalidHandler, invalidMultiple };
