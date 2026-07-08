type ApiEnvironment = {
  nodeEnv: "development" | "test" | "staging" | "production";
  port: number;
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

export const env: ApiEnvironment = {
  nodeEnv: readNodeEnv(process.env.NODE_ENV),
  port: readPort(process.env.API_PORT),
};
