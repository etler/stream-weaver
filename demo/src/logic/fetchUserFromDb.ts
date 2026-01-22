/**
 * Server-side logic that simulates fetching user data from a database
 *
 * This logic is marked with context: 'server' and will:
 * - Execute directly on the server during SSR
 * - Trigger an RPC call when executed on the client
 *
 * In a real app, this could contain:
 * - Database queries (Prisma, Drizzle, etc.)
 * - File system access
 * - Server-only API calls with secrets
 */
import type { SignalInterface } from "stream-weaver";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  lastLogin: string;
}

export default async function fetchUserFromDb(userId: SignalInterface<number>): Promise<string> {
  // Simulate database query delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Simulate database lookup
  const users: Record<number, User> = {
    1: {
      id: 1,
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "Admin",
      lastLogin: "2024-01-20 14:30",
    },
    2: {
      id: 2,
      name: "Bob Smith",
      email: "bob@example.com",
      role: "Developer",
      lastLogin: "2024-01-21 09:15",
    },
    3: {
      id: 3,
      name: "Carol Williams",
      email: "carol@example.com",
      role: "Designer",
      lastLogin: "2024-01-19 16:45",
    },
  };

  const user = users[userId.value] ?? {
    id: userId.value,
    name: "Unknown User",
    email: "unknown@example.com",
    role: "Guest",
    lastLogin: "Never",
  };

  // Return formatted JSON string for display
  return JSON.stringify(user, null, 2);
}
