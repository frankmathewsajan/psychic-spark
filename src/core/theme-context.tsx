import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { Colors } from "@/constants/theme";
import { getDb } from "@/core/db/client";
import { getSetting, setSetting } from "@/core/db/repository";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemePalette {
	text: string;
	textSecondary: string;
	background: string;
	backgroundElement: string;
	backgroundSelected: string;
	border: string;
	borderStrong: string;
}

interface ThemeContextType {
	themeMode: ThemeMode;
	isDark: boolean;
	colors: ThemePalette;
	setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
	themeMode: "system",
	isDark: false,
	colors: Colors.light,
	setThemeMode: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const systemScheme = useColorScheme();
	const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

	useEffect(() => {
		(async () => {
			try {
				const db = await getDb();
				const saved = (await getSetting(
					db,
					"app_theme",
					"system",
				)) as ThemeMode;
				setThemeModeState(saved);
			} catch {}
		})();
	}, []);

	const isDark =
		themeMode === "dark" || (themeMode === "system" && systemScheme === "dark");

	const colors = isDark ? Colors.dark : Colors.light;

	const setThemeMode = async (mode: ThemeMode) => {
		setThemeModeState(mode);
		try {
			const db = await getDb();
			await setSetting(db, "app_theme", mode);
		} catch {}
	};

	return (
		<ThemeContext.Provider value={{ themeMode, isDark, colors, setThemeMode }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	return useContext(ThemeContext);
}
