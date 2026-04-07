/**
 * Browser Push Notification utility for incoming calls.
 * Safe for all platforms including iOS Safari (which lacks Notification API).
 */

const hasNotificationAPI = typeof window !== 'undefined' && 'Notification' in window;
let permissionGranted = false;

export async function requestNotificationPermission() {
  if (!hasNotificationAPI) return false;
  try {
    if (Notification.permission === 'granted') { permissionGranted = true; return true; }
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    permissionGranted = result === 'granted';
    return permissionGranted;
  } catch { return false; }
}

export function showCallNotification(callerName, callType = 'voice') {
  if (!hasNotificationAPI) return null;
  try {
    if (!permissionGranted && Notification.permission !== 'granted') return null;
    if (document.hasFocus()) return null;
    const title = callType === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call';
    const notification = new Notification(title, {
      body: `${callerName} is calling you`,
      icon: '/beatx-logo.jpeg',
      tag: `call-${callType}-${Date.now()}`,
      requireInteraction: true,
      silent: false,
    });
    notification.onclick = () => { window.focus(); notification.close(); };
    setTimeout(() => { try { notification.close(); } catch {} }, 30000);
    return notification;
  } catch { return null; }
}

export function dismissCallNotification(notification) {
  if (notification) { try { notification.close(); } catch {} }
}
