const webmailSessionKey = "jposta.webmail.session";

export type WebmailSession = {
  mailbox?: {
    address: string;
    displayName: string;
  };
  portal?: {
    displayName: string;
    slug: string;
  };
  token: string;
};

export function getStoredWebmailSession() {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(webmailSessionKey);
  if (!value) return null;

  try {
    return JSON.parse(value) as WebmailSession;
  } catch {
    localStorage.removeItem(webmailSessionKey);
    return null;
  }
}

export function saveWebmailSession(session: WebmailSession) {
  localStorage.setItem(webmailSessionKey, JSON.stringify(session));
}

export function clearWebmailSession() {
  localStorage.removeItem(webmailSessionKey);
}
