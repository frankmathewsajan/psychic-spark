import * as Location from "expo-location";
import { logger } from "./logger";

export interface GeoCoordinates {
	latitude: number;
	longitude: number;
}

let cachedCoords: GeoCoordinates | null = null;

/**
 * Requests location permissions and returns current GPS coordinates.
 * Tries fast last-known position first, then refines with current GPS fix.
 */
export async function getCurrentCoordinates(): Promise<GeoCoordinates> {
	try {
		const { status } = await Location.requestForegroundPermissionsAsync();
		if (status !== "granted") {
			logger.warn("Location", "Foreground location permission not granted");
			return cachedCoords || { latitude: 0, longitude: 0 };
		}

		// 1. Fast cache hit from last known position
		const lastKnown = await Location.getLastKnownPositionAsync();
		if (lastKnown?.coords) {
			cachedCoords = {
				latitude: lastKnown.coords.latitude,
				longitude: lastKnown.coords.longitude,
			};
		}

		// 2. Refined GPS fix with 5s timeout
		const current = await Location.getCurrentPositionAsync({
			accuracy: Location.Accuracy.Balanced,
		});
		if (current?.coords) {
			cachedCoords = {
				latitude: current.coords.latitude,
				longitude: current.coords.longitude,
			};
		}
	} catch (err) {
		logger.warn("Location", "Failed to retrieve device location", err);
	}

	return cachedCoords || { latitude: 0, longitude: 0 };
}

export function getCachedCoordinates(): GeoCoordinates | null {
	return cachedCoords;
}
