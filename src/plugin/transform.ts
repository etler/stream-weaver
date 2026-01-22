import { parse } from "acorn";
import { walk } from "estree-walker";
import MagicString from "magic-string";
import type { Node, CallExpression, Literal } from "estree";
import { generateLogicId } from "./hash";
import type { TransformResult, LogicModuleInfo } from "./types";

/**
 * Function names that should have their import() arguments transformed
 */
const TARGET_FUNCTIONS = new Set([
  "createComputed",
  "createAction",
  "createHandler",
  "createComponent",
  "createLogic",
  "createClientLogic",
  "createServerLogic",
  "createWorkerLogic",
]);

/**
 * Extended node type with position info from acorn
 */
interface NodeWithPosition {
  start: number;
  end: number;
}

/**
 * Transform source code by finding and replacing import() expressions
 * in signal creation calls with LogicSignal objects
 *
 * @param code - Source code to transform
 * @param id - File path/ID for the source
 * @param resolvePath - Function to resolve import paths to absolute paths
 * @returns Transform result with code and discovered logic modules
 */
export function transformCode(
  code: string,
  id: string,
  resolvePath: (importPath: string, importer: string) => string | null,
): TransformResult {
  const logicModules: LogicModuleInfo[] = [];
  const ms = new MagicString(code);

  let ast: Node;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ast = parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true,
    }) as unknown as Node;
  } catch {
    // If parsing fails, return unchanged code
    return { code, logicModules };
  }

  walk(ast, {
    enter(node) {
      if (node.type !== "CallExpression") {
        return;
      }

      const callExpr = node as CallExpression;

      // Check if callee is one of our target functions
      if (callExpr.callee.type !== "Identifier") {
        return;
      }

      const { callee } = callExpr;
      if (!TARGET_FUNCTIONS.has(callee.name)) {
        return;
      }

      // Get the first argument
      const [firstArg] = callExpr.arguments;
      if (!firstArg) {
        return;
      }

      // Check if it's a dynamic import: import("...")
      if (firstArg.type === "ImportExpression") {
        const importExpr = firstArg;

        // Get the import source
        if (importExpr.source.type !== "Literal") {
          return;
        }

        const source = importExpr.source as Literal;
        if (typeof source.value !== "string") {
          return;
        }

        const importPath = source.value;
        const resolved = resolvePath(importPath, id);

        if (resolved === null || resolved === "") {
          return;
        }

        // Generate stable ID based on resolved path
        const logicId = generateLogicId(resolved);

        // Track this logic module
        logicModules.push({
          id: logicId,
          importPath,
          resolvedPath: resolved,
        });

        // Get node positions (acorn includes these)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const nodeWithPos = firstArg as unknown as NodeWithPosition;

        // Replace import("...") with a LogicSignal object literal
        // src: resolved absolute path for client-side loading via /@fs/
        // ssrSrc: original relative path for SSR loading via Vite
        const replacement = `{id:"${logicId}",kind:"logic",src:"${resolved}",ssrSrc:"${importPath}"}`;
        ms.overwrite(nodeWithPos.start, nodeWithPos.end, replacement);
      }
    },
  });

  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: true }),
    logicModules,
  };
}

/**
 * Transform source code with fallback metadata attachment
 * This handles cases where import() is assigned to a variable first
 *
 * @param code - Source code to transform
 * @param id - File path/ID for the source
 * @param resolvePath - Function to resolve import paths to absolute paths
 * @returns Transform result with code and discovered logic modules
 */
export function transformCodeWithFallback(
  code: string,
  id: string,
  resolvePath: (importPath: string, importer: string) => string | null,
): TransformResult {
  const logicModules: LogicModuleInfo[] = [];
  const ms = new MagicString(code);

  let ast: Node;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ast = parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      locations: true,
    }) as unknown as Node;
  } catch {
    return { code, logicModules };
  }

  walk(ast, {
    enter(node) {
      // Handle variable declarations with import expressions
      if (node.type === "VariableDeclarator") {
        const decl = node;

        if (decl.init?.type !== "ImportExpression") {
          return;
        }

        if (decl.id.type !== "Identifier") {
          return;
        }

        const importExpr = decl.init;
        if (importExpr.source.type !== "Literal") {
          return;
        }

        const source = importExpr.source as Literal;
        if (typeof source.value !== "string") {
          return;
        }

        const importPath = source.value;
        const resolved = resolvePath(importPath, id);

        if (resolved === null || resolved === "") {
          return;
        }

        const logicId = generateLogicId(resolved);

        // Attach __logicId metadata to the import expression
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const initWithPos = decl.init as unknown as NodeWithPosition;
        ms.overwrite(
          initWithPos.start,
          initWithPos.end,
          `Object.assign(import("${importPath}"),{__logicId:"${logicId}"})`,
        );

        logicModules.push({
          id: logicId,
          importPath,
          resolvedPath: resolved,
        });
      }

      // Handle CallExpression with direct import expressions
      if (node.type === "CallExpression") {
        const callExpr = node as CallExpression;

        if (callExpr.callee.type !== "Identifier") {
          return;
        }

        const { callee } = callExpr;
        if (!TARGET_FUNCTIONS.has(callee.name)) {
          return;
        }

        const [firstArg] = callExpr.arguments;
        if (!firstArg) {
          return;
        }

        // Handle direct import expressions
        if (firstArg.type === "ImportExpression") {
          const importExpr = firstArg;

          if (importExpr.source.type !== "Literal") {
            return;
          }

          const source = importExpr.source as Literal;
          if (typeof source.value !== "string") {
            return;
          }

          const importPath = source.value;
          const resolved = resolvePath(importPath, id);

          if (resolved === null || resolved === "") {
            return;
          }

          const logicId = generateLogicId(resolved);

          logicModules.push({
            id: logicId,
            importPath,
            resolvedPath: resolved,
          });

          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          const nodeWithPos = firstArg as unknown as NodeWithPosition;
          // src: resolved absolute path for client-side loading via /@fs/
          // ssrSrc: original relative path for SSR loading via Vite
          const replacement = `{id:"${logicId}",kind:"logic",src:"${resolved}",ssrSrc:"${importPath}"}`;
          ms.overwrite(nodeWithPos.start, nodeWithPos.end, replacement);
        }
      }
    },
  });

  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: true }),
    logicModules,
  };
}
