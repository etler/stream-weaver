/**
 * Example: Server-side Logic (M13)
 *
 * Demonstrates server-only logic execution:
 * - Server logic runs on the server during SSR
 * - On the client, it triggers an RPC call to the server
 * - The signal chain is serialized and sent to /weaver/execute
 *
 * USE CASES:
 * - Database queries (Prisma, Drizzle, etc.)
 * - File system access
 * - Server-only API calls with secrets
 * - Server-side computations
 *
 * HOW IT WORKS:
 * 1. createServerLogic marks logic as server-only
 * 2. On SSR: executes directly like any other logic
 * 3. On client: serializes dependency chain, POSTs to server, gets result
 */
import { createSignal, createComputed, createHandler, createLogic, createServerLogic } from "stream-weaver";

// --- Server Logic Signals ---

// User ID state that can be changed from the client
const userId = createSignal(1);

// Server logic - fetches user from "database"
// This will execute on the server and return the result
const fetchUserLogic = createServerLogic(import("../logic/fetchUserFromDb"));
const user = createComputed(fetchUserLogic, [userId], "Loading user...");

// Server logic with no dependencies - just returns server time
const getTimeLogic = createServerLogic(import("../logic/getServerTime"));
const serverTime = createComputed(getTimeLogic, [], "Loading...");

// --- Client-side handlers to change userId ---
const setUser1Logic = createLogic(import("../logic/setUserId1"));
const setUser1 = createHandler(setUser1Logic, [userId]);

const setUser2Logic = createLogic(import("../logic/setUserId2"));
const setUser2 = createHandler(setUser2Logic, [userId]);

const setUser3Logic = createLogic(import("../logic/setUserId3"));
const setUser3 = createHandler(setUser3Logic, [userId]);

/**
 * User Card component - displays user fetched from server
 */
function UserCard(): JSX.Element {
  return (
    <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
      {/* Hidden userId to ensure it's serialized to client */}
      <span style="display: none;">{userId}</span>
      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
        <div style="width: 64px; height: 64px; background: #6366f1; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; font-weight: bold;">
          ?
        </div>
        <div>
          <h3 style="margin: 0; color: #333;">User Profile</h3>
          <p style="margin: 0.25rem 0 0 0; color: #666; font-size: 0.9rem;">Fetched from server</p>
        </div>
      </div>

      <div style="background: #f8fafc; padding: 1rem; border-radius: 6px; font-family: monospace; font-size: 0.9rem;">
        <pre style="margin: 0; white-space: pre-wrap;">{user}</pre>
      </div>

      <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: center;">
        <button
          onClick={setUser1}
          style="padding: 0.5rem 1rem; cursor: pointer; background: #6366f1; color: white; border: none; border-radius: 4px;"
        >
          User 1
        </button>
        <button
          onClick={setUser2}
          style="padding: 0.5rem 1rem; cursor: pointer; background: #6366f1; color: white; border: none; border-radius: 4px;"
        >
          User 2
        </button>
        <button
          onClick={setUser3}
          style="padding: 0.5rem 1rem; cursor: pointer; background: #6366f1; color: white; border: none; border-radius: 4px;"
        >
          User 3
        </button>
      </div>

      <p style="text-align: center; font-size: 0.8rem; color: #999; margin: 0.5rem 0 0 0;">
        Click to fetch different users from the server
      </p>
    </div>
  );
}

/**
 * Server Time component - displays time from server
 */
function ServerTime(): JSX.Element {
  return (
    <div style="background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 400px; margin: 1.5rem auto 0 auto; text-align: center;">
      <div style="font-size: 0.9rem; color: #666;">Server Time</div>
      <div style="font-size: 1.1rem; color: #333; font-family: monospace;">{serverTime}</div>
    </div>
  );
}

/**
 * Root component for the demo
 */
export function ServerLogicExample(): JSX.Element {
  return (
    <div style="padding: 1rem; background: #f1f5f9; min-height: 100vh;">
      <h1 style="text-align: center; color: #333;">Server Logic Demo (M13)</h1>
      <p style="text-align: center; color: #666; max-width: 500px; margin: 0 auto 2rem auto;">
        Server logic executes on the server even when triggered from the client. The signal chain is serialized and sent
        via RPC.
      </p>

      <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; max-width: 500px; margin-left: auto; margin-right: auto;">
        <strong>How it works:</strong>
        <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem; font-size: 0.9rem;">
          <li>
            <code>createServerLogic()</code> marks logic as server-only
          </li>
          <li>During SSR: executes directly on the server</li>
          <li>
            On client: serializes chain, POSTs to <code>/weaver/execute</code>
          </li>
          <li>Server rebuilds registry, executes, returns result</li>
        </ul>
      </div>

      <UserCard />
      <ServerTime />

      <div style="max-width: 500px; margin: 2rem auto; padding: 1rem; background: #e0e7ff; border-radius: 8px; font-size: 0.9rem;">
        <strong>Note:</strong> This demo requires the server endpoint to be configured. Without it, client-side updates
        will fail. The SSR render works because server logic executes directly during SSR.
      </div>
    </div>
  );
}
