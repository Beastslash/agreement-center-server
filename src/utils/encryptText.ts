import { createCipheriv, randomBytes, createHash } from "crypto";

export default function encryptText(plainText: string) {

  const password = process.env.ENCRYPTION_PASSWORD;
  if (!password) throw new Error("ENCRYPTION_PASSWORD environment variable required.");

  const iv = randomBytes(16);
  const key = createHash("sha256").update(password).digest("base64").slice(0, 32);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(plainText);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  return encrypted.toString('hex');

}