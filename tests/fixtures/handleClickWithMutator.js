/**
 * Handler that receives a MutatorSignal which provides a writable interface
 */
export default function handleClickWithMutator(event, countInterface) {
  // countInterface should be a writable interface with .value
  if (typeof countInterface !== "object" || !("value" in countInterface)) {
    throw new Error("Expected writable interface, got: " + typeof countInterface);
  }
  countInterface.value++;
}
