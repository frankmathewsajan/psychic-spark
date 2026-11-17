import {
	type AndroidSymbol,
	type SFSymbol,
	SymbolView,
	type SymbolWeight,
} from "expo-symbols";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Fonts } from "@/constants/theme";

export type AppSymbolName =
	| "search"
	| "camera"
	| "add"
	| "sync"
	| "clock"
	| "check"
	| "check-simple"
	| "warning"
	| "hazard"
	| "bolt"
	| "wifi"
	| "flash-on"
	| "flash-off"
	| "back"
	| "chevron-right"
	| "meter"
	| "shield"
	| "close"
	| "barcode"
	| "edit"
	| "settings"
	| "trash";

export interface SymbolDefinition {
	ios: SFSymbol;
	android: AndroidSymbol;
	fallbackGlyph: string;
}

export const SYMBOL_MAP: Record<AppSymbolName, SymbolDefinition> = {
	search: {
		ios: "magnifyingglass",
		android: "search",
		fallbackGlyph: "🔍",
	},
	camera: {
		ios: "camera.fill",
		android: "photo_camera",
		fallbackGlyph: "📷",
	},
	add: {
		ios: "plus",
		android: "add",
		fallbackGlyph: "+",
	},
	sync: {
		ios: "arrow.triangle.2.circlepath",
		android: "sync",
		fallbackGlyph: "⟳",
	},
	clock: {
		ios: "clock.fill",
		android: "schedule",
		fallbackGlyph: "🕒",
	},
	check: {
		ios: "checkmark.circle.fill",
		android: "check_circle",
		fallbackGlyph: "✓",
	},
	"check-simple": {
		ios: "checkmark",
		android: "check",
		fallbackGlyph: "✓",
	},
	warning: {
		ios: "exclamationmark.triangle.fill",
		android: "warning",
		fallbackGlyph: "⚠",
	},
	hazard: {
		ios: "exclamationmark.octagon.fill",
		android: "error",
		fallbackGlyph: "⛔",
	},
	bolt: {
		ios: "bolt.fill",
		android: "bolt",
		fallbackGlyph: "⚡",
	},
	wifi: {
		ios: "wifi",
		android: "wifi",
		fallbackGlyph: "📶",
	},
	"flash-on": {
		ios: "flashlight.on.fill",
		android: "flash_on",
		fallbackGlyph: "🔦",
	},
	"flash-off": {
		ios: "flashlight.off.fill",
		android: "flash_off",
		fallbackGlyph: "🔦",
	},
	back: {
		ios: "chevron.left",
		android: "arrow_back",
		fallbackGlyph: "←",
	},
	"chevron-right": {
		ios: "chevron.right",
		android: "arrow_forward_ios",
		fallbackGlyph: "›",
	},
	meter: {
		ios: "speedometer",
		android: "speed",
		fallbackGlyph: "⏱",
	},
	shield: {
		ios: "shield.fill",
		android: "shield",
		fallbackGlyph: "🛡",
	},
	close: {
		ios: "xmark",
		android: "close",
		fallbackGlyph: "✕",
	},
	barcode: {
		ios: "barcode.viewfinder",
		android: "qr_code_scanner",
		fallbackGlyph: "▤",
	},
	edit: {
		ios: "pencil",
		android: "edit",
		fallbackGlyph: "✏️",
	},
	settings: {
		ios: "gearshape.fill",
		android: "settings",
		fallbackGlyph: "⚙️",
	},
	trash: {
		ios: "trash.fill",
		android: "delete",
		fallbackGlyph: "🗑️",
	},
};

export interface AppSymbolProps {
	name:
		| AppSymbolName
		| {
				ios: SFSymbol;
				android: AndroidSymbol;
				fallbackGlyph?: string;
		  };
	size?: number;
	color?: string;
	weight?: SymbolWeight;
	style?: ViewStyle;
}

/**
 * Platform-adaptive symbol component.
 *
 * - On iOS: Renders native Apple SF Symbols via `expo-symbols`.
 * - On Android: Renders Material Symbols via `expo-symbols` with fallback glyph safety.
 * - On Web / fallback: Renders the fallback unicode glyph so the layout never breaks.
 */
export function AppSymbol({
	name,
	size = 20,
	color = "#0F172A",
	weight = "regular",
	style,
}: AppSymbolProps) {
	const definition: SymbolDefinition =
		typeof name === "string"
			? (SYMBOL_MAP[name] ?? {
					ios: "questionmark.circle",
					android: "help",
					fallbackGlyph: "?",
				})
			: {
					ios: name.ios,
					android: name.android,
					fallbackGlyph: name.fallbackGlyph ?? "•",
				};

	const fallbackNode = (
		<View
			style={[styles.fallbackContainer, { width: size, height: size }, style]}
		>
			<Text
				style={[
					styles.fallbackText,
					{
						fontSize: Math.round(size * 0.75),
						color,
					},
				]}
			>
				{definition.fallbackGlyph}
			</Text>
		</View>
	);

	return (
		<SymbolView
			name={{
				ios: definition.ios,
				android: definition.android,
			}}
			size={size}
			tintColor={color}
			weight={weight}
			fallback={fallbackNode}
			style={[{ width: size, height: size }, style]}
		/>
	);
}

const styles = StyleSheet.create({
	fallbackContainer: {
		justifyContent: "center",
		alignItems: "center",
	},
	fallbackText: {
		fontFamily: Fonts.mono,
		fontWeight: Platform.select({ ios: "600", default: "700" }),
		textAlign: "center",
	},
});
