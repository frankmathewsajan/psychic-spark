import type { SQLiteDatabase } from "expo-sqlite";
import { prepareTier1Batch, resolveTier1Batch } from "../../core/db/repository";
import { logger } from "../../core/logger";

export async function executeTier1Sync(
	db: SQLiteDatabase,
	gatewayUrl: string,
): Promise<boolean> {
	const batchData = await prepareTier1Batch(db, 15);
	if (!batchData) {
		logger.info("SyncTier1", "No pending records to dispatch");
		return true;
	}

	logger.info(
		"SyncTier1",
		`Dispatching batch of ${batchData.ids.length} records`,
	);

	try {
		const res = await fetch(`${gatewayUrl}/api/v1/inspections/batch`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(batchData.batch),
		});

		const isSuccess = res.ok;
		await resolveTier1Batch(db, batchData.ids, isSuccess);
		logger.info(
			"SyncTier1",
			`Batch resolution: ${isSuccess ? "SYNCED" : "FAILED_REVERTED"}`,
		);
		return isSuccess;
	} catch (err) {
		logger.error("SyncTier1", "Network failure during batch sync", err);
		await resolveTier1Batch(db, batchData.ids, false);
		return false;
	}
}
