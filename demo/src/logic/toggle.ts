/**
 * Handler logic for toggling a boolean value
 */
interface SignalInterface {
  value: boolean;
}

export default function toggle(_event: Event, value: SignalInterface): void {
  value.value = !value.value;
}
