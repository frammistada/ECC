export const FREE_ENTRY_LIMIT = 5;

export function isSubscribed(profile) {
  return profile?.subscription_status === "active";
}
