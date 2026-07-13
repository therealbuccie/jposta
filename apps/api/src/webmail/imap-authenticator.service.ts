import { Injectable, UnauthorizedException } from "@nestjs/common";
import { connect, type TLSSocket } from "node:tls";

@Injectable()
export class ImapAuthenticator {
  authenticate(email: string, password: string) {
    return authenticateImap(email, password);
  }
}

type ImapAuthConfig = {
  host: string;
  port: number;
  servername: string;
  rejectUnauthorized: boolean;
  socketTimeout: number;
};

type ImapAuthFailureDetails = {
  code?: string | undefined;
  responseCode?: string | undefined;
  message: string;
  stage: string;
  host: string;
  port: number;
  servername: string;
  mechanism: string;
  tlsAuthorized?: boolean | undefined;
  tlsAuthorizationError?: unknown;
  capability?: string | undefined;
  serverLine?: string | undefined;
};

class ImapAuthenticationError extends UnauthorizedException {
  readonly details: ImapAuthFailureDetails;

  constructor(details: ImapAuthFailureDetails) {
    super(process.env.NODE_ENV === "production" ? "Invalid email or password." : details.message);
    this.name = "ImapAuthenticationError";
    this.details = details;
  }
}

function authenticateImap(email: string, password: string) {
  const config = readImapAuthConfig();
  const mechanism = "LOGIN";

  console.info("Webmail IMAP authentication starting", {
    email,
    host: config.host,
    port: config.port,
    servername: config.servername,
    secure: true,
    rejectUnauthorized: config.rejectUnauthorized,
    mechanism,
    socketTimeout: config.socketTimeout,
    comparison:
      "doveadm auth test validates the Dovecot auth backend; this verifies IMAPS TLS plus IMAP LOGIN.",
  });

  return new Promise<void>((resolve, reject) => {
    const socket = connect({
      host: config.host,
      port: config.port,
      servername: config.servername,
      rejectUnauthorized: config.rejectUnauthorized,
    });
    const capabilityTag = "A001";
    const loginTag = "A002";
    const logoutTag = "A003";
    let settled = false;
    let buffer = "";
    let stage = "tls-connect";
    let capability = "";
    let tlsAuthorized: boolean | undefined;
    let tlsAuthorizationError: unknown;

    const fail = (message: string, extra: Partial<ImapAuthFailureDetails> = {}) => {
      if (settled) return;
      settled = true;
      const details: ImapAuthFailureDetails = {
        message,
        stage,
        host: config.host,
        port: config.port,
        servername: config.servername,
        mechanism,
        tlsAuthorized,
        tlsAuthorizationError,
        capability,
        ...extra,
      };
      console.error("Webmail IMAP authentication failed", details);
      socket.destroy();
      reject(new ImapAuthenticationError(details));
    };

    const pass = () => {
      if (settled) return;
      settled = true;
      stage = "logout";
      console.info("Webmail IMAP authentication succeeded", {
        email,
        host: config.host,
        port: config.port,
        servername: config.servername,
        mechanism,
        tlsAuthorized,
        capability,
      });
      socket.write(`${logoutTag} LOGOUT\r\n`);
      socket.end();
      resolve();
    };

    const sendCapability = () => {
      stage = "capability";
      console.info("Webmail IMAP capability request", {
        host: config.host,
        port: config.port,
        servername: config.servername,
      });
      socket.write(`${capabilityTag} CAPABILITY\r\n`);
    };

    const sendLogin = () => {
      stage = "login";
      console.info("Webmail IMAP LOGIN command sending", {
        email,
        host: config.host,
        port: config.port,
        servername: config.servername,
        mechanism,
        capability,
      });
      socket.write(`${loginTag} LOGIN ${quote(email)} ${quote(password)}\r\n`);
    };

    socket.setTimeout(config.socketTimeout, () => {
      fail(`IMAP authentication timed out during ${stage}.`, { code: "Timeout" });
    });

    socket.on("error", (error: NodeJS.ErrnoException) => {
      fail(error.message || "IMAP socket error.", {
        code: error.code,
        message: error.message || "IMAP socket error.",
      });
    });

    socket.on("close", () => {
      if (!settled) fail(`IMAP socket closed during ${stage}.`, { code: "ConnectionClosed" });
    });

    socket.on("secureConnect", () => {
      stage = "server-greeting";
      tlsAuthorized = socket.authorized;
      tlsAuthorizationError = socket.authorizationError;
      console.info("Webmail IMAP TLS connected", {
        host: config.host,
        port: config.port,
        servername: config.servername,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError,
        protocol: socket.getProtocol(),
        cipher: safeCipher(socket),
      });
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let lineEnd = buffer.indexOf("\n");

      while (lineEnd >= 0) {
        const line = buffer.slice(0, lineEnd).replace(/\r$/, "");
        buffer = buffer.slice(lineEnd + 1);
        processLine(line);
        lineEnd = buffer.indexOf("\n");
      }
    });

    const processLine = (line: string) => {
      if (!line) return;
      console.info("Webmail IMAP server line", redactLoginLine(line));

      if (stage === "server-greeting") {
        if (line.startsWith("* OK")) {
          sendCapability();
          return;
        }
        if (line.startsWith("* BYE") || line.startsWith("* NO") || line.startsWith("* BAD")) {
          fail(`IMAP server rejected connection: ${line}`, { serverLine: line });
        }
        return;
      }

      if (stage === "capability") {
        if (line.startsWith("* CAPABILITY")) {
          capability = line;
          return;
        }
        if (line.startsWith(`${capabilityTag} OK`)) {
          sendLogin();
          return;
        }
        if (line.startsWith(`${capabilityTag} NO`) || line.startsWith(`${capabilityTag} BAD`)) {
          console.warn("Webmail IMAP capability failed; trying LOGIN anyway", { line });
          sendLogin();
        }
        return;
      }

      if (stage === "login") {
        if (line.startsWith(`${loginTag} OK`)) {
          pass();
          return;
        }
        if (line.startsWith(`${loginTag} NO`) || line.startsWith(`${loginTag} BAD`)) {
          fail(`IMAP LOGIN failed: ${line}`, {
            responseCode: parseResponseCode(line),
            serverLine: line,
          });
        }
      }
    };
  });
}

function readImapAuthConfig(): ImapAuthConfig {
  const host = process.env.IMAP_HOST || process.env.WEBMAIL_IMAP_HOST || "jposta-mailserver";
  return {
    host,
    port: readPort(process.env.IMAP_PORT || process.env.WEBMAIL_IMAP_PORT),
    servername:
      process.env.IMAP_TLS_SERVERNAME ||
      process.env.WEBMAIL_IMAP_SERVERNAME ||
      process.env.IMAP_SERVERNAME ||
      "mail.jposta.com",
    rejectUnauthorized: process.env.WEBMAIL_IMAP_REJECT_UNAUTHORIZED !== "false",
    socketTimeout: readTimeout(process.env.WEBMAIL_IMAP_TIMEOUT_MS),
  };
}

function readPort(value: string | undefined) {
  if (!value) return 993;
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return 993;
  return port;
}

function readTimeout(value: string | undefined) {
  if (!value) return 12000;
  const timeout = Number.parseInt(value, 10);
  if (!Number.isInteger(timeout) || timeout < 1000) return 12000;
  return timeout;
}

function quote(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function safeCipher(socket: TLSSocket) {
  try {
    return socket.getCipher();
  } catch {
    return null;
  }
}

function parseResponseCode(line: string) {
  const match = line.match(/\[([^\]]+)\]/);
  return match?.[1];
}

function redactLoginLine(line: string) {
  return line.replace(/(LOGIN\s+"[^"]+"\s+")[^"]+(")/i, "$1[redacted]$2");
}
