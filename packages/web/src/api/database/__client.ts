// TEMPLATE-MANAGED (__ prefix) — do not edit. Define tables in ./schema.ts
// and query via: import { db } from "./database";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file::memory:?cache=shared";

const client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
