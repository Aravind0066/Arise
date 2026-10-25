import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from './api';

const USER_KEY = 'arise.currentUser';

export async function loadCurrentUser(): Promise<User | null> {
  const value = await AsyncStorage.getItem(USER_KEY);
  return value ? JSON.parse(value) as User : null;
}

export async function saveCurrentUser(user: User) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearCurrentUser() {
  await AsyncStorage.removeItem(USER_KEY);
}
