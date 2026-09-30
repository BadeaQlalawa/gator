import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.ts";
import { readConfig } from "../../config.ts";

const config = readConfig();
const conn = postgres(config.dbUrl);

export const db = drizzle(conn, { schema });
