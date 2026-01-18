/**
 * Handler logic for toggling a boolean value
 */
import type { WritableSignalInterface } from "stream-weaver";

export default function toggle(_event: Event, value: WritableSignalInterface<boolean>): void {
  value.value = !value.value;
}
