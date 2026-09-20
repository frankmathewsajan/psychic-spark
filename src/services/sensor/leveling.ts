const RAD_TO_DEG = 180 / Math.PI;
const WALL_TOLERANCE_DEG = 10;

export interface TiltEvaluation {
	tiltFromVertical: number;
	isAligned: boolean;
}

export function calculateWallTilt(
	x: number,
	y: number,
	z: number,
): TiltEvaluation {
	const horizontalMagnitude = Math.hypot(x, y);
	const tiltRad = Math.atan2(z, horizontalMagnitude);
	const tiltFromVertical = Math.round(tiltRad * RAD_TO_DEG);

	return {
		tiltFromVertical,
		isAligned: Math.abs(tiltFromVertical) <= WALL_TOLERANCE_DEG,
	};
}
