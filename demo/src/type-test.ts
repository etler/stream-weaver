/**
 * Type test file - testing type-safe defineHandler with mutators
 * Run: cd demo && npx tsc --noEmit
 *
 * This file should have exactly 2 errors - the @ts-expect-error lines
 * for the invalid cases should be USED (meaning they catch real errors)
 */
import { defineSignal, defineLogic, defineHandler, defineMutator } from "stream-weaver";

// Create signals of different types
const numberSignal = defineSignal(0);
const stringSignal = defineSignal("hello");

// Create mutators for handler write access
const numberMutator = defineMutator(numberSignal);
const stringMutator = defineMutator(stringSignal);

// Create typed logic
const incrementLogic = defineLogic(import("./logic/increment"));

// ===== VALID CASES (should NOT error) =====
const validHandler = defineHandler(incrementLogic, [numberMutator]);

// ===== INVALID CASES (should error) =====
// @ts-expect-error - Type mismatch: string mutator passed to handler expecting number
const invalidHandler = defineHandler(incrementLogic, [stringMutator]);

// Multiple signals - also invalid (one string where number expected)
// @ts-expect-error - Type mismatch in deps array
const invalidMultiple = defineHandler(incrementLogic, [stringMutator, numberMutator]);

export { validHandler, invalidHandler, invalidMultiple };
