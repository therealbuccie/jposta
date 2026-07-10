import { Injectable, UnauthorizedException } from "@nestjs/common";
import { connect } from "node:tls";

@Injectable()
export class ImapAuthenticator {
  authenticate(email: string, password: string) {
    return authenticateImap(email, password);
  }
}

function authenticateImap(email: string, password: string) {
  return new Promise<void>((resolve, reject) => {
    const socket = connect({ host: "mail.jposta.com", port: 993, servername: "mail.jposta.com" });
    const tag = "A001";
    let settled = false;
    let buffer = "";

    const fail = () => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new UnauthorizedException("Invalid email or password."));
    };

    const pass = () => {
      if (settled) return;
      settled = true;
      socket.write("A002 LOGOUT\r\n");
      socket.end();
      resolve();
    };

    socket.setTimeout(8000, fail);
    socket.on("error", fail);
    socket.on("secureConnect", () => {
      socket.write(`${tag} LOGIN ${quote(email)} ${quote(password)}\r\n`);
    });
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (buffer.includes(`${tag} OK`)) pass();
      if (buffer.includes(`${tag} NO`) || buffer.includes(`${tag} BAD`)) fail();
    });
  });
}

function quote(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
