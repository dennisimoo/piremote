const PASSWORD = process.env.BLACKBOX_PASSWORD || process.env.PIREMOTE_PASSWORD || "blackbox";

export function validatePassword(password: string): boolean {
  return password === PASSWORD;
}

export function createToken(): string {
  return Buffer.from(Date.now().toString() + PASSWORD).toString("base64");
}

export function validateToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64").toString();
    return decoded.endsWith(PASSWORD);
  } catch {
    return false;
  }
}
