import type { CountryAdapter, PhoneticEncoder, VariantResolver } from "../types";
import type { SignalEvaluator } from "../../signals/types";
import { FrenchNormalizer } from "./normalizer";

/**
 * Stub phonetic encoder — Phase 2 will implement French phonetic rules.
 */
const stubPhoneticEncoder: PhoneticEncoder = {
  encode: () => [],
  similarity: () => 0,
};

/**
 * Stub variant resolver — Phase 2 will implement marriage/ballot name variants.
 */
const stubVariantResolver: VariantResolver = {
  generateVariants: (politician) => [`${politician.firstName} ${politician.lastName}`],
};

export const FrenchAdapter: CountryAdapter = {
  countryCode: "FR",
  name: "France",
  normalizer: new FrenchNormalizer(),
  phoneticEncoder: stubPhoneticEncoder,
  variantResolver: stubVariantResolver,
  additionalSignals: [] as SignalEvaluator[],
  additionalBlockingKeys: [],
};
