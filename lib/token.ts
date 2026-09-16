import crypto from "crypto";

/** Génère un token opaque, cryptographiquement aléatoire, encodé en base64url. */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
