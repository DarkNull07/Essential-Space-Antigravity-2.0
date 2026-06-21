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
    let clean = raw;
    if (!/^https?:\/\//i.test(clean)) {
      clean = `https://${clean}`;
    }
    
    const parsedUrl = new URL(clean);
    let domain = parsedUrl.hostname;
    
    // Strip www. prefix
    if (domain.startsWith("www.")) {
      domain = domain.substring(4);
    }
    
    const parts = domain.split(".");
    if (parts.length >= 1) {
      const mainName = parts[0].toLowerCase();
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
      
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
  } catch (err) {
    // Fail gracefully back to the raw string on malformed inputs
  }

  return raw;
}
