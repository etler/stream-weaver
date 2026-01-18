import { describe, test, expect } from "vitest";
import * as path from "path";
import { transformCode, transformCodeWithFallback, generateLogicId, generateFileHash } from "@/plugin";

/**
 * Helper to resolve paths for testing
 */
function createResolver() {
  return (importPath: string, importer: string): string | null => {
    if (importPath.startsWith(".")) {
      const dir = path.dirname(importer);
      return path.resolve(dir, importPath);
    }
    return importPath;
  };
}

/**
 * Extract logic IDs from transformed code
 */
function extractLogicIds(code: string): string[] {
  const regex = /id:"(logic_[a-f0-9]+)"/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(code)) !== null) {
    const [, id] = match;
    if (id !== undefined) {
      matches.push(id);
    }
  }
  return matches;
}

describe("Milestone 10: Build Plugin for Logic Transformation", () => {
  describe("transformCode", () => {
    test("plugin recognizes and transforms createComputed pattern", () => {
      const input = `const doubled = createComputed(import("./double"), [count]);`;
      const importer = "/project/src/app.ts";

      const result = transformCode(input, importer, createResolver());

      expect(result.code).toContain('id:"logic_');
      expect(result.code).toContain('kind:"logic"');
      // src contains resolved absolute path for correct client-side resolution
      expect(result.code).toContain('src:"/project/src/double"');
      // ssrSrc contains original relative path for SSR loading
      expect(result.code).toContain('ssrSrc:"./double"');
      expect(result.code).not.toContain("import(");
      expect(result.logicModules.length).toBe(1);
    });

    test("plugin generates stable IDs for same module", () => {
      const input1 = `const c1 = createComputed(import("./double"), [x]);`;
      const input2 = `const c2 = createComputed(import("./double"), [y]);`;
      const importer = "/project/src/app.ts";

      const result1 = transformCode(input1, importer, createResolver());
      const result2 = transformCode(input2, importer, createResolver());

      const ids1 = extractLogicIds(result1.code);
      const ids2 = extractLogicIds(result2.code);
      const [id1] = ids1;
      const [id2] = ids2;

      expect(id1).toBe(id2); // Same module → same ID
    });

    test("different modules get different IDs", () => {
      const input = `
        const doubled = createComputed(import("./double"), [count]);
        const tripled = createComputed(import("./triple"), [count]);
      `;
      const importer = "/project/src/app.ts";

      const result = transformCode(input, importer, createResolver());

      const ids = extractLogicIds(result.code);
      expect(ids.length).toBe(2);
      expect(ids[0]).not.toBe(ids[1]); // Different modules → different IDs
    });

    test("plugin works with all addressable APIs", () => {
      const input = `
        const doubled = createComputed(import("./double"), [x]);
        const inc = createAction(import("./inc"), [x]);
        const handler = createHandler(import("./click"), [x]);
        const Card = createComponent(import("./Card"));
        const logic = createLogic(import("./logic"));
      `;
      const importer = "/project/src/app.ts";

      const result = transformCode(input, importer, createResolver());

      // All 5 should be transformed
      const ids = extractLogicIds(result.code);
      expect(ids.length).toBe(5);

      // Should not contain any import() calls
      expect(result.code).not.toMatch(/import\s*\(/);

      // All should have kind:"logic"
      expect(result.code.match(/kind:"logic"/g)?.length).toBe(5);
    });

    test("plugin preserves non-matching code", () => {
      const input = `
        const x = 1;
        const doubled = createComputed(import("./double"), [count]);
        const y = 2;
      `;
      const importer = "/project/src/app.ts";

      const result = transformCode(input, importer, createResolver());

      expect(result.code).toContain("const x = 1;");
      expect(result.code).toContain("const y = 2;");
    });

    test("plugin handles member expression callees (ignored)", () => {
      const input = `const doubled = obj.createComputed(import("./double"), [count]);`;
      const importer = "/project/src/app.ts";

      const result = transformCode(input, importer, createResolver());

      // Should not transform since callee is member expression, not identifier
      expect(result.code).toContain("import(");
      expect(result.logicModules.length).toBe(0);
    });

    test("plugin skips non-literal import sources", () => {
      const input = `const doubled = createComputed(import(dynamicPath), [count]);`;
      const importer = "/project/src/app.ts";

      const result = transformCode(input, importer, createResolver());

      // Should not transform since import source is not a literal
      expect(result.code).toContain("import(dynamicPath)");
      expect(result.logicModules.length).toBe(0);
    });

    test("plugin tracks logic module info", () => {
      const input = `const doubled = createComputed(import("./double"), [count]);`;
      const importer = "/project/src/app.ts";

      const result = transformCode(input, importer, createResolver());

      expect(result.logicModules.length).toBe(1);
      const [mod] = result.logicModules;
      expect(mod).toBeDefined();
      if (mod) {
        expect(mod.importPath).toBe("./double");
        expect(mod.resolvedPath).toBe("/project/src/double");
        expect(mod.id).toMatch(/^logic_[a-f0-9]+$/);
      }
    });
  });

  describe("transformCodeWithFallback", () => {
    test("plugin fallback attaches metadata to imports", () => {
      const input = `
        const doubleFn = import("./double");
        const doubled = createComputed(doubleFn, [count]);
      `;
      const importer = "/project/src/app.ts";

      const result = transformCodeWithFallback(input, importer, createResolver());

      // Should attach __logicId to import expression
      expect(result.code).toContain("__logicId");
      expect(result.code).toContain("Object.assign");
    });

    test("fallback also handles direct imports in calls", () => {
      const input = `const doubled = createComputed(import("./double"), [count]);`;
      const importer = "/project/src/app.ts";

      const result = transformCodeWithFallback(input, importer, createResolver());

      // Direct imports should still be transformed inline
      expect(result.code).toContain('id:"logic_');
      expect(result.code).toContain('kind:"logic"');
    });
  });

  describe("generateLogicId", () => {
    test("generates deterministic IDs", () => {
      const path1 = "/project/src/double.ts";
      const path2 = "/project/src/double.ts";

      expect(generateLogicId(path1)).toBe(generateLogicId(path2));
    });

    test("generates different IDs for different paths", () => {
      const path1 = "/project/src/double.ts";
      const path2 = "/project/src/triple.ts";

      expect(generateLogicId(path1)).not.toBe(generateLogicId(path2));
    });

    test("IDs have correct format", () => {
      const id = generateLogicId("/project/src/double.ts");

      expect(id).toMatch(/^logic_[a-f0-9]{8}$/);
    });
  });

  describe("generateFileHash", () => {
    test("generates consistent hash", () => {
      const pathToHash = "/project/src/double.ts";

      expect(generateFileHash(pathToHash)).toBe(generateFileHash(pathToHash));
    });

    test("hash is 8 characters", () => {
      const hash = generateFileHash("/project/src/double.ts");

      expect(hash.length).toBe(8);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe("manifest generation", () => {
    test("manifest maps IDs to public URLs", () => {
      const input = `
        const doubled = createComputed(import("./double"), [count]);
        const tripled = createComputed(import("./triple"), [count]);
      `;
      const importer = "/project/src/app.ts";

      const result = transformCode(input, importer, createResolver());

      // Simulate manifest generation
      const manifest: Record<string, { id: string; src: string; originalPath: string }> = {};
      const logicBasePath = "/@weaver/logic";

      for (const mod of result.logicModules) {
        const hash = generateFileHash(mod.resolvedPath);
        const basename = path.basename(mod.importPath, path.extname(mod.importPath));
        const publicUrl = `${logicBasePath}/${basename}-${hash}.js`;

        manifest[mod.id] = {
          id: mod.id,
          src: publicUrl,
          originalPath: mod.importPath,
        };
      }

      expect(Object.keys(manifest).length).toBe(2);

      // Check manifest structure
      for (const entry of Object.values(manifest)) {
        expect(entry.id).toMatch(/^logic_/);
        expect(entry.src).toMatch(/^\/@weaver\/logic\/[a-z]+-[a-f0-9]+\.js$/);
        expect(entry.originalPath).toMatch(/^\.\//);
      }
    });

    test("manifest enables server URL resolution", () => {
      const input = `const doubled = createComputed(import("./double"), [count]);`;
      const importer = "/project/src/app.ts";

      const result = transformCode(input, importer, createResolver());

      // Build manifest
      const manifest: Record<string, { id: string; src: string }> = {};
      for (const mod of result.logicModules) {
        const hash = generateFileHash(mod.resolvedPath);
        const basename = path.basename(mod.importPath, path.extname(mod.importPath));
        manifest[mod.id] = {
          id: mod.id,
          src: `/@weaver/logic/${basename}-${hash}.js`,
        };
      }

      // Server can resolve logic ID to public URL
      const [firstMod] = result.logicModules;
      expect(firstMod).toBeDefined();
      if (firstMod) {
        const logicId = firstMod.id;
        const manifestEntry = manifest[logicId];
        expect(manifestEntry).toBeDefined();
        if (manifestEntry) {
          const publicUrl = manifestEntry.src;
          expect(publicUrl).toMatch(/^\/@weaver\//);
          expect(publicUrl).toMatch(/\.js$/);
        }
      }
    });
  });

  describe("edge cases", () => {
    test("handles empty file", () => {
      const result = transformCode("", "/project/src/app.ts", createResolver());

      expect(result.code).toBe("");
      expect(result.logicModules.length).toBe(0);
    });

    test("handles invalid JavaScript gracefully", () => {
      const input = "const x = {";
      const result = transformCode(input, "/project/src/app.ts", createResolver());

      // Should return unchanged code when parsing fails
      expect(result.code).toBe(input);
      expect(result.logicModules.length).toBe(0);
    });

    test("handles nested function calls", () => {
      const input = `const doubled = someWrapper(createComputed(import("./double"), [count]));`;
      const importer = "/project/src/app.ts";

      const result = transformCode(input, importer, createResolver());

      // Should still find and transform the createComputed call
      expect(result.code).toContain('id:"logic_');
      expect(result.logicModules.length).toBe(1);
    });

    test("handles multiple calls on same line", () => {
      const input = `const a = createComputed(import("./a"), [x]); const b = createComputed(import("./b"), [y]);`;
      const importer = "/project/src/app.ts";

      const result = transformCode(input, importer, createResolver());

      const ids = extractLogicIds(result.code);
      expect(ids.length).toBe(2);
    });
  });
});
