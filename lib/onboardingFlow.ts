import type { HunterStats } from './hunterTypes';

export const ONBOARDING_STEPS = [
  'welcome',
  'baseline',
  'goals',
  'analysis',
  'identity',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function nextOnboardingStep(step: OnboardingStep): OnboardingStep | 'dashboard' {
  const index = ONBOARDING_STEPS.indexOf(step);
  return index === ONBOARDING_STEPS.length - 1 ? 'dashboard' : ONBOARDING_STEPS[index + 1];
}

export function canAccessDashboard(onboarded: boolean): boolean {
  return onboarded;
}

export function getAnalysisFocusAreas(stats: HunterStats): string[] {
  const entries = Object.entries(stats) as [keyof HunterStats, number][];
  return entries
    .sort(([, left], [, right]) => left - right)
    .slice(0, 2)
    .map(([stat]) => stat);
}
