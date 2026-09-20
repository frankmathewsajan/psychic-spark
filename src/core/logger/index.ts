type LogLevel = "INFO" | "WARN" | "ERROR";

interface LogPayload {
	level: LogLevel;
	context: string;
	message: string;
	data?: unknown;
	timestamp: string;
}

function formatLog(entry: LogPayload): void {
	const line = `[${entry.timestamp}] [${entry.level}] [${entry.context}]: ${entry.message}`;
	if (entry.level === "ERROR") {
		console.error(line, entry.data ?? "");
	} else if (entry.level === "WARN") {
		console.warn(line, entry.data ?? "");
	} else {
		console.log(line, entry.data ?? "");
	}
}

export const logger = {
	info(context: string, message: string, data?: unknown): void {
		formatLog({
			level: "INFO",
			context,
			message,
			data,
			timestamp: new Date().toISOString(),
		});
	},
	warn(context: string, message: string, data?: unknown): void {
		formatLog({
			level: "WARN",
			context,
			message,
			data,
			timestamp: new Date().toISOString(),
		});
	},
	error(context: string, message: string, error?: unknown): void {
		formatLog({
			level: "ERROR",
			context,
			message,
			data: error,
			timestamp: new Date().toISOString(),
		});
	},
};
