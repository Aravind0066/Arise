export function canAccreditPomodoro(completed: boolean, alreadyRewarded: boolean): boolean {
  return completed && !alreadyRewarded;
}
