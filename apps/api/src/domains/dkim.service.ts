import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createCipheriv, createHash, generateKeyPairSync, randomBytes } from "node:crypto";

@Injectable()
export class DkimService {
  generateDomainKey() {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
    });

    return {
      dnsPublicKey: toDkimDnsValue(publicKey),
      encryptedPrivateKey: encryptPrivateKey(privateKey),
    };
  }
}

function encryptPrivateKey(privateKey: string) {
  const secret = process.env.DOMAIN_KEY_ENCRYPTION_SECRET;

  if (!secret || secret.length < 32) {
    throw new ServiceUnavailableException(
      "DOMAIN_KEY_ENCRYPTION_SECRET must be set before creating domains.",
    );
  }

  const iv = randomBytes(12);
  const key = createHash("sha256").update(secret).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function toDkimDnsValue(publicKey: string) {
  const compactKey = publicKey
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s+/g, "");

  return `v=DKIM1; k=rsa; p=${compactKey}`;
}
