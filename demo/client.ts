/**
 * Client-side entry point for Stream Weaver demos
 * This script hydrates the server-rendered HTML and makes it interactive
 */
import { ClientWeaver } from "../src/client/ClientWeaver";

// Extend Window interface for our weaver property
declare global {
  interface Window {
    weaver: ClientWeaver | { weaverQueue: unknown[]; push: (msg: unknown) => void };
  }
}

// Initialize ClientWeaver
const clientWeaver = new ClientWeaver();

// Process any queued messages from the stub
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/strict-boolean-expressions
if (window.weaver && "weaverQueue" in window.weaver) {
  for (const msg of window.weaver.weaverQueue) {
    clientWeaver.push(msg);
  }
}

// Replace stub with real weaver
window.weaver = clientWeaver;
