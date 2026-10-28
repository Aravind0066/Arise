import AsyncStorage from '@react-native-async-storage/async-storage';

type LocalCurrentUser = {
  _id: string;
  name: string;
  email: string;
  xp: number;
  level: number;
};

const USER_KEY = 'arise.currentUser';

export async function loadCurrentUser(): Promise<LocalCurrentUser | null> {
  const value = await AsyncStorage.getItem(USER_KEY);
  return value ? JSON.parse(value) as LocalCurrentUser : null;
}

export async function saveCurrentUser(user: LocalCurrentUser) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearCurrentUser() {
  await AsyncStorage.removeItem(USER_KEY);
}
