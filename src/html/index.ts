/**
 * HTML utilities module
 *
 * Provides shared utilities for HTML generation across server and client.
 * This is the single source of truth for escaping, tag handling, and attribute normalization.
 */

export { escapeText, escapeAttribute } from "./escaping";
export { isSelfClosingTag } from "./tags";
export { normalizeAttributeName } from "./attributes";
export { serializeSignalDefinition } from "./signals";
export {
  renderNode,
  renderAttributes,
  registerSignalWithDeps,
  resolveSignalValue,
  type RenderOptions,
  type AttributeRenderResult,
} from "./render";
