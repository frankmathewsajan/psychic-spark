import type { SQLiteDatabase } from "expo-sqlite";
import { logger } from "../../core/logger";

interface PendingPhotoRecord {
	id: string;
	image_local_path: string;
}

export async function executeTier2MediaSync(
	db: SQLiteDatabase,
	gatewayUrl: string,
): Promise<boolean> {
	const pending = await db.getAllAsync<PendingPhotoRecord>(
		`SELECT id, image_local_path FROM inspections 
		 WHERE sync_tier2_status = 'PENDING' AND image_local_path IS NOT NULL 
		 LIMIT 5;`,
	);

	if (pending.length === 0) {
		logger.info("SyncTier2", "No pending audit photos to sync");
		return true;
	}

	logger.info("SyncTier2", `Syncing ${pending.length} pending audit photos`);

	for (const item of pending) {
		const formData = new FormData();
		formData.append("photo_type", "CASING");

		// React Native specific multipart file attachment
		formData.append("file", {
			uri: item.image_local_path,
			name: `${item.id}_CASING.jpg`,
			type: "image/jpeg",
		} as unknown as Blob);

		try {
			const res = await fetch(
				`${gatewayUrl}/api/v1/inspections/${item.id}/image`,
				{
					method: "POST",
					body: formData,
				},
			);

			if (res.ok) {
				await db.runAsync(
					`UPDATE inspections SET sync_tier2_status = 'SYNCED' WHERE id = ?;`,
					[item.id],
				);
				logger.info("SyncTier2", `Synced image for inspection ${item.id}`);
			} else {
				logger.warn(
					"SyncTier2",
					`Server rejected image for ${item.id} with status ${res.status}`,
				);
			}
		} catch (err) {
			logger.error(
				"SyncTier2",
				`Network failure syncing image for ${item.id}`,
				err,
			);
			return false;
		}
	}

	return true;
}
