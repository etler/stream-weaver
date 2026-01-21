/**
 * JSON-compatible types for serializable values
 *
 * These types enforce that signal init values and serverside logic return values
 * are JSON-serializable, ensuring they can be transmitted between server and client.
 *
 * Based on TypeFest's JsonValue types.
 */

/**
 * Matches any valid JSON primitive value
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Matches a JSON object
 */
export type JsonObject = { [Key in string]: JsonValue };

/**
 * Matches a JSON array
 */
export type JsonArray = JsonValue[] | readonly JsonValue[];

/**
 * Matches any valid JSON value
 */
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * Alias for JSON-compatible types used throughout the Stream Weaver API
 *
 * Used for:
 * - StateSignal init values
 * - ComputedSignal init values
 * - ServerLogic return values
 */
export type Serializable = JsonValue;
