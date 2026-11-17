import { Platform } from "react-native";

export const MD3 = {
	color: {
		primary: "#0061A4",
		onPrimary: "#FFFFFF",
		primaryContainer: "#D1E4FF",
		onPrimaryContainer: "#001D36",

		surface: "#FAF9FD",
		surfaceContainerLowest: "#FFFFFF",
		surfaceContainerLow: "#F4F3F7",
		surfaceContainer: "#EEEFF3",
		surfaceContainerHigh: "#E8E8EC",
		surfaceContainerHighest: "#E2E2E6",
		onSurface: "#191C1E",
		onSurfaceVariant: "#43474E",

		outline: "#73777F",
		outlineVariant: "#C3C7D0",

		error: "#BA1A1A",
		errorContainer: "#FFDAD6",
		onErrorContainer: "#410002",

		warn: "#B45309",
		warnContainer: "#FEF3C7",
		onWarnContainer: "#78350F",

		success: "#15803D",
		successContainer: "#DCFCE7",
		onSuccessContainer: "#14532D",
	},
	shape: {
		cornerSmall: 8,
		cornerMedium: 12,
		cornerLarge: 16,
		cornerFull: 9999,
	},
} as const;

export const MeterTokens = {
	brand: MD3.color.primary,
	brandPressed: MD3.color.onPrimaryContainer,
	ok: MD3.color.success,
	warn: MD3.color.warn,
	crit: MD3.color.error,
} as const;

export const Colors = {
	light: {
		text: MD3.color.onSurface,
		textSecondary: MD3.color.onSurfaceVariant,
		background: MD3.color.surface,
		backgroundElement: MD3.color.surfaceContainerLow,
		backgroundSelected: MD3.color.surfaceContainerHighest,
		border: MD3.color.outlineVariant,
		borderStrong: MD3.color.outline,
	},
	dark: {
		text: "#F8FAFC",
		textSecondary: "#94A3B8",
		background: "#0F172A",
		backgroundElement: "#1E293B",
		backgroundSelected: "#334155",
		border: "#334155",
		borderStrong: "#64748B",
	},
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = Platform.select({
	ios: {
		sans: "system-ui",
		mono: "ui-monospace",
	},
	default: {
		sans: "normal",
		mono: "monospace",
	},
});

export const Spacing = {
	xs: 4,
	sm: 8,
	md: 16,
	lg: 24,
	xl: 32,
} as const;
