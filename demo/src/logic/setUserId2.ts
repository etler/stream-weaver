/**
 * Handler to set userId to 2
 */
import type { WritableSignalInterface } from "stream-weaver";

export default function setUserId2(_event: Event, userId: WritableSignalInterface<number>): void {
  userId.value = 2;
}
