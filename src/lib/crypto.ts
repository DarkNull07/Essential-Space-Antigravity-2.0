import crypto from "crypto";

const hexKey = process.env.API_KEY_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
let ENCRYPTION_KEY: Buffer;

if (hexKey) {
  if (hexKey.length === 64) {
    ENCRYPTION_KEY = Buffer.from(hexKey, "hex");
  } else {
    ENCRYPTION_KEY = Buffer.alloc(32);
    const keyBuf = Buffer.from(hexKey, "utf8");
    keyBuf.copy(ENCRYPTION_KEY);
  }
} else {
  // Static development fallback (32-byte key)
  ENCRYPTION_KEY = Buffer.from("f5e718b52f36f6d0f522384a20b0c6194488339ab301b0f592cfdf36a8e80556", "hex");
}

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
