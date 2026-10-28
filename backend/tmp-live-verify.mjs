const BASE = 'http://127.0.0.1:5000/api';

function summarizeGenerate(body) {
  const data = body?.data;
  const text = typeof data === 'string' ? data : data == null ? '' : JSON.stringify(data);
  return {
    success: body?.success,
    fallback: body?.fallback ?? false,
    provider: body?.provider,
    model: body?.model,
    error: body?.error,
    errorType: body?.errorType,
    dataType: Array.isArray(data) ? 'array' : typeof data,
    dataChars: text.length,
    hasThink: /<think>|<\/think>/i.test(text),
    hasReasoningLeak: /(?:^|\n)\s*(?:analysis|reasoning|chain of thought|internal reasoning)\s*[:\-]/i.test(text),
    preview: text.slice(0, 160).replace(/\s+/g, ' '),
  };
}

function recShape(item) {
  if (!item || typeof item !== 'object') return { type: typeof item };
  return {
    keys: Object.keys(item).slice(0, 16),
    titleType: typeof item.title,
    descriptionType: typeof item.description,
    categoryType: typeof item.category,
    estimatedDurationType: typeof item.estimatedDuration,
    difficultyType: typeof item.difficulty,
    deadlineType: typeof item.deadline,
    suggestedRewardType: typeof item.suggestedReward,
    durationMinutesType: typeof item.durationMinutes,
    xpRewardType: typeof item.xpReward,
    generatedBy: item.generatedBy,
    fallback: item.fallback,
  };
}

function summarizeWeakness(body) {
  const recs = Array.isArray(body?.recommendations) ? body.recommendations : Array.isArray(body?.data) ? body.data : null;
  return {
    success: body?.success,
    fallback: body?.fallback ?? false,
    source: body?.source,
    fallbackReason: body?.fallbackReason,
    error: body?.error,
    errorType: body?.errorType,
    recCount: recs?.length ?? null,
    first: recs?.[0] ? recShape(recs[0]) : null,
  };
}

function summarizeQuests(body) {
  const data = Array.isArray(body?.data) ? body.data : null;
  return {
    success: body?.success,
    fallback: body?.fallback ?? false,
    source: body?.source,
    fallbackReason: body?.fallbackReason,
    error: body?.error,
    errorType: body?.errorType,
    dataCount: data?.length ?? null,
    first: data?.[0] ? recShape(data[0]) : null,
  };
}

function matchesGenerateSchema(status, body) {
  if (status >= 400) return body && typeof body === 'object' && body.success === false && typeof body.error === 'string';
  return body && body.success === true && body.data !== undefined && typeof body.provider === 'string';
}

function matchesWeaknessSchema(body) {
  const recs = body?.recommendations ?? body?.data;
  if (!body?.success || !Array.isArray(recs)) return false;
  return recs.every((item) =>
    item && typeof item.title === 'string' && typeof item.description === 'string' && typeof item.category === 'string' &&
    typeof item.estimatedDuration === 'number' && typeof item.difficulty === 'string' &&
    typeof item.deadline === 'string' && typeof item.suggestedReward === 'number'
  );
}

function matchesQuestSchema(body) {
  return body?.success === true && Array.isArray(body.data) && body.data.length === 3 &&
    body.data.every((q) => q && typeof q.title === 'string' && typeof q.description === 'string' && typeof q.xpReward === 'number');
}

function frontendGenerateQuestsWouldAccept(body) {
  if (!body?.success || !Array.isArray(body.data) || body.data.length !== 3) return { accepted: false };
  return { accepted: true, fallback: body.fallback === true || body.source === 'hunteros-engine' };
}

function frontendWeaknessWouldAccept(body) {
  const recList = body?.recommendations ?? body?.data;
  return { accepted: Boolean(body?.success && Array.isArray(recList)), fallback: body?.fallback === true };
}

async function post(path, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const raw = await response.text();
    let body;
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = { parseError: true, rawStart: raw.slice(0, 80) }; }
    return { status: response.status, ms: Date.now() - started, body };
  } catch (error) {
    return { status: 0, ms: Date.now() - started, body: { error: error.name === 'AbortError' ? 'timeout' : 'network', errorType: error.name } };
  } finally {
    clearTimeout(timer);
  }
}

const which = process.argv[2] || 'generate';
let result;
if (which === 'generate') {
  result = await post('/ai/generate', { prompt: 'Hi' }, 180000);
  console.log(JSON.stringify({ httpStatus: result.status, ms: result.ms, ...summarizeGenerate(result.body), matchesFrontendSchema: matchesGenerateSchema(result.status, result.body), frontendGenerateAIAccepts: result.status === 200 && result.body?.success === true }, null, 2));
} else if (which === 'weakness') {
  result = await post('/weakness', {
    goals: ['Build consistency'],
    stats: { strength: 30, knowledge: 30, discipline: 30, health: 30, mindfulness: 30 },
    recentQuests: [],
    availableMinutes: 45,
    preferredCategories: ['Study', 'Discipline'],
    completedQuests: [],
    skippedQuests: [],
    difficulty: 'Intermediate',
  }, 180000);
  console.log(JSON.stringify({ httpStatus: result.status, ms: result.ms, ...summarizeWeakness(result.body), matchesFrontendSchema: matchesWeaknessSchema(result.body), frontendNormalizer: frontendWeaknessWouldAccept(result.body) }, null, 2));
} else if (which === 'quests') {
  result = await post('/quests/generate', { goal: 'Study for 30 minutes', category: 'Study', availableMinutes: 45, difficulty: 'Beginner' }, 180000);
  console.log(JSON.stringify({ httpStatus: result.status, ms: result.ms, ...summarizeQuests(result.body), matchesFrontendSchema: matchesQuestSchema(result.body), frontendNormalizer: frontendGenerateQuestsWouldAccept(result.body) }, null, 2));
}
