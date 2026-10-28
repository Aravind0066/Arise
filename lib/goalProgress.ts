export interface GoalProgressEntry {
  id: string;
  value: number;
  recordedAt: string;
}

export interface GoalProgress {
  title: string;
  targetValue: number | null;
  unit: string;
  targetDate: string | null;
  entries: GoalProgressEntry[];
}

export interface GoalStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function createGoalProgress(title: string): GoalProgress {
  return { title: title.trim(), targetValue: null, unit: '', targetDate: null, entries: [] };
}

export function parseOptionalTarget(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Target must be a valid non-negative number.');
  return parsed;
}

export function validateTargetDate(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error('Use a valid date in YYYY-MM-DD format.');
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Enter a valid calendar date.');
  }
  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (normalized < todayDate) throw new Error('Target date must be today or in the future.');
  return normalized;
}

export function updateGoalConfiguration(
  goal: GoalProgress,
  input: { title: string; target: string; unit: string; targetDate: string },
): GoalProgress {
  const title = input.title.trim();
  const unit = input.unit.trim();
  if (!title) throw new Error('Enter a goal title.');
  if (title.length > 100) throw new Error('Goal title must be 100 characters or fewer.');
  if (unit.length > 20) throw new Error('Unit must be 20 characters or fewer.');
  return {
    ...goal,
    title,
    targetValue: parseOptionalTarget(input.target),
    unit,
    targetDate: validateTargetDate(input.targetDate),
  };
}

export function addGoalProgressEntry(goal: GoalProgress, value: string, recordedAt = new Date().toISOString()): GoalProgress {
  const normalized = value.trim();
  const measurement = Number(normalized);
  if (!normalized || !Number.isFinite(measurement) || measurement < 0) {
    throw new Error('Progress measurement must be a valid non-negative number.');
  }
  const entry = { id: `goal-progress-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, value: measurement, recordedAt };
  return { ...goal, entries: [...goal.entries, entry].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)) };
}

export function syncGoalTitle(goal: GoalProgress, profileGoal: string): GoalProgress {
  const title = profileGoal.trim();
  return title && goal.title !== title ? { ...goal, title } : goal;
}

export function getLatestGoalEntry(entries: GoalProgressEntry[]): GoalProgressEntry | null {
  if (!entries.length) return null;
  return [...entries].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)).at(-1) ?? null;
}

export function isGoalProgressEmpty(entries: GoalProgressEntry[]): boolean {
  return entries.length === 0;
}

export function createGoalProgressStore(storage: GoalStorageAdapter, key: string) {
  return {
    async load(profileGoal: string): Promise<GoalProgress> {
      const raw = await storage.getItem(key);
      if (!raw) {
        const initial = createGoalProgress(profileGoal);
        await storage.setItem(key, JSON.stringify(initial));
        return initial;
      }
      const stored = JSON.parse(raw) as Partial<GoalProgress>;
      const goal: GoalProgress = {
        title: typeof stored.title === 'string' ? stored.title : profileGoal.trim(),
        targetValue: typeof stored.targetValue === 'number' && Number.isFinite(stored.targetValue) ? stored.targetValue : null,
        unit: typeof stored.unit === 'string' ? stored.unit : '',
        targetDate: typeof stored.targetDate === 'string' ? stored.targetDate : null,
        entries: Array.isArray(stored.entries)
          ? stored.entries.filter((entry): entry is GoalProgressEntry => Boolean(entry && typeof entry.id === 'string' && Number.isFinite(entry.value) && typeof entry.recordedAt === 'string'))
          : [],
      };
      const synchronized = syncGoalTitle(goal, profileGoal);
      if (synchronized !== goal) await storage.setItem(key, JSON.stringify(synchronized));
      return synchronized;
    },
    async save(goal: GoalProgress): Promise<void> {
      await storage.setItem(key, JSON.stringify(goal));
    },
  };
}
