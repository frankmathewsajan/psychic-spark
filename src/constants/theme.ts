import { Platform } from "react-native";

export const Colors = {
	light: {
		text: "#0F172A",
		textSecondary: "#64748B",
		background: "#FFFFFF",
		backgroundElement: "#F8FAFC",
		backgroundSelected: "#E2E8F0",
		border: "#E2E8F0",
		borderStrong: "#94A3B8",
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

export const MeterTokens = {
	brand: "#004B87",
	brandPressed: "#003865",
	ok: "#15803D",
	warn: "#B45309",
	crit: "#B91C1C",
} as const;

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
	xxl: 48,
} as const;
