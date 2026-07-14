import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiFetch } from '@/api/client';

export async function registerPushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await apiFetch('/api/push-tokens', {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' }),
    });
  } catch (e) {
    // Expected to fail until a real EAS project ID exists (see STORE_SUBMISSION.md) —
    // must never crash the app.
    if (__DEV__) console.warn('registerPushToken failed', e);
  }
}
