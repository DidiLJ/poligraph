import type { CountryAdapter } from "../types";
import type { SignalEvaluator } from "../../signals/types";
import { FrenchNormalizer } from "./normalizer";
import { FrenchPhoneticEncoder } from "./phonetic";
import { FrenchVariantResolver } from "./variants";

export const FrenchAdapter: CountryAdapter = {
  countryCode: "FR",
  name: "France",
  normalizer: new FrenchNormalizer(),
  phoneticEncoder: new FrenchPhoneticEncoder(),
  variantResolver: new FrenchVariantResolver(),
  additionalSignals: [] as SignalEvaluator[],
  additionalBlockingKeys: [],
};
