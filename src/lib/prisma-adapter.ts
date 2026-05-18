import { PrismaMariaDb } from "@prisma/adapter-mariadb";

function parseInteger(value: string | null, fallback?: number) {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: string | null, fallback = false) {
  if (value === null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function createPrismaAdapter() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL manquant.");
  }

  const url = new URL(connectionString);
  const database = url.pathname.replace(/^\/+/, "");
  const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const allowPublicKeyRetrieval = parseBoolean(
    url.searchParams.get("allowPublicKeyRetrieval") ?? url.searchParams.get("allow_public_key_retrieval"),
    isLocalHost,
  );

  if (!database) {
    throw new Error("DATABASE_URL invalide: nom de base introuvable.");
  }

  return new PrismaMariaDb({
    host: url.hostname === "localhost" ? "127.0.0.1" : url.hostname,
    port: parseInteger(url.port, 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit: parseInteger(url.searchParams.get("connection_limit"), 20),
    acquireTimeout: parseInteger(url.searchParams.get("acquire_timeout"), 8000),
    connectTimeout: (() => {
      const seconds = parseInteger(url.searchParams.get("connect_timeout"), undefined);
      return seconds === undefined ? undefined : seconds * 1000
    })(),
    idleTimeout: parseInteger(url.searchParams.get("max_idle_connection_lifetime"), undefined),
    allowPublicKeyRetrieval,
  });
}
