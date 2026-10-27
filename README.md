# HUNTEROS // SYSTEM (ARISE)

> **"Level Up Yourself. A real-life RPG where YOU are the character."**  
> Fitness, study, discipline, nutrition, mental health, and screen time — all feeding one 5-axis progression system.

---

## ⚡ Key Highlights

- **Solo Leveling HUD & Dark Aesthetic**: `#040b14` dark navy canvas, neon cyan (`#00f3ff`) and purple (`#9d4edd`) accents, high-contrast monospace typography.
- **Dedicated Guided Workout Engine**:
  - Full Workout Preparation screen with exercise roster, duration, difficulty, equipment, and stat targets.
  - Active Workout Screen with movement sequence, countdown/rep targets, pause/resume, skip, and rest transitions.
  - Animated SVG exercise illustrations for push-ups, squats, planks, lunges, mountain climbers, burpees, crunches, and rest.
  - Safe-exit confirmation modal prevents accidental dismissal.
  - Triumphant completion screen awarding XP and stats exactly once.
- **5-Axis Pentagon Stat Radar**: Strength, Knowledge, Discipline, Health, and Mindfulness updating live via SVG.
- **Character Dossier & Onboarding**: Baseline hunter awakening, rank progression (E-Rank through National Level), title designation, and biometric tracking.
- **Activity Modules & Tools**:
  - ⚔️ **Workout Module**: Guided dungeon raids + custom lifting set logger.
  - ⏱️ **Study Pomodoro**: 25m, 50m, 90m focus countdown timer with topic verification and Knowledge XP accreditation.
  - 📝 **Daily 3-Prompt Journal**: Wins, friction points, tomorrow's plan, mood/energy audit -> Mindfulness XP.
  - 🛡️ **Discipline Matrix**: Screen unlocks, reels reduction tracker, and discipline victory checkpoints.
- **Local-First Architecture**: AsyncStorage serves as the source of truth for personal progress, ensuring 100% offline autonomy and instant responsiveness. Optional cloud gateway handles remote AI directive generation.

---

## 🚀 Quick Start (One Command)

### Run Both Frontend & Backend Concurrently:
```bash
npm run dev
```
*Starts the Express backend on `http://localhost:5000` and Expo Web on `http://localhost:8081`.*

The app sends AI requests to the backend under `/api`. For Expo Web, the default is
the current browser host on port `5000`. If Expo is running on another device or
host, set `EXPO_PUBLIC_API_URL` before starting Expo, for example:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:5000/api npx expo start
```

The value may also be supplied as `http://192.168.1.20:5000`; the app normalizes
the `/api` suffix.

---

## 🧪 Testing & Verification

- **Run all automated tests (Engine & Backend)**:
  ```bash
  npm test
  ```
- **Type check**:
  ```bash
  npx tsc --noEmit
  ```
- **Expo Web Production Export**:
  ```bash
  npx expo export --platform web
  ```
