/**
 * Authentification admin minimaliste : un seul mot de passe partagé
 * (ADMIN_PASSWORD), et une session matérialisée par un cookie signé en HMAC
 * (pas de base de données de sessions nécessaire pour le MVP).
 *
 * Implémenté avec l'API Web Crypto (`crypto.subtle`) plutôt que le module
 * `node:crypto`, afin d'être utilisable aussi bien dans les routes API
 * (runtime Node) que dans le middleware (runtime Edge).
 */

export const ADMIN_COOKIE_NAME = "lr_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET n'est pas défini.");
  }
  return secret;
}

/** Encode un ArrayBuffer en base64url, sans dépendre de node:buffer (compatible Edge runtime). */
function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bufferToBase64Url(sig);
}

/** Construit la valeur du cookie de session pour un admin authentifié. */
export async function createAdminSessionToken(): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${expiresAt}`;
  const signature = await hmac(payload, getSecret());
  return `${payload}.${signature}`;
}

/** Vérifie la valeur d'un cookie de session admin. */
export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = await hmac(payload, getSecret());
  if (expected !== signature) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return true;
}

export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
