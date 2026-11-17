import Constants from "expo-constants";
import * as Device from "expo-device";

/**
 * Pure TypeScript SHA-256 implementation.
 * Zero native dependencies; 100% deterministic cryptographic standard.
 */
function sha256(ascii: string): string {
	const words: number[] = [];
	for (let idx = 0; idx < ascii.length; idx++) {
		words[idx >> 2] |= (ascii.charCodeAt(idx) & 255) << (8 * (3 - (idx % 4)));
	}
	const asciiBitLength = ascii.length * 8;
	words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
	words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

	let hash: number[] = [
		0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
		0x1f83d9ab, 0x5be0cd19,
	];

	const k: number[] = [
		0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
		0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
		0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
		0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
		0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
		0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
		0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
		0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
		0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
		0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
		0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
	];

	const rightRotate = (value: number, amount: number) =>
		(value >>> amount) | (value << (32 - amount));

	for (let i = 0; i < words.length; i += 16) {
		const w: number[] = [];
		for (let j = 0; j < 16; j++) w[j] = words[i + j] | 0;
		const oldHash = hash.slice(0);

		for (let j = 0; j < 64; j++) {
			let s0: number;
			let s1: number;
			if (j >= 16) {
				const gamma0x = w[j - 15];
				s0 =
					rightRotate(gamma0x, 7) ^ rightRotate(gamma0x, 18) ^ (gamma0x >>> 3);
				const gamma1x = w[j - 2];
				s1 =
					rightRotate(gamma1x, 17) ^
					rightRotate(gamma1x, 19) ^
					(gamma1x >>> 10);
				w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
			}

			const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
			const maj =
				(hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
			s0 =
				rightRotate(hash[0], 2) ^
				rightRotate(hash[0], 13) ^
				rightRotate(hash[0], 22);
			s1 =
				rightRotate(hash[4], 6) ^
				rightRotate(hash[4], 11) ^
				rightRotate(hash[4], 25);

			const temp1 = (hash[7] + s1 + ch + k[j] + (w[j] | 0)) | 0;
			const temp2 = (s0 + maj) | 0;

			hash = [
				(temp1 + temp2) | 0,
				hash[0],
				hash[1],
				hash[2],
				(hash[3] + temp1) | 0,
				hash[4],
				hash[5],
				hash[6],
			];
		}

		for (let j = 0; j < 8; j++) {
			hash[j] = (hash[j] + oldHash[j]) | 0;
		}
	}

	let result = "";
	for (let i = 0; i < 8; i++) {
		for (let j = 3; j >= 0; j--) {
			const b = (hash[i] >> (8 * j)) & 255;
			result += (b < 16 ? "0" : "") + b.toString(16);
		}
	}
	return result;
}

export interface HardwareFingerprint {
	deviceId: string;
	fingerprintHash: string;
	brand: string;
	model: string;
	osBuildId: string;
	totalMemory: number;
	installationId: string;
}

/**
 * Gathers immutable hardware & installation traits.
 */
export function getHardwareFingerprint(): HardwareFingerprint {
	const brand = (
		Device.brand ??
		Device.manufacturer ??
		"android"
	).toLowerCase();
	const model = Device.modelName ?? Device.deviceName ?? "generic";
	const osBuildId = Device.osBuildId ?? Device.osVersion ?? "build0";
	const totalMemory = Device.totalMemory ?? 4096000000;
	const installationId = Constants.installationId ?? "inst-default";

	// Combine into canonical string
	const canonical = `${brand}|${model}|${osBuildId}|${totalMemory}|${installationId}`;
	const hash = sha256(canonical);
	const deviceId = `dev_${hash.substring(0, 8)}`;

	return {
		deviceId,
		fingerprintHash: hash,
		brand,
		model,
		osBuildId,
		totalMemory,
		installationId,
	};
}

/**
 * Returns deterministic device ID.
 * Running 1,000 times on the same device always yields the exact same ID.
 */
export function generateDeterministicDeviceId(): string {
	return getHardwareFingerprint().deviceId;
}
