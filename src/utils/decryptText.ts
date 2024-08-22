import { createDecipheriv, createHash } from "crypto";

export default function decryptText(encryptedText: string) {

  const password = process.env.ENCRYPTION_PASSWORD;
  if (!password) throw new Error("ENCRYPTION_PASSWORD environment variable required.");

  const textParts = encryptedText.split(':');
  const iv = Buffer.from(textParts.shift() as string, 'hex');

  const encryptedData = Buffer.from(textParts.join(':'), 'hex');
  const key = createHash('sha256').update(password).digest('base64').substr(0, 32);
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  
  const decrypted = decipher.update(encryptedData);
  const decryptedText = Buffer.concat([decrypted, decipher.final()]);
  return decryptedText.toString();

}