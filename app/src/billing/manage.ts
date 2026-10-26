// "Manage or cancel in Google Play" (spec F39, design.md 5): Play's subscription centre deep link for this SKU.
import { Linking } from 'react-native';
import { MANAGE_SUBSCRIPTION_URL } from './products';

export function manageSubscriptionUrl(): string {
  return MANAGE_SUBSCRIPTION_URL;
}

export async function openManageSubscription(open: (url: string) => Promise<unknown> = (u) => Linking.openURL(u)): Promise<boolean> {
  try {
    await open(manageSubscriptionUrl());
    return true;
  } catch {
    return false;
  }
}
