export interface RewardClaimStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function createRewardClaimer(storage: RewardClaimStorage, ledgerKey: string) {
  let queue: Promise<unknown> = Promise.resolve();
  return (claimId: string): Promise<boolean> => {
    const claim = queue.then(async () => {
      const raw = await storage.getItem(ledgerKey);
      const claims: string[] = raw ? JSON.parse(raw) : [];
      if (claims.includes(claimId)) return false;
      await storage.setItem(ledgerKey, JSON.stringify([...claims, claimId]));
      return true;
    });
    queue = claim.catch(() => undefined);
    return claim;
  };
}
