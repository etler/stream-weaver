/**
 * Client-side entry point for Stream Weaver demo
 * This script hydrates the server-rendered HTML and makes it interactive
 */

// Polyfill must be imported first, before any code that uses ReadableStream.from
import "stream-weaver/polyfills";

import { ClientWeaver } from "stream-weaver/client";

// Extend Window interface for our weaver property
declare global {
  interface Window {
    weaver: ClientWeaver | { weaverQueue: unknown[]; push: (msg: unknown) => void };
  }
}

// Initialize ClientWeaver
const clientWeaver = new ClientWeaver();

// Process any queued messages from the stub
if (window.weaver && "weaverQueue" in window.weaver) {
  for (const msg of window.weaver.weaverQueue) {
    // Messages from server are already typed correctly, just need to satisfy TypeScript
    clientWeaver.push(msg as Parameters<typeof clientWeaver.push>[0]);
  }
}

// Replace stub with real weaver
window.weaver = clientWeaver;
