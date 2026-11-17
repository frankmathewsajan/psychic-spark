import type { RawBox } from "./yolo-postprocessor";

export interface RawInferenceOutput {
	boxes: RawBox[];
	panelConfidence: number;
	meanLuma: number;
	stage1Ms: number;
	stage2Ms: number;
}

type Resolver = (output: RawInferenceOutput) => void;
type Rejecter = (reason: Error) => void;

interface PendingRequest {
	resolve: Resolver;
	reject: Rejecter;
	timeoutId: ReturnType<typeof setTimeout>;
}

class OnnxBridgeService {
	private pendingRequests = new Map<string, PendingRequest>();
	private sendToWebView: ((msg: unknown) => void) | null = null;
	private _isEngineReady = false;
	private readyCallbacks: (() => void)[] = [];

	public get isEngineReady(): boolean {
		return this._isEngineReady;
	}

	public registerWebViewSender(sender: (msg: unknown) => void) {
		this.sendToWebView = sender;
	}

	public setEngineReady() {
		this._isEngineReady = true;
		for (const cb of this.readyCallbacks) {
			try {
				cb();
			} catch {}
		}
		this.readyCallbacks = [];
	}

	public setEngineUnready() {
		this._isEngineReady = false;
	}

	public async waitUntilReady(timeoutMs = 30000): Promise<void> {
		if (this._isEngineReady) return;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				reject(new Error("ONNX WebView Engine initialization timed out"));
			}, timeoutMs);

			this.readyCallbacks.push(() => {
				clearTimeout(timer);
				resolve();
			});
		});
	}

	public async runInference(imageBase64: string): Promise<RawInferenceOutput> {
		const sender = this.sendToWebView;
		if (!sender) {
			throw new Error(
				"OnnxBridge: WebView is not mounted or sender is missing",
			);
		}

		await this.waitUntilReady();

		const id = `inf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject(new Error(`Inference request ${id} timed out after 10000ms`));
			}, 10000);

			this.pendingRequests.set(id, { resolve, reject, timeoutId });

			sender({
				type: "RUN_INFERENCE",
				id,
				imageBase64,
			});
		});
	}

	public handleMessageFromWebView(data: {
		type: string;
		id?: string;
		boxes?: RawBox[];
		panelConf?: number;
		meanLuma?: number;
		stage1Ms?: number;
		stage2Ms?: number;
		error?: string;
	}) {
		if (data.type === "ENGINE_READY") {
			this.setEngineReady();
			return;
		}

		if (data.type === "INFERENCE_RESULT" && data.id) {
			const pending = this.pendingRequests.get(data.id);
			if (pending) {
				clearTimeout(pending.timeoutId);
				this.pendingRequests.delete(data.id);

				if (data.error) {
					pending.reject(new Error(data.error));
				} else {
					pending.resolve({
						boxes: data.boxes || [],
						panelConfidence: data.panelConf ?? 0,
						meanLuma: data.meanLuma ?? 128,
						stage1Ms: data.stage1Ms ?? 0,
						stage2Ms: data.stage2Ms ?? 0,
					});
				}
			}
		}
	}
}

export const onnxBridge = new OnnxBridgeService();
