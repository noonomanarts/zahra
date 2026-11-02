import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PRIVATE_DIR } from "./uploads";

/**
 * Payment keys are entered in the admin and stored encrypted (AES-256-GCM). The key comes from SETTINGS_SECRET,
 * or from a file created beside the private uploads; either way it never lives in the database, so a copy of the
 * database alone reveals nothing.
 */
function encryptionKey() {
  const secret = process.env.SETTINGS_SECRET;
  if (secret) return createHash("sha256").update(secret).digest();
  const file = path.join(PRIVATE_DIR, ".settings-key");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
  }
  return Buffer.from(fs.readFileSync(file, "utf8").trim(), "hex");
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
}

/** The stored value, or null when it can't be read (for example the key changed). */
export function decryptSecret(stored: string | undefined | null) {
  if (!stored) return null;
  try {
    const [version, iv, tag, data] = stored.split(".");
    if (version !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch (error) {
    console.error("could not decrypt a stored payment key", error);
    return null;
  }
}
