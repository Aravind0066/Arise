const workoutSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'goal', 'durationMinutes', 'exercises'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 90 },
    goal: { type: 'string', minLength: 1, maxLength: 180 },
    durationMinutes: { type: 'integer', minimum: 8, maximum: 75 },
    exercises: {
      type: 'array', minItems: 3, maxItems: 8,
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'type', 'targetReps', 'durationSeconds', 'restSeconds', 'targetMuscles', 'tips'],
        properties: {
          name: { type: 'string', enum: ['Push-ups', 'Squats', 'Plank', 'Jumping Jacks', 'Lunges', 'Mountain Climbers', 'Burpees', 'Crunches', 'Bench Press', 'Dumbbell Bench Press', 'Leg Press', 'Cable Crossover', 'Lat Pulldown', 'Seated Cable Row', 'Dumbbell Shoulder Press', 'Biceps Curl', 'Triceps Pushdown', 'Barbell Squat', 'Goblet Squat', 'Leg Extension', 'Hamstring Curl', 'Dumbbell Romanian Deadlift'] },
          type: { type: 'string', enum: ['reps', 'timed'] },
          targetReps: { type: ['integer', 'null'], minimum: 1, maximum: 40 },
          durationSeconds: { type: ['integer', 'null'], minimum: 15, maximum: 120 },
          restSeconds: { type: 'integer', minimum: 0, maximum: 90 },
          targetMuscles: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string', minLength: 1, maxLength: 32 } },
          tips: { type: 'string', minLength: 1, maxLength: 220 },
        },
      },
    },
  },
};

const nutritionSchema = {
  type: 'array', minItems: 1, maxItems: 4,
  items: {
    type: 'object', additionalProperties: false,
    required: ['name', 'ingredients', 'portions', 'steps'],
    properties: {
      name: { type: 'string' },
      ingredients: { type: 'array', minItems: 1, items: { type: 'string' } },
      portions: { type: 'string' },
      steps: { type: 'array', minItems: 1, items: { type: 'string' } },
      nutrition: { type: 'object', additionalProperties: true },
      preparationTimeMinutes: { type: 'integer' },
      substitutions: { type: 'array', items: { type: 'string' } },
      goalAlignment: { type: 'string' },
      note: { type: 'string' },
    },
  },
};

const weaknessItemSchema = {
  type: 'object', additionalProperties: false,
  required: ['title', 'description', 'category', 'estimatedDuration', 'difficulty', 'deadline', 'suggestedReward'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    category: { type: 'string' },
    estimatedDuration: { type: 'integer' },
    difficulty: { type: 'string', enum: ['Beginner', 'Intermediate', 'Advanced'] },
    deadline: { type: 'string' },
    suggestedReward: { type: 'integer' },
  },
};

const weaknessRecommendationsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendations'],
  properties: {
    recommendations: { type: 'array', minItems: 3, maxItems: 5, items: weaknessItemSchema },
  },
};

const generatedQuestItemSchema = {
  type: 'object', additionalProperties: false,
  required: ['title', 'description', 'xpReward', 'durationMinutes'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    xpReward: { type: 'integer' },
    durationMinutes: { type: 'integer' },
  },
};

const generatedQuestsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['quests'],
  properties: {
  quests: { type: 'array', minItems: 3, maxItems: 3, items: generatedQuestItemSchema },
  },
};

function extractJsonArray(raw, preferredKeys = ['recommendations', 'quests', 'items', 'tasks', 'data']) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return null;
  for (const key of preferredKeys) {
    if (Array.isArray(raw[key])) return raw[key];
  }
  return null;
}

module.exports = { workoutSchema, nutritionSchema, weaknessRecommendationsSchema, generatedQuestsSchema, extractJsonArray };
