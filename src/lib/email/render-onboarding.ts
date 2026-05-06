import { WELCOME_HTML } from "./templates/welcome-compiled";

export interface OnboardingContext {
  deputyName: string | null;
  deputyParty: string | null;
  deputyProfileUrl: string | null;
  unsubscribeUrl: string;
}

export function renderOnboardingHtml(ctx: OnboardingContext): string {
  return WELCOME_HTML.replace(/\{\{deputyName\}\}/g, ctx.deputyName ?? "")
    .replace(/\{\{deputyParty\}\}/g, ctx.deputyParty ?? "")
    .replace(/\{\{deputyProfileUrl\}\}/g, ctx.deputyProfileUrl ?? "")
    .replace(/\{\{unsubscribeUrl\}\}/g, ctx.unsubscribeUrl);
}
