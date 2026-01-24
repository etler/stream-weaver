import { describe, test, expect } from "vitest";
import { defineSignal, defineComputed, defineLogic } from "@/signals";
import { defineSuspense } from "@/signals/defineSuspense";
import { Suspense } from "@/components/Suspense";
import { isSuspenseSignal } from "@/ComponentDelegate/signalDetection";
import { StreamWeaver, WeaverRegistry } from "@/index";
import { Component } from "@/jsx/types/Component";
import path from "node:path";

const fixturesPath = path.resolve(__dirname, "fixtures");

describe("Suspense Component", () => {
  describe("defineSuspense", () => {
    test("creates a SuspenseSignal with correct properties", () => {
      const fallback = <div>Loading...</div>;
      const children = <div>Content</div>;

      const signal = defineSuspense(fallback, children);

      expect(signal.kind).toBe("suspense");
      expect(signal.id).toBeDefined();
      expect(signal.fallback).toBe(fallback);
      expect(signal.children).toBe(children);
      expect(signal.pendingDeps).toEqual([]);
    });

    test("creates unique IDs for each SuspenseSignal", () => {
      const signal1 = defineSuspense(null, null);
      const signal2 = defineSuspense(null, null);

      expect(signal1.id).not.toBe(signal2.id);
    });
  });

  describe("isSuspenseSignal type guard", () => {
    test("returns true for SuspenseSignal", () => {
      const signal = defineSuspense(<div>Fallback</div>, <div>Children</div>);
      expect(isSuspenseSignal(signal)).toBe(true);
    });

    test("returns false for other signals", () => {
      const stateSignal = defineSignal(0);
      expect(isSuspenseSignal(stateSignal)).toBe(false);
    });

    test("returns false for non-signals", () => {
      expect(isSuspenseSignal(null)).toBe(false);
      expect(isSuspenseSignal(undefined)).toBe(false);
      expect(isSuspenseSignal("string")).toBe(false);
      expect(isSuspenseSignal({ kind: "other" })).toBe(false);
    });
  });

  describe("Suspense component function", () => {
    test("creates SuspenseSignal from props", () => {
      const fallback = <span>Loading</span>;
      const children = <span>Done</span>;

      const signal = Suspense({ fallback, children });

      expect(signal.kind).toBe("suspense");
      expect(signal.fallback).toBe(fallback);
      expect(signal.children).toBe(children);
    });

    test("handles undefined children", () => {
      const fallback = <span>Loading</span>;

      const signal = Suspense({ fallback });

      expect(signal.children).toBe(null);
    });
  });

  describe("SSR rendering", () => {
    test("renders children when no PENDING signals", async () => {
      const registry = new WeaverRegistry();
      const Content: Component = () => <div>Content loaded</div>;

      const App: Component = () => (
        <Suspense fallback={<div>Loading...</div>}>
          <Content />
        </Suspense>
      );

      const root = <App />;
      const weaver = new StreamWeaver({ root, registry });
      const chunks: string[] = [];
      for await (const chunk of weaver.readable) {
        chunks.push(chunk);
      }
      const result = chunks.join("");

      // Should contain the content rendered between bind markers
      expect(result).toContain("Content loaded");
      // Fallback text appears in signal definition JSON, but actual HTML should show content
      expect(result).toMatch(/<!--\^[^>]+--><div>Content loaded<\/div><!--\/[^>]+-->/);
    });

    test("renders fallback when children have PENDING signals", async () => {
      const registry = new WeaverRegistry();
      // Create a computed signal with deferred logic (timeout: 0 = always PENDING initially)
      const deferredLogic = defineLogic({ src: `${fixturesPath}/slowDouble.js` }, { timeout: 0 });
      const count = defineSignal(5);
      const deferredValue = defineComputed(deferredLogic, [count]);

      // Register the signals
      registry.registerSignal(count);
      registry.registerSignal(deferredLogic);
      registry.registerSignal(deferredValue);
      registry.setValue(count.id, 5);

      const Content: Component = () => <div>Value: {deferredValue}</div>;

      const App: Component = () => (
        <Suspense fallback={<div>Loading...</div>}>
          <Content />
        </Suspense>
      );

      const weaver = new StreamWeaver({ root: <App />, registry });
      const result = (await Array.fromAsync(weaver.readable)).join("");

      // Should contain the fallback since deferredValue is PENDING
      expect(result).toContain("Loading...");
    });

    test("includes bind markers for suspense boundaries", async () => {
      const registry = new WeaverRegistry();
      const Content: Component = () => <div>Content</div>;

      const App: Component = () => (
        <Suspense fallback={<div>Loading...</div>}>
          <Content />
        </Suspense>
      );

      const weaver = new StreamWeaver({ root: <App />, registry });
      const result = (await Array.fromAsync(weaver.readable)).join("");

      // Should have bind markers (format: <!--^id--> content <!--/id-->)
      expect(result).toMatch(/<!--\^[^>]+-->/);
      expect(result).toMatch(/<!--\/[^>]+-->/);
    });

    test("includes signal definitions for PENDING signals when showing fallback", async () => {
      const registry = new WeaverRegistry();
      const deferredLogic = defineLogic({ src: `${fixturesPath}/slowDouble.js` }, { timeout: 0 });
      const count = defineSignal(5);
      const deferredValue = defineComputed(deferredLogic, [count]);

      // Register the signals
      registry.registerSignal(count);
      registry.registerSignal(deferredLogic);
      registry.registerSignal(deferredValue);
      registry.setValue(count.id, 5);

      const Content: Component = () => <div>Value: {deferredValue}</div>;

      const App: Component = () => (
        <Suspense fallback={<div>Loading...</div>}>
          <Content />
        </Suspense>
      );

      const weaver = new StreamWeaver({ root: <App />, registry });
      const result = (await Array.fromAsync(weaver.readable)).join("");

      // Should include signal definitions in script tags for client hydration
      expect(result).toContain("<script>");
      expect(result).toContain("weaver.push");
      // The computed signal should be defined so the client knows about it
      expect(result).toContain('"kind":"computed"');
    });

    test("stores pre-rendered children HTML for nested suspense", async () => {
      // _childrenHtml is included in signal definitions for nested Suspense boundaries
      // (due to timing - inner suspense is processed before outer emits its tokens)
      const registry = new WeaverRegistry();
      const Inner: Component = () => <span>Inner content</span>;

      const App: Component = () => (
        <Suspense fallback={<div>Outer loading...</div>}>
          <div>Outer</div>
          <Suspense fallback={<div>Inner loading...</div>}>
            <Inner />
          </Suspense>
        </Suspense>
      );

      const weaver = new StreamWeaver({ root: <App />, registry });
      const result = (await Array.fromAsync(weaver.readable)).join("");

      // Inner suspense signal definition should include _childrenHtml
      expect(result).toContain('"kind":"suspense"');
      expect(result).toContain("_childrenHtml");
      expect(result).toContain("Inner content");
    });
  });

  describe("nested Suspense", () => {
    test("renders nested suspense boundaries correctly", async () => {
      const registry = new WeaverRegistry();
      const Inner: Component = () => <span>Inner content</span>;
      const Outer: Component = () => <div>Outer content</div>;

      const App: Component = () => (
        <Suspense fallback={<div>Outer loading...</div>}>
          <Outer />
          <Suspense fallback={<div>Inner loading...</div>}>
            <Inner />
          </Suspense>
        </Suspense>
      );

      const weaver = new StreamWeaver({ root: <App />, registry });
      const result = (await Array.fromAsync(weaver.readable)).join("");

      // Both should render their content (no PENDING signals)
      expect(result).toContain("Outer content");
      expect(result).toContain("Inner content");
      // Fallback text appears in signal definition JSON, but not rendered as HTML
      // Check that actual rendered content shows the components, not fallbacks
      expect(result).toMatch(/<div>Outer content<\/div>/);
      expect(result).toMatch(/<span>Inner content<\/span>/);
    });
  });
});
