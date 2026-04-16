import { useCallback } from "react";

export interface UseNotificationsReturn {
  permission: NotificationPermission;
  canNotify: boolean;
  requestPermission: () => Promise<NotificationPermission>;
}

export function useNotifications(): UseNotificationsReturn {
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    return "granted";
  }, []);

  return {
    permission: "granted",
    canNotify: true,
    requestPermission,
  };
}
