# Module Expressions Implementation Plan

This document outlines the implementation plan for adding support for inline module expressions in Stream Weaver, inspired by the [TC39 Module Expressions proposal](https://github.com/tc39/proposal-module-expressions).

## Table of Contents

1. [Overview](#overview)
2. [Syntax Design](#syntax-design)
3. [File Extensions](#file-extensions)
4. [Architecture](#architecture)
5. [Volar Plugin](#volar-plugin)
6. [Vite Plugin](#vite-plugin)
7. [Type System Integration](#type-system-integration)
8. [Implementation Milestones](#implementation-milestones)
9. [Testing Strategy](#testing-strategy)

---

## Overview

### Problem

Currently, Stream Weaver logic modules must be defined in separate files:

```typescript
// increment.logic.ts
export default function increment(n: number): number {
  return n + 1;
}

// Counter.tsx
import { createSignal, createComputed, createLogic } from 'stream-weaver';

const incrementLogic = createLogic(import('./increment.logic.ts'));
const count = createSignal(0);
const next = createComputed(incrementLogic, [count]);
```

This separation:
- Fragments related code across multiple files
- Requires manual file management
- Breaks locality of behavior
- Makes refactoring harder

### Solution

Inline module expressions allow logic to be defined alongside components:

```typescript
// Counter.tim
import { createSignal, createComputed } from 'stream-weaver';

const incrementLogic = module {
  export default function increment(n: number): number {
    return n + 1;
  }
};

const count = createSignal(0);
const next = createComputed(incrementLogic, [count]);
```

### Goals

1. **Full TypeScript Support**: Complete type checking, inference, and IDE features inside module blocks
2. **Type Export**: Module block types flow to the outer scope
3. **IDE Integration**: Autocomplete, hover, go-to-definition, refactoring, error highlighting
4. **Build Integration**: Seamless Vite transformation to standard ES modules
5. **Source Maps**: Accurate debugging and error stack traces

---

## Syntax Design

### Module Block Syntax

```typescript
const identifier = module {
  // Full TypeScript/JavaScript module content
  // Supports all module-level declarations

  import { something } from 'other-module';

  export const value = 42;
  export type MyType = { foo: string };

  export default function(arg: Type): ReturnType {
    // implementation
  }
};
```

### Grammar

```
ModuleExpression:
  'module' '{' ModuleBody '}'

ModuleBody:
  ModuleItem*

ModuleItem:
  ImportDeclaration
  ExportDeclaration
  Statement
```

### Restrictions

1. Module blocks must be assigned to a `const` declaration
2. Module blocks cannot be nested
3. Module blocks cannot reference outer scope variables (they are isolated modules)
4. Top-level `await` is not supported in module blocks (could be added later)

### Examples

#### Basic Logic Module

```typescript
const double = module {
  export default function(n: number): number {
    return n * 2;
  }
};
```

#### With Imports

```typescript
const fetchUser = module {
  import { db } from '@/database';

  export default async function(id: string): Promise<User> {
    return await db.users.findById(id);
  }
};
```

#### With Type Exports

```typescript
const userModule = module {
  export interface User {
    id: string;
    name: string;
  }

  export default function createUser(name: string): User {
    return { id: crypto.randomUUID(), name };
  }
};

// Type is available in outer scope
type User = typeof userModule.exports.User;
```

#### Multiple Exports

```typescript
const mathModule = module {
  export function add(a: number, b: number): number {
    return a + b;
  }

  export function multiply(a: number, b: number): number {
    return a * b;
  }

  export default { add, multiply };
};
```

---

## File Extensions

Two file extensions are supported as aliases:

| Extension | Description | Use Case |
|-----------|-------------|----------|
| `.mod.ts` | Module TypeScript | Explicit, descriptive |
| `.tim` | TypeScript Inline Modules | Concise, memorable |

Both extensions are functionally identical. The `.mod.ts` extension follows the pattern of `.d.ts` for declarations, while `.tim` provides a unique, short identifier.

### JSX Variants

| Extension | Description |
|-----------|-------------|
| `.mod.tsx` | Module TypeScript with JSX |
| `.timx` | TypeScript Inline Modules with JSX |

### File Association

```jsonc
// .vscode/settings.json
{
  "files.associations": {
    "*.tim": "weaver",
    "*.timx": "weaver",
    "*.mod.ts": "weaver",
    "*.mod.tsx": "weaver"
  }
}
```

---

## Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Source File                              │
│                     (Counter.tim)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│     Volar Plugin        │     │        Vite Plugin              │
│   (IDE Experience)      │     │     (Build Transform)           │
└─────────────────────────┘     └─────────────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│  Virtual Documents      │     │   Transformed Output            │
│  - __main.tsx           │     │   - Counter.js                  │
│  - __mod0.ts            │     │   - Counter.__mod0.js           │
│  - __mod1.ts            │     │   - Counter.__mod1.js           │
└─────────────────────────┘     └─────────────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│  TypeScript Language    │     │   Browser / Node.js             │
│      Service            │     │      Runtime                    │
└─────────────────────────┘     └─────────────────────────────────┘
```

### Data Flow

1. **Source Parsing**: Custom parser extracts module blocks from source
2. **Virtual Document Generation**: Volar creates virtual `.ts` files for TypeScript
3. **Type Checking**: TypeScript analyzes virtual documents
4. **Position Mapping**: Errors/completions mapped back to original positions
5. **Build Transform**: Vite plugin extracts modules to real files
6. **Runtime**: Standard ES modules execute in browser/Node.js

---

## Volar Plugin

### Plugin Structure

```
volar-plugin-weaver/
├── package.json
├── src/
│   ├── index.ts              # Plugin entry point
│   ├── parser/
│   │   ├── index.ts          # Module block parser
│   │   ├── tokenizer.ts      # Lexical analysis
│   │   └── ast.ts            # AST types
│   ├── virtual/
│   │   ├── generator.ts      # Virtual document generation
│   │   ├── mainFile.ts       # Main file transformation
│   │   └── moduleFile.ts     # Module block extraction
│   ├── mapping/
│   │   ├── sourceMap.ts      # Position mapping
│   │   └── ranges.ts         # Range utilities
│   └── types/
│       ├── inference.ts      # Type inference for module blocks
│       └── exports.ts        # Export type extraction
└── tests/
```

### Language Plugin Implementation

```typescript
// volar-plugin-weaver/src/index.ts
import {
  type LanguagePlugin,
  type VirtualFile,
  FileCapabilities,
  FileKind,
  FileRangeCapabilities,
} from '@volar/language-core';
import { parseModuleBlocks, type ModuleBlock } from './parser';
import { generateMainFile } from './virtual/mainFile';
import { generateModuleFile } from './virtual/moduleFile';
import { createSourceMap } from './mapping/sourceMap';

export function createWeaverLanguagePlugin(): LanguagePlugin<WeaverFile> {
  return {
    // Identify weaver files by extension
    getLanguageId(uri) {
      if (
        uri.endsWith('.tim') ||
        uri.endsWith('.timx') ||
        uri.endsWith('.mod.ts') ||
        uri.endsWith('.mod.tsx')
      ) {
        return 'weaver';
      }
      return undefined;
    },

    // Create virtual files from weaver source
    createVirtualFile(uri, languageId, snapshot) {
      if (languageId !== 'weaver') return undefined;

      const content = snapshot.getText(0, snapshot.getLength());
      const parsed = parseModuleBlocks(content);

      return new WeaverFile(uri, snapshot, parsed);
    },

    // Update virtual files on change
    updateVirtualFile(weaverFile, snapshot) {
      const content = snapshot.getText(0, snapshot.getLength());
      const parsed = parseModuleBlocks(content);
      weaverFile.update(snapshot, parsed);
    },
  };
}

class WeaverFile implements VirtualFile {
  kind = FileKind.TextFile;
  capabilities = FileCapabilities.full;

  embeddedFiles: VirtualFile[] = [];
  mappings: Mapping[] = [];

  constructor(
    public uri: string,
    public snapshot: ts.IScriptSnapshot,
    private parsed: ParsedWeaverFile,
  ) {
    this.generateEmbeddedFiles();
  }

  update(snapshot: ts.IScriptSnapshot, parsed: ParsedWeaverFile) {
    this.snapshot = snapshot;
    this.parsed = parsed;
    this.generateEmbeddedFiles();
  }

  private generateEmbeddedFiles() {
    const isJsx = this.uri.endsWith('.timx') || this.uri.endsWith('.mod.tsx');
    const ext = isJsx ? '.tsx' : '.ts';

    this.embeddedFiles = [];
    this.mappings = [];

    // Generate main file (with module blocks replaced)
    const mainResult = generateMainFile(this.parsed, this.uri);
    this.embeddedFiles.push({
      uri: `${this.uri}.__main${ext}`,
      kind: FileKind.TypeScriptHostFile,
      snapshot: createSnapshot(mainResult.content),
      capabilities: FileCapabilities.full,
      mappings: mainResult.mappings,
      embeddedFiles: [],
    });

    // Generate virtual file for each module block
    this.parsed.moduleBlocks.forEach((block, index) => {
      const moduleResult = generateModuleFile(block, index);
      this.embeddedFiles.push({
        uri: `${this.uri}.__mod${index}${ext}`,
        kind: FileKind.TypeScriptHostFile,
        snapshot: createSnapshot(moduleResult.content),
        capabilities: FileCapabilities.full,
        mappings: moduleResult.mappings,
        embeddedFiles: [],
      });
    });
  }
}
```

### Parser Implementation

```typescript
// volar-plugin-weaver/src/parser/index.ts
import * as acorn from 'acorn';
import { walk } from 'estree-walker';

export interface ModuleBlock {
  /** Variable name the module is assigned to */
  name: string;
  /** Start offset of 'module {' */
  start: number;
  /** End offset of closing '}' */
  end: number;
  /** Start offset of module body (after '{') */
  bodyStart: number;
  /** End offset of module body (before '}') */
  bodyEnd: number;
  /** The module body content */
  body: string;
}

export interface ParsedWeaverFile {
  /** Original source content */
  source: string;
  /** Extracted module blocks */
  moduleBlocks: ModuleBlock[];
  /** Ranges that are not inside module blocks */
  outerRanges: Array<{ start: number; end: number }>;
}

export function parseModuleBlocks(source: string): ParsedWeaverFile {
  const moduleBlocks: ModuleBlock[] = [];

  // Custom tokenizer to find 'module {' patterns
  // We can't use standard acorn because 'module { }' isn't valid JS

  const modulePattern = /\bconst\s+(\w+)\s*=\s*module\s*\{/g;
  let match;

  while ((match = modulePattern.exec(source)) !== null) {
    const name = match[1];
    const bodyStart = match.index + match[0].length;

    // Find matching closing brace (accounting for nested braces)
    const bodyEnd = findMatchingBrace(source, bodyStart - 1);
    if (bodyEnd === -1) {
      throw new Error(`Unclosed module block for '${name}' at offset ${match.index}`);
    }

    moduleBlocks.push({
      name,
      start: match.index,
      end: bodyEnd + 1, // Include the closing brace
      bodyStart,
      bodyEnd,
      body: source.slice(bodyStart, bodyEnd),
    });
  }

  // Calculate outer ranges (parts not inside module blocks)
  const outerRanges = calculateOuterRanges(source.length, moduleBlocks);

  return { source, moduleBlocks, outerRanges };
}

function findMatchingBrace(source: string, openBraceIndex: number): number {
  let depth = 1;
  let i = openBraceIndex + 1;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let inComment = false;
  let inLineComment = false;

  while (i < source.length && depth > 0) {
    const char = source[i];
    const prevChar = source[i - 1];

    // Handle comments
    if (!inString && !inTemplate) {
      if (inLineComment) {
        if (char === '\n') inLineComment = false;
        i++;
        continue;
      }
      if (inComment) {
        if (char === '/' && prevChar === '*') inComment = false;
        i++;
        continue;
      }
      if (char === '/' && source[i + 1] === '/') {
        inLineComment = true;
        i += 2;
        continue;
      }
      if (char === '/' && source[i + 1] === '*') {
        inComment = true;
        i += 2;
        continue;
      }
    }

    // Handle strings
    if (!inComment && !inLineComment) {
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (inString && char === stringChar) {
          inString = false;
          if (char === '`') inTemplate = false;
        } else if (!inString) {
          inString = true;
          stringChar = char;
          if (char === '`') inTemplate = true;
        }
      }

      // Handle template literal interpolation
      if (inTemplate && char === '{' && prevChar === '$') {
        depth++;
      }
    }

    // Count braces
    if (!inString && !inComment && !inLineComment) {
      if (char === '{') depth++;
      else if (char === '}') depth--;
    }

    i++;
  }

  return depth === 0 ? i - 1 : -1;
}

function calculateOuterRanges(
  length: number,
  blocks: ModuleBlock[]
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let pos = 0;

  for (const block of blocks) {
    if (pos < block.start) {
      ranges.push({ start: pos, end: block.start });
    }
    pos = block.end;
  }

  if (pos < length) {
    ranges.push({ start: pos, end: length });
  }

  return ranges;
}
```

### Virtual Document Generation

```typescript
// volar-plugin-weaver/src/virtual/mainFile.ts
import type { ParsedWeaverFile, ModuleBlock } from '../parser';
import type { Mapping } from '@volar/language-core';

export interface GeneratedFile {
  content: string;
  mappings: Mapping[];
}

export function generateMainFile(
  parsed: ParsedWeaverFile,
  uri: string,
): GeneratedFile {
  let content = '';
  const mappings: Mapping[] = [];

  // Add type import for module block types
  content += `import type { ModuleExports } from 'stream-weaver';\n`;

  let outputOffset = content.length;
  let lastSourceEnd = 0;

  for (let i = 0; i < parsed.moduleBlocks.length; i++) {
    const block = parsed.moduleBlocks[i];

    // Copy content before this module block
    const before = parsed.source.slice(lastSourceEnd, block.start);
    content += before;

    // Add mapping for the copied content
    mappings.push({
      sourceRange: [lastSourceEnd, block.start],
      generatedRange: [outputOffset, outputOffset + before.length],
      data: FileRangeCapabilities.full,
    });
    outputOffset += before.length;

    // Replace module block with typed import
    // const name = module { ... }
    // becomes:
    // const name = __createModuleSignal<typeof import('./file.__mod0.ts')>('./file.__mod0.ts')
    const replacement = generateModuleReplacement(uri, block, i);
    content += replacement;

    // Map the variable name
    const varNameStart = block.start + 'const '.length;
    const varNameEnd = varNameStart + block.name.length;
    mappings.push({
      sourceRange: [varNameStart, varNameEnd],
      generatedRange: [
        outputOffset + 'const '.length,
        outputOffset + 'const '.length + block.name.length,
      ],
      data: FileRangeCapabilities.full,
    });

    outputOffset += replacement.length;
    lastSourceEnd = block.end;
  }

  // Copy remaining content after last module block
  const remaining = parsed.source.slice(lastSourceEnd);
  content += remaining;
  mappings.push({
    sourceRange: [lastSourceEnd, parsed.source.length],
    generatedRange: [outputOffset, outputOffset + remaining.length],
    data: FileRangeCapabilities.full,
  });

  return { content, mappings };
}

function generateModuleReplacement(
  uri: string,
  block: ModuleBlock,
  index: number,
): string {
  const modulePath = `./${getBasename(uri)}.__mod${index}`;

  // Generate a typed reference that preserves the module's type
  return `const ${block.name} = __createModuleSignal<typeof import('${modulePath}')>('${modulePath}')`;
}

function getBasename(uri: string): string {
  return uri.split('/').pop() || uri;
}
```

```typescript
// volar-plugin-weaver/src/virtual/moduleFile.ts
import type { ModuleBlock } from '../parser';
import type { Mapping } from '@volar/language-core';

export interface GeneratedFile {
  content: string;
  mappings: Mapping[];
}

export function generateModuleFile(
  block: ModuleBlock,
  index: number,
): GeneratedFile {
  // The module file is just the body content as a standalone module
  const content = block.body;

  // Create 1:1 mapping from virtual file to source positions
  const mappings: Mapping[] = [{
    sourceRange: [block.bodyStart, block.bodyEnd],
    generatedRange: [0, content.length],
    data: FileRangeCapabilities.full,
  }];

  return { content, mappings };
}
```

### Type Inference

```typescript
// volar-plugin-weaver/src/types/inference.ts
/**
 * Type utilities for module blocks
 *
 * A module block expression:
 *   const foo = module { export default function(n: number): string { ... } };
 *
 * Should have type:
 *   LogicSignal<(n: number) => string>
 *
 * With access to all exports:
 *   typeof foo.exports.default  // (n: number) => string
 */

// This type is provided by stream-weaver runtime
declare global {
  function __createModuleSignal<T>(path: string): ModuleSignal<T>;

  interface ModuleSignal<T> {
    readonly id: string;
    readonly kind: 'logic';
    readonly src: string;
    readonly exports: T;
  }
}
```

### VSCode Extension

```typescript
// vscode-weaver/src/extension.ts
import * as vscode from 'vscode';
import * as path from 'path';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('dist', 'server.js')
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'weaver' },
      { scheme: 'file', pattern: '**/*.tim' },
      { scheme: 'file', pattern: '**/*.timx' },
      { scheme: 'file', pattern: '**/*.mod.ts' },
      { scheme: 'file', pattern: '**/*.mod.tsx' },
    ],
  };

  client = new LanguageClient(
    'weaverLanguageServer',
    'Weaver Language Server',
    serverOptions,
    clientOptions
  );

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) return undefined;
  return client.stop();
}
```

---

## Vite Plugin

### Plugin Implementation

```typescript
// vite-plugin-weaver-modules/src/index.ts
import type { Plugin, ResolvedConfig } from 'vite';
import { parseModuleBlocks, type ModuleBlock } from './parser';
import MagicString from 'magic-string';
import path from 'path';

export interface WeaverModulesOptions {
  /** Additional file extensions to process */
  extensions?: string[];
}

export function weaverModulesPlugin(options: WeaverModulesOptions = {}): Plugin {
  const extensions = [
    '.tim',
    '.timx',
    '.mod.ts',
    '.mod.tsx',
    ...(options.extensions || []),
  ];

  let config: ResolvedConfig;
  const moduleRegistry = new Map<string, ModuleBlock[]>();

  return {
    name: 'vite-plugin-weaver-modules',

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    // Handle virtual module resolution
    resolveId(id, importer) {
      // Handle __mod{n} virtual imports
      const modMatch = id.match(/^(.+)\.__mod(\d+)(\.tsx?)?$/);
      if (modMatch && importer) {
        const [, basePath, index] = modMatch;
        const resolvedBase = path.resolve(path.dirname(importer), basePath);
        return `\0virtual:weaver-module:${resolvedBase}:${index}`;
      }
      return null;
    },

    // Load virtual module content
    load(id) {
      if (id.startsWith('\0virtual:weaver-module:')) {
        const [, , filePath, indexStr] = id.split(':');
        const index = parseInt(indexStr, 10);
        const blocks = moduleRegistry.get(filePath);

        if (blocks && blocks[index]) {
          return blocks[index].body;
        }

        throw new Error(`Module block ${index} not found for ${filePath}`);
      }
      return null;
    },

    // Transform weaver files
    transform(code, id) {
      const ext = extensions.find(e => id.endsWith(e));
      if (!ext) return null;

      const parsed = parseModuleBlocks(code);
      if (parsed.moduleBlocks.length === 0) return null;

      // Store module blocks for virtual module resolution
      moduleRegistry.set(id, parsed.moduleBlocks);

      const s = new MagicString(code);
      const basename = path.basename(id);

      // Transform each module block
      for (let i = parsed.moduleBlocks.length - 1; i >= 0; i--) {
        const block = parsed.moduleBlocks[i];

        // Replace: const name = module { ... }
        // With:    const name = createLogic(import('./${basename}.__mod${i}'))
        const replacement =
          `const ${block.name} = createLogic(import('./${basename}.__mod${i}'))`;

        s.overwrite(block.start, block.end, replacement);
      }

      // Add createLogic import if not present
      if (!code.includes('createLogic')) {
        s.prepend(`import { createLogic } from 'stream-weaver';\n`);
      }

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      };
    },

    // Generate module files during build
    generateBundle(options, bundle) {
      for (const [filePath, blocks] of moduleRegistry) {
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          const fileName = `${path.basename(filePath)}.__mod${i}.js`;

          this.emitFile({
            type: 'chunk',
            id: `\0virtual:weaver-module:${filePath}:${i}`,
            name: fileName,
          });
        }
      }
    },
  };
}
```

### HMR Support

```typescript
// vite-plugin-weaver-modules/src/hmr.ts
import type { Plugin, HmrContext } from 'vite';

export function handleHMR(ctx: HmrContext) {
  const { file, modules, server } = ctx;

  // Check if this is a weaver file
  if (!isWeaverFile(file)) return;

  // Find all virtual modules that depend on this file
  const virtualModules = Array.from(server.moduleGraph.idToModuleMap.entries())
    .filter(([id]) => id.includes(file) && id.includes('.__mod'))
    .map(([, mod]) => mod);

  // Invalidate virtual modules
  for (const mod of virtualModules) {
    server.moduleGraph.invalidateModule(mod);
  }

  // Return affected modules for HMR
  return [...modules, ...virtualModules];
}

function isWeaverFile(file: string): boolean {
  return (
    file.endsWith('.tim') ||
    file.endsWith('.timx') ||
    file.endsWith('.mod.ts') ||
    file.endsWith('.mod.tsx')
  );
}
```

---

## Type System Integration

### Module Signal Type

```typescript
// stream-weaver/src/signals/types.ts

/**
 * A signal representing an inline module expression
 *
 * @template T - The module's export type (typeof import('./module'))
 */
export interface ModuleSignal<T = unknown> extends Signal {
  kind: 'logic';
  /** Client-side module URL */
  src: string;
  /** Server-side module path */
  ssrSrc: string;
  /** Module exports (available after load) */
  exports: T;
}

/**
 * Extract the default export type from a module signal
 */
export type ModuleDefault<T> = T extends { default: infer D } ? D : never;

/**
 * Extract a named export type from a module signal
 */
export type ModuleExport<T, K extends keyof T> = T[K];
```

### Type Inference Example

```typescript
// Counter.tim
const increment = module {
  export default function(n: number): number {
    return n + 1;
  }

  export function decrement(n: number): number {
    return n - 1;
  }
};

// TypeScript sees:
// const increment: ModuleSignal<{
//   default: (n: number) => number;
//   decrement: (n: number) => number;
// }>

// Usage with full type safety:
const count = createSignal(0);
const next = createComputed(increment, [count]);
// next is typed as ComputedSignal<number>

// Access to named exports:
type DecrementFn = typeof increment.exports.decrement;
// DecrementFn = (n: number) => number
```

---

## Implementation Milestones

### M1: Parser Foundation

**Goal**: Robust parsing of module block syntax

**Tasks**:
1. Implement tokenizer for `module {` detection
2. Implement brace matching with string/comment handling
3. Build AST for parsed weaver files
4. Handle edge cases (nested braces, template literals)
5. Error reporting with source positions

**Test Criteria**:
```typescript
test('parses single module block', () => {
  const result = parseModuleBlocks(`
    const foo = module {
      export default function() {}
    };
  `);
  expect(result.moduleBlocks).toHaveLength(1);
  expect(result.moduleBlocks[0].name).toBe('foo');
});

test('parses multiple module blocks', () => {
  const result = parseModuleBlocks(`
    const a = module { export default 1; };
    const b = module { export default 2; };
  `);
  expect(result.moduleBlocks).toHaveLength(2);
});

test('handles nested braces in module body', () => {
  const result = parseModuleBlocks(`
    const foo = module {
      export default function() {
        if (true) { return { a: 1 }; }
      }
    };
  `);
  expect(result.moduleBlocks[0].body).toContain('if (true)');
});

test('handles strings containing braces', () => {
  const result = parseModuleBlocks(`
    const foo = module {
      export default "{not a brace}";
    };
  `);
  expect(result.moduleBlocks).toHaveLength(1);
});
```

**Deliverable**: `@stream-weaver/parser` package

---

### M2: Vite Plugin Basic Transform

**Goal**: Transform module blocks to importable modules

**Tasks**:
1. Set up Vite plugin structure
2. Implement module block extraction
3. Generate virtual modules for each block
4. Transform source to use dynamic imports
5. Source map generation

**Test Criteria**:
```typescript
test('transforms module block to import', async () => {
  const result = await transform(`
    const inc = module {
      export default (n: number) => n + 1;
    };
  `);
  expect(result.code).toContain('createLogic(import(');
  expect(result.code).not.toContain('module {');
});

test('virtual module contains block body', async () => {
  const plugin = weaverModulesPlugin();
  // ... setup
  const virtualContent = await plugin.load('\0virtual:weaver-module:test.tim:0');
  expect(virtualContent).toContain('export default');
});
```

**Deliverable**: `vite-plugin-weaver-modules` package

---

### M3: Volar Plugin Structure

**Goal**: IDE language support foundation

**Tasks**:
1. Set up Volar plugin project
2. Implement language ID detection for extensions
3. Create WeaverFile class
4. Generate basic virtual documents
5. Set up position mappings

**Test Criteria**:
```typescript
test('identifies weaver files', () => {
  const plugin = createWeaverLanguagePlugin();
  expect(plugin.getLanguageId('test.tim')).toBe('weaver');
  expect(plugin.getLanguageId('test.mod.ts')).toBe('weaver');
  expect(plugin.getLanguageId('test.ts')).toBeUndefined();
});

test('creates virtual files', () => {
  const plugin = createWeaverLanguagePlugin();
  const file = plugin.createVirtualFile('test.tim', 'weaver', snapshot);
  expect(file.embeddedFiles.length).toBeGreaterThan(0);
});
```

**Deliverable**: `@volar/plugin-weaver` package structure

---

### M4: Virtual Document Generation

**Goal**: Generate type-safe virtual documents

**Tasks**:
1. Implement main file transformation
2. Implement module file extraction
3. Add type annotations to replacements
4. Handle JSX variants
5. Preserve imports/exports

**Test Criteria**:
```typescript
test('main file has typed module reference', () => {
  const result = generateMainFile(parsed, 'test.tim');
  expect(result.content).toContain("typeof import('./test.tim.__mod0')");
});

test('module file contains only module body', () => {
  const result = generateModuleFile(block, 0);
  expect(result.content).toBe(block.body);
  expect(result.content).not.toContain('module {');
});

test('preserves jsx in .timx files', () => {
  const result = generateMainFile(parsed, 'test.timx');
  expect(result.content).toContain('<div>');
});
```

**Deliverable**: Working virtual document generation

---

### M5: Source Mapping

**Goal**: Accurate position mapping between source and virtual files

**Tasks**:
1. Implement bidirectional position mapping
2. Map errors from virtual files to source
3. Map completions from virtual files to source
4. Map hover info positions
5. Map rename/refactoring positions

**Test Criteria**:
```typescript
test('maps error position from virtual to source', () => {
  const mapping = createMapping(parsed, virtualFiles);
  const virtualPos = { file: '__mod0.ts', offset: 10 };
  const sourcePos = mapping.toSource(virtualPos);
  expect(sourcePos.offset).toBe(block.bodyStart + 10);
});

test('maps completion position from source to virtual', () => {
  const mapping = createMapping(parsed, virtualFiles);
  const sourcePos = { offset: block.bodyStart + 5 };
  const virtualPos = mapping.toVirtual(sourcePos);
  expect(virtualPos.file).toBe('__mod0.ts');
  expect(virtualPos.offset).toBe(5);
});
```

**Deliverable**: Complete source mapping system

---

### M6: TypeScript Integration

**Goal**: Full TypeScript language features

**Tasks**:
1. Connect Volar to TypeScript language service
2. Implement diagnostics forwarding
3. Implement completions forwarding
4. Implement hover info forwarding
5. Implement go-to-definition

**Test Criteria**:
```typescript
test('reports type errors in module blocks', async () => {
  const diagnostics = await getDiagnostics(`
    const foo = module {
      export default function(n: number): string {
        return n; // Error: number not assignable to string
      }
    };
  `);
  expect(diagnostics).toContainEqual(
    expect.objectContaining({ message: expect.stringContaining('not assignable') })
  );
});

test('provides completions in module blocks', async () => {
  const completions = await getCompletions(`
    const foo = module {
      export default function(n: number) {
        return n.toFix|
      }
    };
  `);
  expect(completions).toContainEqual(
    expect.objectContaining({ label: 'toFixed' })
  );
});
```

**Deliverable**: Working TypeScript integration

---

### M7: VSCode Extension

**Goal**: Polished VSCode experience

**Tasks**:
1. Create VSCode extension package
2. Bundle Volar language server
3. Configure syntax highlighting
4. Add file icons
5. Add snippets

**Test Criteria**:
- Extension installs and activates
- Syntax highlighting works
- Diagnostics appear
- Completions work
- Go-to-definition works

**Deliverable**: Published VSCode extension

---

### M8: Advanced Features

**Goal**: Complete feature parity with regular TypeScript

**Tasks**:
1. Implement rename across module boundaries
2. Implement find all references
3. Implement code actions (quick fixes)
4. Implement organize imports
5. Implement formatting

**Test Criteria**:
```typescript
test('rename updates both module and usage', async () => {
  const edits = await rename(`
    const foo = module {
      export function helper() {}
    };
    foo.exports.helper();
  `, 'helper', 'newHelper');

  expect(edits).toHaveLength(2);
});

test('find references includes module internals', async () => {
  const refs = await findReferences(`
    const foo = module {
      function internal() {}
      export default internal;
    };
  `, 'internal');

  expect(refs).toHaveLength(2);
});
```

**Deliverable**: Full IDE feature support

---

### M9: Build Optimization

**Goal**: Optimal production builds

**Tasks**:
1. Tree-shaking for unused module exports
2. Module deduplication
3. Code splitting for module blocks
4. Minification preservation
5. Build analysis tools

**Test Criteria**:
```typescript
test('tree-shakes unused exports', async () => {
  const bundle = await build(`
    const math = module {
      export function add(a, b) { return a + b; }
      export function unused() { return 'unused'; }
    };
    console.log(math.exports.add(1, 2));
  `);

  expect(bundle).not.toContain('unused');
});

test('deduplicates identical modules', async () => {
  const bundle = await build(`
    const a = module { export default 1; };
    const b = module { export default 1; };
  `);

  // Should only have one module file
  expect(bundle.files.filter(f => f.includes('.__mod'))).toHaveLength(1);
});
```

**Deliverable**: Optimized production builds

---

### M10: Documentation & Polish

**Goal**: Production-ready release

**Tasks**:
1. Write comprehensive documentation
2. Create migration guide
3. Add error recovery to parser
4. Performance optimization
5. Edge case handling

**Deliverable**: v1.0 release

---

## Testing Strategy

### Unit Tests

- Parser edge cases
- Virtual document generation
- Source mapping accuracy
- Type inference correctness

### Integration Tests

- Vite build pipeline
- VSCode extension features
- TypeScript language service
- HMR functionality

### E2E Tests

- Full project builds
- IDE interactions via VSCode test runner
- Real-world project scenarios

### Fixtures

```
tests/fixtures/
├── basic/
│   ├── single-module.tim
│   ├── multiple-modules.tim
│   └── with-jsx.timx
├── edge-cases/
│   ├── nested-braces.tim
│   ├── string-braces.tim
│   ├── template-literals.tim
│   └── comments.tim
├── types/
│   ├── default-export.tim
│   ├── named-exports.tim
│   ├── generic-exports.tim
│   └── type-exports.tim
└── errors/
    ├── unclosed-block.tim
    ├── nested-modules.tim
    └── type-errors.tim
```

---

## Appendix: File Extension Rationale

### `.tim` (TypeScript Inline Modules)

**Pros**:
- Short and memorable
- Unique, no conflicts
- Easy to type

**Cons**:
- Not self-documenting
- Requires learning

### `.mod.ts` (Module TypeScript)

**Pros**:
- Follows `.d.ts` pattern
- Self-documenting
- IDE may provide partial TS support automatically

**Cons**:
- Longer
- May conflict with other tools

### Recommendation

Support both, let users choose based on preference. Default examples should use `.tim` for brevity, with `.mod.ts` mentioned as an alternative.
