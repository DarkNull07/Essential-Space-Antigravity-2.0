import crypto from "crypto";

// Resolve the encryption key from environment variables.
// Accepted format: exactly 64 lowercase-or-uppercase hex characters (= 32 bytes for AES-256).
//
// If the variable is missing OR in the wrong format, we throw immediately at module
// load time so misconfiguration causes a loud startup crash rather than silently
// encrypting user data under a weak or publicly-known key.
const hexKey = process.env.API_KEY_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

if (!hexKey) {
  throw new Error(
    "[crypto] Missing required environment variable: API_KEY_ENCRYPTION_KEY (or ENCRYPTION_KEY).\n" +
    "Set it to a 64-character hex string (32 random bytes in hex). " +
    "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
  throw new Error(
    `[crypto] API_KEY_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ` +
    `Got ${hexKey.length} characters. ` +
    "Generate a valid key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

const ENCRYPTION_KEY: Buffer = Buffer.from(hexKey, "hex");

/**
 * Encrypt a text string using AES-256-GCM
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  // Format: v1:iv_hex:auth_tag_hex:ciphertext_hex
  return `v1:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.startsWith("v1:")) {
    // If not encrypted (legacy records), return as-is
    return encryptedText;
  }
  
  const parts = encryptedText.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted text format");
  }
  
  const [, ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Mask raw key content so only a safe prefix/suffix is exposed
 */
export function maskKey(key: string): string {
  if (!key) return "";
  let rawKey = key;
  if (key.startsWith("v1:")) {
    try {
      rawKey = decrypt(key);
    } catch {
      return "••••••••";
    }
  }
  if (rawKey.length <= 8) {
    return "••••" + rawKey.slice(-2);
  }
  return `${rawKey.slice(0, 4)}••••${rawKey.slice(-4)}`;
}
