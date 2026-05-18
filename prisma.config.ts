import "dotenv/config";
import { defineConfig, env } from "prisma/config";

function normalizeDatasourceUrl(value: string) {
  const url = new URL(value);
  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
  }
  return url.toString();
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: normalizeDatasourceUrl(env("DATABASE_URL")),
  },
});

