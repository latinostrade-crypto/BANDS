declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
        HapticFeedback?: {
          impactOccurred?: (style: "light" | "medium" | "heavy") => void;
          notificationOccurred?: (type: "success" | "warning" | "error") => void;
        };
      };
    };
  }
}

export const tma = {
  init() {
    window.Telegram?.WebApp?.ready?.();
    window.Telegram?.WebApp?.expand?.();
  },
  initData() {
    return window.Telegram?.WebApp?.initData ?? "";
  },
  impact() {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
  },
  success() {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
  },
  error() {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
  }
};
