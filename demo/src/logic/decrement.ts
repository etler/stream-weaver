/**
 * Handler logic for decrementing a counter
 */
interface SignalInterface {
  value: number;
}

export default function decrement(_event: Event, count: SignalInterface): void {
  count.value = count.value - 1;
}
