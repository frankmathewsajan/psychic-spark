import { View, type ViewProps } from "react-native";

import { Colors, type ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ThemedViewProps = ViewProps & {
	lightColor?: string;
	darkColor?: string;
	type?: ThemeColor;
};

export function ThemedView({
	style,
	lightColor,
	darkColor,
	type,
	...otherProps
}: ThemedViewProps) {
	const theme = useTheme();
	const customColor = theme === Colors.dark ? darkColor : lightColor;
	const backgroundColor = customColor ?? theme[type ?? "background"];

	return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
