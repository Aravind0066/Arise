# Welcome to your Expo app 👋

## Arise V1

Arise is a deadline-based quest app. The Express backend calculates quest status
(`active`, `expired`, or `completed`), rejects completion after a deadline, prevents
duplicate rewards, and can generate three validated quests through Gemini.

### Run locally

```bash
npm install
npm run web

cd backend
npm install
cp .env.example .env
npm start
```

Set `EXPO_PUBLIC_API_URL` to the backend API base URL (for example,
`http://localhost:5000/api`). For a physical device, use the computer's LAN IP
instead of `localhost`.

### API workflow

- `POST /api/users` creates a user.
- `POST /api/quests` creates a quest with `deadline`.
- `GET /api/quests?userId=<id>` returns quests with calculated status, including
  completed status for that user.
- `POST /api/quests/generate` sends a goal to Gemini, validates exactly three
  recommendations, assigns deadlines, and saves them.
- `POST /api/completedquests/complete` completes a quest and awards XP once.
- `GET /api/completedquests/:userId` returns completion history.

### AWS deployment

The backend includes [`backend/Dockerfile`](./backend/Dockerfile) and
[`backend/apprunner.yaml`](./backend/apprunner.yaml). The fastest deployment is
AWS App Runner from the repository, using the backend directory as the source.
Configure `PORT=5000`, `MONGO_URI`, `GEMINI_API_KEY`, and `GEMINI_MODEL` as
App Runner environment variables or AWS Secrets Manager values. Set the health
check path to `/` and allow inbound MongoDB Atlas access from the App Runner
service. Do not commit `.env` or API keys.

The Gemini key belongs only in the backend environment. Never put it in Expo
code, `EXPO_PUBLIC_*` variables, Git, or an AWS client bundle.

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
