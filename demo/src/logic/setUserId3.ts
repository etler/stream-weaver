/**
 * Handler to set userId to 3
 */
import type { WritableSignalInterface } from "stream-weaver";

export default function setUserId3(_event: Event, userId: WritableSignalInterface<number>): void {
  userId.value = 3;
}
