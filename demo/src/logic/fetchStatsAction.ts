/**
 * Async handler logic that fetches stats and updates state signals
 * Demonstrates M11 async logic pattern - executeLogic awaits the Promise
 */
import type { WritableSignalInterface } from "stream-weaver";

export default async function fetchStatsAction(
  _event: Event,
  commits: WritableSignalInterface<number>,
  prs: WritableSignalInterface<number>,
  reviews: WritableSignalInterface<number>,
): Promise<void> {
  // Simulate API delay (500ms)
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Update the state signals with fetched data
  // These updates happen AFTER the await completes (M11 feature!)
  commits.value = 1247;
  prs.value = 89;
  reviews.value = 156;
}
