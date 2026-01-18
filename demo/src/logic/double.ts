/**
 * Computed logic for doubling a value
 */
interface SignalInterface {
  value: number;
}

export default function double(count: SignalInterface): number {
  return count.value * 2;
}
