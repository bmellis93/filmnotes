// lib/ghl/ssoContext.ts
import "server-only";
import crypto from "crypto";

export type GhlSsoContext = {
  userId?: string;
  companyId?: string;
  activeLocation?: string; // present when the Custom Page is mounted at the location level
  role?: string;
  type?: "agency" | "location" | string;
  userName?: string;
  email?: string;
  isAgencyOwner?: boolean;
};

/**
 * GHL encrypts the Custom Page SSO payload with `CryptoJS.AES.encrypt(json, sharedSecret)`
 * on their end -- that's OpenSSL's legacy passphrase-based format ("Salted__" + 8-byte
 * salt header, key/iv derived via EVP_BytesToKey/MD5), not a raw AES key+IV. Node's
 * `crypto` module has no built-in support for that KDF, so we replicate it here instead
 * of pulling in the `crypto-js` package just for this one call site.
 */
function deriveKeyAndIv(password: Buffer, salt: Buffer, keyLen: number, ivLen: number) {
  let derived = Buffer.alloc(0);
  let prev = Buffer.alloc(0);

  while (derived.length < keyLen + ivLen) {
    prev = crypto.createHash("md5").update(Buffer.concat([prev, password, salt])).digest();
    derived = Buffer.concat([derived, prev]);
  }

  return {
    key: derived.subarray(0, keyLen),
    iv: derived.subarray(keyLen, keyLen + ivLen),
  };
}

export function decryptGhlSsoPayload(base64Payload: string, sharedSecret: string): GhlSsoContext {
  const raw = Buffer.from(base64Payload, "base64");

  const header = raw.subarray(0, 8).toString("utf8");
  if (header !== "Salted__") {
    throw new Error("Unexpected GHL SSO payload format (missing Salted__ header)");
  }

  const salt = raw.subarray(8, 16);
  const ciphertext = raw.subarray(16);

  const { key, iv } = deriveKeyAndIv(Buffer.from(sharedSecret, "utf8"), salt, 32, 16);

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return JSON.parse(decrypted.toString("utf8"));
}
