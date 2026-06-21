export function sanitizeTitle(title: string | null, fallbackUrl: string): string {
  const raw = (title && title.trim()) || fallbackUrl;
  if (!raw) return "";

  // Check if raw is a URL or domain pattern
  const isUrlOrDomain = /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/.test(raw);
  if (!isUrlOrDomain) {
    return raw;
  }

  try {
    // Wrap domain parsing in try/catch to fail gracefully back to raw if URL throws
    let clean = raw.trim();
    if (!/^https?:\/\//i.test(clean)) {
      clean = `https://${clean}`;
    }
    
    const parsedUrl = new URL(clean);
    const domain = parsedUrl.hostname;
    const parts = domain.split(".");
    
    // 1. Strip common subdomains from the start
    const commonSubdomains = new Set([
      "www", "app", "beta", "dev", "play", "status", "blog", 
      "docs", "mail", "admin", "dashboard", "portal", "test", "staging"
    ]);
    while (parts.length > 2 && commonSubdomains.has(parts[0].toLowerCase())) {
      parts.shift();
    }

    // 2. Identify the brand part
    // Handle regional layouts / SLD fragments (e.g. google.co.uk, amazon.com.br)
    const regionalSlds = new Set(["co", "com", "org", "net", "edu", "gov", "ac", "asn", "ltd", "plc"]);
    let brandIndex = parts.length - 2; // Default to second to last (e.g., brand.com)

    if (parts.length >= 3) {
      const secondToLast = parts[parts.length - 2].toLowerCase();
      const last = parts[parts.length - 1].toLowerCase();
      
      // If the second-to-last part is a known SLD or very short (<= 3 chars) and the last part is a country code (2 chars)
      if (regionalSlds.has(secondToLast) || (secondToLast.length <= 3 && last.length === 2)) {
        brandIndex = parts.length - 3;
      }
    }

    if (brandIndex < 0) {
      brandIndex = 0;
    }

    const brandPart = parts[brandIndex];
    if (brandPart) {
      const mainName = brandPart.toLowerCase();
      const overrides: Record<string, string> = {
        youtube: "YouTube",
        github: "GitHub",
        google: "Google",
        facebook: "Facebook",
        twitter: "Twitter",
        linkedin: "LinkedIn",
      };
      
      if (overrides[mainName]) {
        return overrides[mainName];
      }
      
      return brandPart.charAt(0).toUpperCase() + brandPart.slice(1);
    }
  } catch (err) {
    // Fail gracefully back to the raw string on malformed inputs
  }

  return raw;
}

// Safe Base64 conversions using TextDecoder and TextEncoder
export function base64ToString(base64: string): string {
  try {
    const cleanBase64 = base64.startsWith("data:") 
      ? base64.split(",")[1] 
      : base64;
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  } catch (err) {
    console.error("base64ToString decoding error, falling back:", err);
    try {
      return decodeURIComponent(escape(atob(base64.split(",")[1] || base64)));
    } catch {
      return base64;
    }
  }
}

export function stringToBase64(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let binaryString = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    return btoa(binaryString);
  } catch (err) {
    console.error("stringToBase64 encoding error, falling back:", err);
    return btoa(unescape(encodeURIComponent(str)));
  }
}

