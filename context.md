Ran list top-level directories
Ran list files in src
Ran list files in backend

I have begun inspecting the workspace to compile the complete technical context summary. Let me finish gathering the file trees, configs, camera/sensor screen, SQLite/sync layers, and backend routes.

Ran read backend main.py
Ran read backend inspections.py
Ran read backend SQLAlchemy models
Ran read backend schemas
Ran read backend config
Ran read tier1-sync.ts
Ran read meter-inference.ts

Here is the complete, concise technical context summary of the entire workspace so you can wire your **Stage 1 TFLite safety model (`assets/models/mobilenetv3_wire_int8.tflite`)** and **Stage 2 ML Kit OCR (`@react-native-ml-kit/text-recognition`)** cleanly without breaking existing components.

---

## 1. Folder Tree

### Frontend (`src/`, `app/`)
```
src/
├── app/
│   ├── _layout.tsx                     # Root Stack layout, SQLite init, ONNX WebView engine, useBackgroundMlWorker
│   ├── index.tsx                       # Dashboard: HUD metrics, queue status, review list, Tier-1 & Tier-2 trigger
│   ├── capture.tsx                     # Multi-snap camera screen, Accelerometer leveling, barcode scanning, document save
│   └── validation.tsx                  # Manual review / override screen for OCR readings & hazards
├── components/
│   ├── app-symbol.tsx                  # Icons & symbols
│   ├── glass-surface.tsx               # UI card container
│   ├── themed-text.tsx / themed-view.tsx
│   └── inference/
│       └── onnx-engine-webview.tsx     # Existing WebView runner (to be superseded by TFLite + ML Kit)
├── constants/
│   └── theme.ts                        # Colors, typography, spacing tokens
├── core/
│   ├── db/
│   │   ├── client.ts                   # SQLite singleton getter (getDb -> SQLiteDatabase)
│   │   ├── repository.ts               # insertInspection, prepareTier1Batch, claimNextPendingMlRow, etc.
│   │   └── schema.ts                   # DDL_SCHEMA (WAL mode, live migrations, crash recovery)
│   ├── logger/
│   │   └── index.ts                    # Logger utility
│   └── types/
│       └── inspection.ts               # InspectionRecord, QAStatus, SyncStatus, InferenceStatus, Tier1BatchPayload
├── hooks/
│   └── use-theme.tsx
└── services/
    ├── inference/
    │   ├── background-ml-worker.ts     # Passive background loop polling PENDING_ML rows from SQLite
    │   ├── meter-inference.ts          # Orchestrator: calls inference engine, computes QA & serial numbers
    │   ├── onnx-bridge.ts              # Existing bridge to WebView
    │   └── yolo-postprocessor.ts       # Digits assembly & tilt/luma QA checks
    ├── sensor/
    │   └── leveling.ts                 # Accelerometer wall tilt calculation (20° tolerance)
    └── sync/
        ├── tier1-sync.ts               # Tier-1 JSON metadata batch sync with exponential backoff
        └── tier2-sync.ts               # Tier-2 binary photo multipart upload
```

### Backend (`backend/`)
```
backend/
├── app/
│   ├── main.py                         # FastAPI app entry point, CORS, static storage mount
│   ├── api/
│   │   ├── router.py                   # Aggregates v1 sub-routers
│   │   └── v1/
│   │       ├── health.py               # /health endpoint
│   │       └── inspections.py          # /inspections/batch (Tier 1) & /inspections/{id}/image (Tier 2)
│   ├── core/
│   │   ├── config.py                   # Settings (Host, Port, DB URL, Supabase/Local storage)
│   │   └── database.py                 # SQLAlchemy SQLite engine & session
│   ├── models/
│   │   └── inspection.py               # Inspection & InspectionPhoto SQLAlchemy models
│   └── schemas/
│       └── inspection.py               # Pydantic models for batch ingestion and photo responses
├── Dockerfile
└── pyproject.toml / requirements.txt
```

---

## 2. Package & Config

### `package.json`
```json
{
  "name": "novo",
  "main": "expo-router/entry",
  "version": "1.0.0",
  "dependencies": {
    "@expo/ui": "~58.0.28",
    "@react-native-ml-kit/text-recognition": "2.0.0",
    "expo": "~58.0.25",
    "expo-asset": "~58.0.21",
    "expo-camera": "~58.0.14",
    "expo-constants": "~58.0.16",
    "expo-device": "~58.0.5",
    "expo-file-system": "~58.0.13",
    "expo-font": "~58.0.12",
    "expo-glass-effect": "~58.0.5",
    "expo-image": "~58.0.18",
    "expo-image-manipulator": "~58.0.16",
    "expo-linking": "~58.0.17",
    "expo-router": "~58.0.31",
    "expo-sensors": "^58.0.5",
    "expo-splash-screen": "~58.0.14",
    "expo-sqlite": "^58.0.17",
    "expo-status-bar": "~58.0.5",
    "expo-symbols": "~58.0.5",
    "expo-system-ui": "~58.0.7",
    "expo-web-browser": "~58.0.8",
    "onnxruntime-web": "^1.31.1",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "react-native": "0.88.1",
    "react-native-fast-tflite": "3.0.1",
    "react-native-gesture-handler": "~3.3.0",
    "react-native-reanimated": "4.7.1",
    "react-native-safe-area-context": "~5.11.1",
    "react-native-screens": "~4.30.1",
    "react-native-web": "~0.21.4",
    "react-native-webview": "14.0.1",
    "react-native-worklets": "0.13.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.5.14",
    "@types/react": "~19.3.0",
    "repomix": "^1.18.0",
    "typescript": "~6.0.3"
  },
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "check": "biome check --write src/",
    "format": "biome format --write src/",
    "lint": "biome lint src/"
  },
  "private": true
}
```

### `app.json`
```json
{
  "expo": {
    "name": "novo",
    "slug": "novo",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "novo",
    "userInterfaceStyle": "automatic",
    "ios": {
      "icon": "./assets/expo.icon"
    },
    "android": {
      "package": "com.frankmathewsajan.novo",
      "adaptiveIcon": {
        "backgroundColor": "#E6F4FE",
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundImage": "./assets/images/android-icon-background.png",
        "monochromeImage": "./assets/images/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#208AEF",
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 76
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": "Allow novo to access your camera"
        }
      ],
      "expo-font",
      "expo-image",
      "expo-sqlite",
      "expo-status-bar",
      "expo-web-browser",
      "expo-asset",
      "react-native-fast-tflite"
    ],
    "experiments": {
      "typedRoutes": true,
      "reactCompiler": true
    },
    "extra": {
      "router": {},
      "eas": {
        "projectId": "489bfd01-1694-40dc-9377-e59afe34db54"
      }
    },
    "owner": "frankmathewsajan"
  }
}
```

### `metro.config.js`
```javascript
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Register binary asset extensions for ONNX models, TFLite models, and WebAssembly binaries
// Note: Do NOT add "mjs" here so Metro continues resolving JS/MJS modules normally.
config.resolver.assetExts.push("onnx", "wasm", "bin", "tflite");

module.exports = config;
```

---

## 3. Existing Camera / Inspection Screen (`src/app/capture.tsx`)

```typescript
import {
	type BarcodeScanningResult,
	CameraView,
	useCameraPermissions,
} from "expo-camera";
import { Directory, File, Paths } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useRouter } from "expo-router";
import { Accelerometer } from "expo-sensors";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSymbol } from "@/components/app-symbol";
import { GlassSurface } from "@/components/glass-surface";
import { Fonts, MeterTokens, Spacing } from "@/constants/theme";
import { getDb } from "@/core/db/client";
import { insertInspection } from "@/core/db/repository";
import { logger } from "@/core/logger";
import { subscribeUnreadableCapture } from "@/services/inference/background-ml-worker";
import { calculateWallTilt } from "@/services/sensor/leveling";

export default function CaptureScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const cameraRef = useRef<CameraView>(null);
	const [permission, requestPermission] = useCameraPermissions();

	const [torchActive, setTorchActive] = useState(false);
	const [tilt, setTilt] = useState(0);
	const [isAligned, setIsAligned] = useState(false);
	const [isCapturing, setIsCapturing] = useState(false);
	const [isCameraReady, setIsCameraReady] = useState(false);
	const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
	const detectedBarcodeRef = useRef<string | null>(null);

	// Multi-capture rapid queue state
	const [queuedCount, setQueuedCount] = useState(0);
	const [lastQueuedToast, setLastQueuedToast] = useState<string | null>(null);
	const [hazardToast, setHazardToast] = useState<string | null>(null);
	const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hazardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		Accelerometer.setUpdateInterval(100);
		const subscription = Accelerometer.addListener(({ x, y, z }) => {
			const evaluation = calculateWallTilt(x, y, z);
			setTilt(evaluation.tiltFromVertical);
			setIsAligned(evaluation.isAligned);
		});
		return () => subscription.remove();
	}, []);

	// Subscribe to background unreadable capture events (CRITICAL_HAZARD)
	useEffect(() => {
		const unsubscribe = subscribeUnreadableCapture((_id, reason) => {
			if (hazardTimeoutRef.current) {
				clearTimeout(hazardTimeoutRef.current);
			}
			setHazardToast(`UNREADABLE CAPTURE: ${reason}. Re-snap suggested.`);
			hazardTimeoutRef.current = setTimeout(() => {
				setHazardToast(null);
			}, 6000);
		});

		return () => {
			unsubscribe();
			if (hazardTimeoutRef.current) clearTimeout(hazardTimeoutRef.current);
			if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
		};
	}, []);

	// Permission Gate
	if (!permission) {
		return (
			<View style={styles.permissionContainer}>
				<StatusBar style="dark" />
				<ActivityIndicator size="small" color={MeterTokens.brand} />
			</View>
		);
	}

	if (!permission.granted) {
		return (
			<View style={styles.permissionContainer}>
				<StatusBar style="dark" />
				<Text style={styles.permissionTitle}>CAMERA ACCESS REQUIRED</Text>
				<Text style={styles.permissionSub}>
					Camera permission is mandatory to capture audit photos and run
					on-device meter inspection.
				</Text>
				<Pressable style={styles.permissionBtn} onPress={requestPermission}>
					<AppSymbol name="camera" size={16} color="#FFFFFF" />
					<Text style={styles.permissionBtnText}>GRANT CAMERA PERMISSION</Text>
				</Pressable>
			</View>
		);
	}

	const handleCapture = async () => {
		if (!cameraRef.current || isCapturing || !isCameraReady) return;

		try {
			setIsCapturing(true);
			const photo = await cameraRef.current.takePictureAsync({
				quality: 1,
			});

			if (photo?.uri) {
				// Turn off torch immediately after snap to preserve battery
				setTorchActive(false);

				const id = `insp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
				const snapTilt = tilt;
				const snapBarcode = detectedBarcodeRef.current;

				// 1. Lossless compression before storage (PNG format)
				let sourceUri = photo.uri;
				try {
					const compressed = await manipulateAsync(photo.uri, [], {
						format: SaveFormat.PNG,
					});
					if (compressed?.uri) {
						sourceUri = compressed.uri;
					}
				} catch (compErr) {
					logger.warn(
						"Capture",
						"Lossless compression fallback to raw capture",
						compErr,
					);
				}

				// 2. Persist from temp cache to persistent document storage
				let persistentPath = sourceUri;
				try {
					const capturesDir = new Directory(Paths.document, "captures");
					if (!capturesDir.exists) {
						capturesDir.create();
					}
					const destFile = new File(capturesDir, `${id}.png`);
					const sourceFile = new File(sourceUri);
					await sourceFile.copy(destFile);
					persistentPath = destFile.uri;
				} catch (persistErr) {
					logger.warn(
						"Capture",
						"Failed copying to document directory, using direct URI",
						persistErr,
					);
				}

				// 3. Commit immediately to SQLite — zero blocking inference wait
				const db = await getDb();
				await insertInspection(db, {
					id,
					technician_id: "field_tech",
					device_id: "device_01",
					meter_serial_number: snapBarcode || "",
					latitude: 0,
					longitude: 0,
					timestamp_utc: new Date().toISOString(),
					qa_status: "WARNING",
					hazard_reason: null,
					extracted_kwh: null,
					ocr_confidence: null,
					image_local_path: persistentPath,
					inference_status: "PENDING_ML",
					sync_tier1_status: "HOLD_ML",
					tilt_deg: snapTilt,
				});

				logger.info(
					"Capture",
					`Snap queued: ${id} (tilt=${snapTilt}°, barcode=${snapBarcode || "none"})`,
				);

				// 4. In-place viewfinder reset for rapid multi-meter batching
				setDetectedBarcode(null);
				detectedBarcodeRef.current = null;
				setQueuedCount((prev) => {
					const nextCount = prev + 1;
					setLastQueuedToast(`Snap Queued ✓ (${nextCount} in batch)`);
					if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
					toastTimeoutRef.current = setTimeout(() => {
						setLastQueuedToast(null);
					}, 2500);
					return nextCount;
				});
			}
		} catch (error) {
			logger.warn("Capture", "Capture failed", error);
		} finally {
			setIsCapturing(false);
		}
	};

	const handleManualEntry = async () => {
		if (isCapturing) return;

		let photoUri = "";
		if (cameraRef.current && isCameraReady) {
			try {
				const photo = await cameraRef.current.takePictureAsync({
					quality: 0.8,
				});
				if (photo?.uri) {
					photoUri = photo.uri;
				}
			} catch (photoErr) {
				logger.warn("Capture", "Snapshot for manual entry fallback", photoErr);
			}
		}

		router.push({
			pathname: "/validation",
			params: {
				sn: detectedBarcodeRef.current || "",
				kwh: "",
				confidence: "0.000",
				status: "WARNING",
				hazard: "Manual Entry (Bypassed optical edge inference)",
				imagePath: photoUri,
				decimalInferred: "0",
				source: "manual",
			},
		});
	};

	return (
		<View style={styles.container}>
			<StatusBar style="light" />
			{/* LIVE HARDWARE CAMERA STREAM */}
			<CameraView
				ref={cameraRef}
				style={StyleSheet.absoluteFill}
				facing="back"
				enableTorch={torchActive}
				onCameraReady={() => setIsCameraReady(true)}
				barcodeScannerSettings={{
					barcodeTypes: [
						"qr",
						"code128",
						"code39",
						"ean13",
						"ean8",
						"upc_a",
						"upc_e",
					],
				}}
				onBarcodeScanned={(result: BarcodeScanningResult) => {
					if (result.data && result.data !== detectedBarcodeRef.current) {
						detectedBarcodeRef.current = result.data;
						setDetectedBarcode(result.data);
					}
				}}
			/>

			{/* 1. TOP HUD */}
			<View style={[styles.topHud, { paddingTop: insets.top + Spacing.sm }]}>
				{/* Back to dashboard button / finish route */}
				<Pressable
					hitSlop={10}
					onPress={() => router.back()}
					style={styles.backPressable}
				>
					<GlassSurface variant="dark" style={styles.iconCircle}>
						<AppSymbol name="back" size={18} color="#FFFFFF" />
					</GlassSurface>
				</Pressable>

				{/* Level / Tilt HUD Badge */}
				<GlassSurface
					variant="dark"
					style={[styles.badge, isAligned ? styles.badgeOk : styles.badgeWarn]}
				>
					<AppSymbol name="meter" size={13} color="#FFFFFF" />
					<Text style={styles.badgeText}>
						TILT: {tilt > 0 ? `+${tilt}°` : `${tilt}°`}{" "}
						{isAligned ? "(PERPENDICULAR)" : "(WATCH FOR GLARE)"}
					</Text>
				</GlassSurface>

				{/* Torch toggle button */}
				<Pressable
					hitSlop={8}
					onPress={() => setTorchActive(!torchActive)}
					style={styles.torchPressable}
				>
					<GlassSurface
						variant="dark"
						style={[styles.torchBtn, torchActive && styles.torchBtnActive]}
					>
						<AppSymbol
							name={torchActive ? "flash-on" : "flash-off"}
							size={15}
							color={torchActive ? "#000000" : "#FFFFFF"}
						/>
						<Text
							style={[styles.torchText, torchActive && styles.torchTextActive]}
						>
							{torchActive ? "TORCH ON" : "TORCH"}
						</Text>
					</GlassSurface>
				</Pressable>
			</View>

			{/* REAL-TIME TOAST BANNERS */}
			{lastQueuedToast ? (
				<GlassSurface variant="dark" style={styles.successToast}>
					<AppSymbol name="check" size={14} color="#10B981" />
					<Text style={styles.successToastText}>{lastQueuedToast}</Text>
				</GlassSurface>
			) : null}

			{hazardToast ? (
				<GlassSurface variant="dark" style={styles.hazardToast}>
					<AppSymbol name="warning" size={14} color="#F59E0B" />
					<Text style={styles.hazardToastText}>{hazardToast}</Text>
				</GlassSurface>
			) : null}

			{/* BARCODE DETECTION INDICATOR */}
			{detectedBarcode ? (
				<GlassSurface variant="dark" style={styles.barcodeBanner}>
					<AppSymbol name="barcode" size={15} color="#FFFFFF" />
					<Text style={styles.barcodeBannerText}>
						BARCODE: {detectedBarcode}
					</Text>
				</GlassSurface>
			) : null}

			{/* 2. BOUNDING GUIDES OVERLAY */}
			<View style={styles.reticleContainer}>
				<View style={styles.casingBox}>
					<Text style={styles.guideText}>METER CASING BOUNDARY</Text>
					<View style={styles.displayBox}>
						<Text style={styles.guideTextInner}>7-SEGMENT DISPLAY</Text>
					</View>
					<View style={styles.terminalBox}>
						<Text style={styles.guideTextInner}>TERMINAL COVER & SEALS</Text>
					</View>
				</View>
			</View>

			{/* 3. HARDWARE CAPTURE ACTION */}
			<GlassSurface
				variant="dark"
				style={[
					styles.bottomBar,
					{
						paddingBottom: Math.max(insets.bottom, Spacing.md),
					},
				]}
			>
				<Pressable
					disabled={isCapturing || !isCameraReady}
					style={[
						styles.captureBtn,
						(isCapturing || !isCameraReady) && styles.captureBtnDisabled,
					]}
					onPress={handleCapture}
				>
					{isCapturing ? (
						<ActivityIndicator size="small" color="#FFFFFF" />
					) : (
						<View style={styles.captureBtnInner}>
							<AppSymbol name="camera" size={18} color="#FFFFFF" />
							<Text style={styles.captureText}>
								{!isCameraReady
									? "STARTING CAMERA SENSOR..."
									: isAligned
										? "SNAP & QUEUE FOR ML"
										: "SNAP & QUEUE (SUBOPTIMAL TILT)"}
							</Text>
						</View>
					)}
				</Pressable>

				<View style={styles.actionRowBottom}>
					<Pressable
						disabled={isCapturing}
						style={styles.manualEntryBtn}
						onPress={handleManualEntry}
					>
						<AppSymbol name="edit" size={14} color="#94A3B8" />
						<Text style={styles.manualEntryText}>
							ENTER MANUALLY
						</Text>
					</Pressable>

					{queuedCount > 0 ? (
						<Pressable
							style={styles.finishRouteBtn}
							onPress={() => router.back()}
						>
							<AppSymbol name="check" size={14} color="#10B981" />
							<Text style={styles.finishRouteText}>
								FINISH ROUTE ({queuedCount})
							</Text>
						</Pressable>
					) : null}
				</View>
			</GlassSurface>
		</View>
	);
}
```

---

## 4. Existing SQLite & Sync Layer

### SQLite Schema (`src/core/db/schema.ts`)
```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY NOT NULL,
    technician_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    meter_serial_number TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    timestamp_utc TEXT NOT NULL,
    qa_status TEXT CHECK(qa_status IN ('PASS', 'WARNING', 'CRITICAL_HAZARD')) NOT NULL,
    hazard_reason TEXT,
    extracted_kwh REAL,
    ocr_confidence REAL,
    image_local_path TEXT NOT NULL,
    sync_tier1_status TEXT DEFAULT 'PENDING',
    sync_tier2_status TEXT DEFAULT 'PENDING',
    inference_status TEXT CHECK(inference_status IN ('PENDING_ML','PROCESSING','NEEDS_REVIEW','DONE')) DEFAULT 'DONE',
    tilt_deg REAL DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inspections_tier1 ON inspections(sync_tier1_status);
CREATE INDEX IF NOT EXISTS idx_inspections_tier2 ON inspections(sync_tier2_status);
CREATE INDEX IF NOT EXISTS idx_inspections_ml ON inspections(inference_status);
```

### Types (`src/core/types/inspection.ts`)
```typescript
export type QAStatus = "PASS" | "WARNING" | "CRITICAL_HAZARD";
export type SyncStatus = "HOLD_ML" | "PENDING" | "SYNCING" | "SYNCED";
export type InferenceStatus =
	| "PENDING_ML"
	| "PROCESSING"
	| "NEEDS_REVIEW"
	| "DONE";

export interface InspectionRecord {
	id: string;
	technician_id: string;
	device_id: string;
	meter_serial_number: string;
	latitude: number;
	longitude: number;
	timestamp_utc: string;
	qa_status: QAStatus;
	hazard_reason: string | null;
	extracted_kwh: number | null;
	ocr_confidence: number | null;
	image_local_path: string;
	sync_tier1_status: SyncStatus;
	sync_tier2_status: SyncStatus;
	inference_status: InferenceStatus;
	tilt_deg?: number;
	created_at?: string;
}

export interface Tier1BatchPayload {
	batch_id: string;
	inspections: Array<{
		id: string;
		technician_id: string;
		meter_serial_number: string;
		timestamp_utc: string;
		geo: [number, number];
		qa_status: QAStatus;
		hazard_reason: string | null;
		kwh_reading: number | null;
		ocr_confidence: number | null;
	}>;
}
```

### Sync Services & Gateway URLs
- **Tier 1 (JSON Telemetry)**: `src/services/sync/tier1-sync.ts`
  - **Endpoint**: `POST ${gatewayUrl}/api/v1/inspections/batch`
  - **Payload**: `Tier1BatchPayload` (`{ batch_id: string, inspections: [...] }`)
  - **Query Gate**: `SELECT * FROM inspections WHERE sync_tier1_status = 'PENDING' AND inference_status = 'DONE' LIMIT 15;`
- **Tier 2 (Binary Audit Image Upload)**: `src/services/sync/tier2-sync.ts`
  - **Endpoint**: `POST ${gatewayUrl}/api/v1/inspections/${item.id}/image`
  - **Payload**: `FormData` with `photo_type="CASING"` and `file: File`
  - **Query Gate**: `SELECT id, image_local_path FROM inspections WHERE sync_tier2_status = 'PENDING' AND image_local_path IS NOT NULL LIMIT 5;`
- **Gateway Base URL**: Defined in `src/app/index.tsx` as `http://10.243.48.157:8000` (or `http://10.0.2.2:8000` on Android emulator).

---

## 5. Existing Backend (FastAPI)

### Database Models (`backend/app/models/inspection.py`)
```python
class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    batch_id: Mapped[str] = mapped_column(String, nullable=False)
    technician_id: Mapped[str] = mapped_column(String, nullable=False)
    meter_serial_number: Mapped[str] = mapped_column(String, nullable=False, index=True)
    timestamp_utc: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    qa_status: Mapped[str] = mapped_column(String, nullable=False, index=True)  # PASS, WARNING, CRITICAL_HAZARD
    hazard_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    kwh_reading: Mapped[float | None] = mapped_column(Float, nullable=True)
    ocr_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    ingested_at: Mapped[datetime] = mapped_column(DateTime, default=get_utc_now, nullable=False)

    photos: Mapped[list["InspectionPhoto"]] = relationship(
        "InspectionPhoto", back_populates="inspection", cascade="all, delete-orphan"
    )

class InspectionPhoto(Base):
    __tablename__ = "inspection_photos"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    inspection_id: Mapped[str] = mapped_column(String, ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False, index=True)
    photo_type: Mapped[str] = mapped_column(String, nullable=False)  # CASING, TERMINAL_COVER, DISPLAY, TAMPER_SEAL
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=get_utc_now, nullable=False)

    inspection: Mapped[Inspection] = relationship("Inspection", back_populates="photos")
    __table_args__ = (UniqueConstraint("inspection_id", "photo_type", name="uq_inspection_photo_type"),)
```

### Router Endpoints (`backend/app/api/v1/inspections.py`)
- `POST /api/v1/inspections/batch`: Accepts `Tier1BatchPayload` JSON, upserts records idempotently, commits to SQLite (`inspections.db`), returns `BatchIngestResponse`.
- `POST /api/v1/inspections/{inspection_id}/image`: Accepts `multipart/form-data` with `photo_type` (`Form`) and `file` (`UploadFile`), persists to disk (`/storage/audit_images/...`) or Supabase Storage bucket (`audit-images`), writes `InspectionPhoto` record, returns `ImageUploadResponse`.

---

## Key Integration Points for Stage 1 TFLite & Stage 2 ML Kit

1. **Current ML Entry Point (`src/services/inference/meter-inference.ts`)**:
   - Accepts `MeterInferenceInput`: `{ imageUri: string, scannedBarcode?: string | null, tilt?: number }`.
   - Returns `MeterInferenceResult`: `{ meterSerialNumber, extractedKwh, ocrConfidence, qaStatus, hazardReason, latencyMs, source, decimalInferred }`.
   - Wiring TFLite wire-safety check (Stage 1) and ML Kit text recognition (Stage 2) here preserves the entire existing pipeline contract without touching `capture.tsx`, `repository.ts`, or the sync layers.
2. **Model Asset**:
   - `mobilenetv3_wire_int8.tflite` is located at `assets/models/mobilenetv3_wire_int8.tflite`.
   - Metro is configured with `"tflite"` in `assetExts`.
