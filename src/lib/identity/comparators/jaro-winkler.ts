import type { NameComparator } from "./types";

const PREFIX_WEIGHT = 0.1;
const MAX_PREFIX_LENGTH = 4;

function jaro(a: string, b: string): number {
  if (a === b) return 1.0;

  const lenA = a.length;
  const lenB = b.length;

  const matchWindow = Math.floor(Math.max(lenA, lenB) / 2) - 1;

  const matchedA = new Array<boolean>(lenA).fill(false);
  const matchedB = new Array<boolean>(lenB).fill(false);

  let matches = 0;
  for (let i = 0; i < lenA; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, lenB);
    for (let j = start; j < end; j++) {
      if (matchedB[j] || a[i] !== b[j]) continue;
      matchedA[i] = true;
      matchedB[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < lenA; i++) {
    if (!matchedA[i]) continue;
    while (!matchedB[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  return (matches / lenA + matches / lenB + (matches - transpositions / 2) / matches) / 3;
}

export class JaroWinklerComparator implements NameComparator {
  readonly id = "jaro-winkler";

  compare(a: string, b: string): number {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;

    const jaroSim = jaro(a, b);

    let prefixLen = 0;
    const limit = Math.min(MAX_PREFIX_LENGTH, Math.min(a.length, b.length));
    while (prefixLen < limit && a[prefixLen] === b[prefixLen]) {
      prefixLen++;
    }

    return jaroSim + prefixLen * PREFIX_WEIGHT * (1 - jaroSim);
  }
}
