import {
	type GlassColorScheme,
	type GlassStyle,
	GlassView,
	isGlassEffectAPIAvailable,
} from "expo-glass-effect";
import {
	Platform,
	type StyleProp,
	StyleSheet,
	View,
	type ViewProps,
	type ViewStyle,
} from "react-native";
import { useTheme } from "@/hooks/use-theme";

export type GlassVariant = "card" | "hud" | "bar" | "pill" | "dark";

export interface GlassSurfaceProps extends ViewProps {
	variant?: GlassVariant;
	glassEffectStyle?: GlassStyle;
	tintColor?: string;
	colorScheme?: GlassColorScheme;
	interactive?: boolean;
	style?: StyleProp<ViewStyle>;
}

/**
 * Adaptive Glass Surface component.
 *
 * - iOS: Wires up native Liquid Glass / blur effect via `expo-glass-effect`.
 * - Android & Web: Renders a clean, elevated Material container with guaranteed
 *   contrast and proper background fallbacks, ensuring Android UI is never transparent
 *   or broken.
 */
export function GlassSurface({
	variant = "card",
	glassEffectStyle = "regular",
	tintColor,
	colorScheme,
	interactive = false,
	style,
	children,
	...rest
}: GlassSurfaceProps) {
	const theme = useTheme();

	// Check if native glass effect is supported at runtime
	let isGlassSupported = false;
	if (Platform.OS === "ios") {
		try {
			isGlassSupported = isGlassEffectAPIAvailable();
		} catch {
			isGlassSupported = false;
		}
	}

	const variantStyles = getVariantStyles(variant, theme);
	const resolvedColorScheme: GlassColorScheme =
		colorScheme ?? (variant === "dark" ? "dark" : "auto");

	if (isGlassSupported) {
		return (
			<GlassView
				glassEffectStyle={glassEffectStyle}
				tintColor={tintColor ?? variantStyles.iosTintColor}
				colorScheme={resolvedColorScheme}
				isInteractive={interactive}
				style={[styles.base, variantStyles.iosStyle, style]}
				{...rest}
			>
				{children}
			</GlassView>
		);
	}

	// Android / fallback container
	return (
		<View style={[styles.base, variantStyles.androidStyle, style]} {...rest}>
			{children}
		</View>
	);
}

function getVariantStyles(
	variant: GlassVariant,
	theme: ReturnType<typeof useTheme>,
) {
	switch (variant) {
		case "hud":
		case "card":
			return {
				iosTintColor: "rgba(255, 255, 255, 0.8)",
				iosStyle: styles.iosCard,
				androidStyle: [
					styles.androidCard,
					{
						backgroundColor: theme.backgroundElement,
						borderColor: theme.border,
					},
				],
			};
		case "dark":
			return {
				iosTintColor: "rgba(0, 0, 0, 0.45)",
				iosStyle: styles.iosDark,
				androidStyle: styles.androidDark,
			};
		case "bar":
			return {
				iosTintColor: "rgba(255, 255, 255, 0.92)",
				iosStyle: styles.iosBar,
				androidStyle: [
					styles.androidBar,
					{ backgroundColor: theme.background, borderColor: theme.border },
				],
			};
		case "pill":
			return {
				iosTintColor: "rgba(255, 255, 255, 0.75)",
				iosStyle: styles.iosPill,
				androidStyle: [
					styles.androidPill,
					{
						backgroundColor: theme.backgroundElement,
						borderColor: theme.border,
					},
				],
			};
	}
}

const styles = StyleSheet.create({
	base: {
		overflow: "hidden",
	},
	iosCard: {
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "rgba(226, 232, 240, 0.8)",
	},
	androidCard: {
		borderRadius: 8,
		borderWidth: 1,
		elevation: 1,
	},
	iosDark: {
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.2)",
	},
	androidDark: {
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.15)",
		backgroundColor: "rgba(15, 23, 42, 0.85)",
	},
	iosBar: {
		borderTopWidth: 1,
		borderColor: "rgba(226, 232, 240, 0.8)",
	},
	androidBar: {
		borderTopWidth: 1,
		elevation: 4,
	},
	iosPill: {
		borderRadius: 9999,
		borderWidth: 1,
		borderColor: "rgba(226, 232, 240, 0.8)",
	},
	androidPill: {
		borderRadius: 9999,
		borderWidth: 1,
		elevation: 1,
	},
});
