import type { NameComparator } from "./types";
import type { PhoneticEncoder } from "../adapters/types";

export class PhoneticComparator implements NameComparator {
  readonly id = "phonetic";
  private readonly encoder: PhoneticEncoder;

  constructor(encoder: PhoneticEncoder) {
    this.encoder = encoder;
  }

  compare(a: string, b: string): number {
    return this.encoder.similarity(a, b);
  }
}
