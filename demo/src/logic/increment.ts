/**
 * Handler logic for incrementing a counter
 */
interface SignalInterface {
  value: number;
}

export default function increment(_event: Event, count: SignalInterface): void {
  count.value = count.value + 1;
}
