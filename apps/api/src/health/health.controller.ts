import { Controller, Get } from "@nestjs/common";

type HealthResponse = {
  status: "healthy";
  service: "JPosta API";
  version: "0.1.0";
  environment: string;
  uptime: number;
  timestamp: string;
};

@Controller("health")
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: "healthy",
      service: "JPosta API",
      version: "0.1.0",
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
