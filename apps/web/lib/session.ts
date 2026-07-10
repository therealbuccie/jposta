import type { AuthSession, Organization } from "./api-client";

const sessionKey = "jposta.session";
const organizationKey = "jposta.organization";

export function getStoredSession() {
  return readJson<AuthSession>(sessionKey);
}

export function saveSession(session: AuthSession) {
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(sessionKey);
  localStorage.removeItem(organizationKey);
}

export function getStoredOrganization() {
  return readJson<Organization>(organizationKey);
}

export function saveOrganization(organization: Organization) {
  localStorage.setItem(organizationKey, JSON.stringify(organization));
}

function readJson<T>(key: string) {
  if (typeof window === "undefined") return null;

  const value = localStorage.getItem(key);
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}
