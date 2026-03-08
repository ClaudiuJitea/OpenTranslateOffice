import bcrypt from "bcryptjs";

export function generateRequestNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `REQ-${year}-${random}`;
}

export function generatePortalPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function hashPortalPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPortalPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
