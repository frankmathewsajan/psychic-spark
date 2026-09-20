import * as SQLite from "expo-sqlite";
import { runDatabaseInit } from "./schema";

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
	if (!dbInstance) {
		dbInstance = await SQLite.openDatabaseAsync("inspections.db");
		await runDatabaseInit(dbInstance);
	}
	return dbInstance;
}
