import type { VariantResolver } from "../types";

export class FrenchVariantResolver implements VariantResolver {
  generateVariants(politician: {
    firstName: string;
    lastName: string;
    marriageName?: string;
    ballotName?: string;
  }): string[] {
    const variants: string[] = [];
    const { firstName, lastName, marriageName, ballotName } = politician;

    variants.push(`${firstName} ${lastName}`);
    variants.push(`${lastName} ${firstName}`);

    if (firstName.includes("-")) {
      variants.push(`${firstName.replace(/-/g, " ")} ${lastName}`);
    } else if (firstName.includes(" ")) {
      variants.push(`${firstName.replace(/ /g, "-")} ${lastName}`);
    }

    if (marriageName && marriageName !== lastName) {
      variants.push(`${firstName} ${marriageName}`);
      variants.push(`${marriageName} ${firstName}`);
    }

    if (ballotName && ballotName !== lastName) {
      variants.push(ballotName);
      variants.push(`${firstName} ${ballotName}`);
    }

    const parts = lastName.split(/[\s-]+/);
    if (parts.length > 1 && parts[0]!.length > 2) {
      variants.push(`${firstName} ${parts[0]}`);
    }

    return [...new Set(variants)];
  }
}
