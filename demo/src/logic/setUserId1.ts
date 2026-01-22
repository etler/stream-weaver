/**
 * Handler to set userId to 1
 */
import type { WritableSignalInterface } from "stream-weaver";

export default function setUserId1(_event: Event, userId: WritableSignalInterface<number>): void {
  userId.value = 1;
}
