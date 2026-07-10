type ApiEnvironment = {
  jwtSecret: string;
  nodeEnv: "development" | "test" | "staging" | "production";
  port: number;
  webOrigin: string;
  webmailCredentialEncryptionSecret: string;
};

const allowedNodeEnvs = ["development", "test", "staging", "production"] as const;

function readNodeEnv(value: string | undefined): ApiEnvironment["nodeEnv"] {
  if (value && allowedNodeEnvs.includes(value as ApiEnvironment["nodeEnv"])) {
    return value as ApiEnvironment["nodeEnv"];
  }

  return "development";
}

function readPort(value: string | undefined): number {
  if (!value) {
    return 4000;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("API_PORT must be an integer between 1 and 65535.");
  }

  return port;
}

function readRequiredSecret(value: string | undefined, name: string): string {
  if (!value || value.length < 32) {
    throw new Error(`${name} must be set and contain at least 32 characters.`);
  }

  return value;
}

export const env: ApiEnvironment = {
  jwtSecret: readRequiredSecret(process.env.JWT_SECRET, "JWT_SECRET"),
  nodeEnv: readNodeEnv(process.env.NODE_ENV),
  port: readPort(process.env.API_PORT),
  webOrigin: process.env.WEB_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  webmailCredentialEncryptionSecret: readRequiredSecret(
    process.env.WEBMAIL_CREDENTIAL_ENCRYPTION_SECRET ?? process.env.JWT_SECRET,
    "WEBMAIL_CREDENTIAL_ENCRYPTION_SECRET",
  ),
};
