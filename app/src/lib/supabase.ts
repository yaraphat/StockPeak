import postgres from "postgres";

const connectionString = process.env.DATABASE_URL ?? "";

let sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!connectionString) {
    throw new Error("DATABASE_URL not configured");
  }
  if (!sql) {
    sql = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return sql;
}
