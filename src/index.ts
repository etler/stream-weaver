export interface StreamWeaverOptions {
  debug?: boolean;
}

/**
 * StreamWeaver
 *
 * Proof of Concept Scope
 *
 * [ ] Server Weaver
 *   [ ] Hydration Conductor
 *   [ ] Component Conductor
 *   [ ] Fallback Component Conductor
 * [ ] Server Stream HTML Serializer
 *   [ ] Hydration Stream HTML Serializer
 *   [ ] Component Stream HTML Serializer
 *   [ ] Fallback Component Stream HTML Serializer
 * [x] Browser Stream Deserializer (Inherent)
 * [ ] Browser Client Weaver
 *   [ ] Interaction Conductor
 *   [ ] State Conductor
 *   [ ] Component Conductor
 *   [ ] Component Stream DOM serializer
 *   [ ] Lifecycle Conductor
 *
 */
export class StreamWeaver {
  private options: StreamWeaverOptions;
  constructor(options: StreamWeaverOptions = {}) {
    this.options = options;
    console.log(this.options);
  }
}
