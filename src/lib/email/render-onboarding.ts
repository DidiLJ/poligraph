import { WELCOME_HTML } from "./templates/welcome-compiled";

export interface OnboardingContext {
  deputyName: string | null;
  deputyParty: string | null;
  deputyProfileUrl: string | null;
  unsubscribeUrl: string;
}

const DEPUTY_BLOCK_RE = /<!-- deputy-block-start -->[\s\S]*?<!-- deputy-block-end -->/g;

export function renderOnboardingHtml(ctx: OnboardingContext): string {
  let html = WELCOME_HTML;
  if (!ctx.deputyName) {
    html = html.replace(DEPUTY_BLOCK_RE, "");
  }
  return html
    .replace(/\{\{deputyName\}\}/g, ctx.deputyName ?? "")
    .replace(/\{\{deputyParty\}\}/g, ctx.deputyParty ?? "")
    .replace(/\{\{deputyProfileUrl\}\}/g, ctx.deputyProfileUrl ?? "")
    .replace(/\{\{unsubscribeUrl\}\}/g, ctx.unsubscribeUrl);
}
