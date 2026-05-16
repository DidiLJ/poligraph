export interface InstallGateInput {
  now: number;
  visitCount: number;
  dismissedUntil: number;
  isMobile: boolean;
  hasPromptEvent: boolean;
}

export const MIN_VISITS = 3;
export const DISMISS_DURATION_MS = 1000 * 60 * 60 * 24 * 14; // 14 jours

export function shouldShowPrompt(input: InstallGateInput): boolean {
  if (!input.hasPromptEvent) return false;
  if (!input.isMobile) return false;
  if (input.visitCount < MIN_VISITS) return false;
  if (input.dismissedUntil > input.now) return false;
  return true;
}
