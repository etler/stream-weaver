/**
 * Type test file - testing type-safe defineHandler
 * Run: cd demo && npx tsc --noEmit
 *
 * This file should have exactly 2 errors - the @ts-expect-error lines
 * for the invalid cases should be USED (meaning they catch real errors)
 */
import { defineSignal, defineLogic, defineHandler } from "stream-weaver";

// Create signals of different types
const numberSignal = defineSignal(0);
const stringSignal = defineSignal("hello");

// Create typed logic
const incrementLogic = defineLogic(import("./logic/increment"));

// ===== VALID CASES (should NOT error) =====
const validHandler = defineHandler(incrementLogic, [numberSignal]);

// ===== INVALID CASES (should error) =====
// @ts-expect-error - Type mismatch: string signal passed to handler expecting number
const invalidHandler = defineHandler(incrementLogic, [stringSignal]);

// Multiple signals - also invalid (one string where number expected)
// @ts-expect-error - Type mismatch in deps array
const invalidMultiple = defineHandler(incrementLogic, [stringSignal, numberSignal]);

export { validHandler, invalidHandler, invalidMultiple };
