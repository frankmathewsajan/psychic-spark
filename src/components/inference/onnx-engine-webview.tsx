import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { logger } from "@/core/logger";
import { onnxBridge } from "@/services/inference/onnx-bridge";
import type { RawBox } from "@/services/inference/yolo-postprocessor";

interface WebViewHandle {
	postMessage: (data: string) => void;
}

const TypedWebView = WebView as unknown as React.ComponentType<
	Record<string, unknown>
>;

const loadAssetFile = async (moduleRef: number): Promise<File> => {
	const asset = Asset.fromModule(moduleRef);
	await asset.downloadAsync();
	const uri = asset.localUri ?? asset.uri;
	return new File(uri);
};

function buildHtml(runtimeScript: string): string {
	const sanitizedRuntime = runtimeScript.replace(/<\/script/gi, "<\\/script");

	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
  <canvas id="cOrig" style="display:none;"></canvas>
  <canvas id="c1" width="640" height="640" style="display:none;"></canvas>
  <canvas id="c2" width="320" height="320" style="display:none;"></canvas>
  <script>
    (function() {
      window.__sendToRN = function(payload) {
        var str = JSON.stringify(payload);
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(str);
        } else {
          var attempts = 0;
          var timer = setInterval(function() {
            attempts++;
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              clearInterval(timer);
              window.ReactNativeWebView.postMessage(str);
            } else if (attempts > 100) {
              clearInterval(timer);
            }
          }, 50);
        }
      };

      window.onerror = function(message, source, lineno, colno, error) {
        var errMsg = "Window Error: " + message + " (" + source + ":" + lineno + ":" + colno + ")";
        if (error && error.stack) {
          errMsg += "\\n" + error.stack;
        }
        window.__sendToRN({ type: "ERROR", message: errMsg });
        return false;
      };

      window.onunhandledrejection = function(event) {
        var reason = event && event.reason ? (event.reason.stack || event.reason.message || String(event.reason)) : "Unknown rejection";
        window.__sendToRN({ type: "ERROR", message: "Unhandled Rejection: " + reason });
      };

      var origConsoleError = console.error;
      console.error = function() {
        var args = Array.prototype.slice.call(arguments);
        var formatted = args.map(function(a) {
          return (typeof a === "object") ? JSON.stringify(a) : String(a);
        }).join(" ");
        window.__sendToRN({ type: "ERROR", message: "Console Error: " + formatted });
        origConsoleError.apply(console, arguments);
      };
    })();
  </script>
  <script>
    ${sanitizedRuntime}
  </script>
  <script>
    (function() {
      var sendToRN = window.__sendToRN;

      function base64ToArrayBuffer(base64) {
        var binary = window.atob(base64);
        var len = binary.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
      }

      var activeTransfers = {};
      var stage1Session = null;
      var stage2Session = null;

      async function handleCompletedTransfer(transferId, fullData) {
        try {
          if (transferId === "wasm") {
            var wasmArrayBuffer = base64ToArrayBuffer(fullData);
            window.ort.env.wasm.numThreads = 1;
            window.ort.env.wasm.proxy = false;
            window.ort.env.wasm.wasmBinary = wasmArrayBuffer;
            sendToRN({ type: "TRANSFER_COMPLETE", transferId: "wasm" });
            return;
          }

          if (transferId === "stage1") {
            var s1Buf = base64ToArrayBuffer(fullData);
            stage1Session = await window.ort.InferenceSession.create(s1Buf, {
              executionProviders: ["wasm"],
              graphOptimizationLevel: "all"
            });
            s1Buf = null;
            sendToRN({ type: "TRANSFER_COMPLETE", transferId: "stage1" });
            return;
          }

          if (transferId === "stage2") {
            var s2Buf = base64ToArrayBuffer(fullData);
            stage2Session = await window.ort.InferenceSession.create(s2Buf, {
              executionProviders: ["wasm"],
              graphOptimizationLevel: "all"
            });
            s2Buf = null;
            sendToRN({ type: "TRANSFER_COMPLETE", transferId: "stage2" });
            sendToRN({ type: "ENGINE_READY" });
            return;
          }
        } catch (err) {
          var errMsg = err && err.stack ? err.stack : (err && err.message ? err.message : String(err));
          sendToRN({
            type: "ENGINE_ERROR",
            transferId: transferId,
            error: errMsg
          });
          sendToRN({
            type: "ERROR",
            message: "Initialization error on " + transferId + ": " + errMsg
          });
        }
      }

      function letterboxCanvas(sourceCanvasOrImg, srcW, srcH, targetSize, canvasId) {
        var canvas = document.getElementById(canvasId);
        var ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = targetSize;
        canvas.height = targetSize;

        var scale = Math.min(targetSize / srcW, targetSize / srcH);
        var newW = Math.round(srcW * scale);
        var newH = Math.round(srcH * scale);
        var padX = (targetSize - newW) / 2;
        var padY = (targetSize - newH) / 2;

        ctx.fillStyle = "rgb(114, 114, 114)";
        ctx.fillRect(0, 0, targetSize, targetSize);
        ctx.drawImage(sourceCanvasOrImg, 0, 0, srcW, srcH, Math.floor(padX), Math.floor(padY), newW, newH);

        var imgData = ctx.getImageData(0, 0, targetSize, targetSize).data;
        var area = targetSize * targetSize;
        var float32 = new Float32Array(3 * area);

        for (var y = 0; y < targetSize; y++) {
          for (var x = 0; x < targetSize; x++) {
            var srcIdx = (y * targetSize + x) * 4;
            var dstIdx = y * targetSize + x;
            float32[dstIdx] = imgData[srcIdx] / 255.0;
            float32[area + dstIdx] = imgData[srcIdx + 1] / 255.0;
            float32[2 * area + dstIdx] = imgData[srcIdx + 2] / 255.0;
          }
        }

        return {
          tensor: new window.ort.Tensor("float32", float32, [1, 3, targetSize, targetSize]),
          scale: scale,
          padX: padX,
          padY: padY
        };
      }

      async function executeInference(req) {
        try {
          var img = new Image();
          img.onload = async function() {
            try {
              var origW = img.naturalWidth;
              var origH = img.naturalHeight;

              // 1. Mean Luma calculation
              var cOrig = document.getElementById("cOrig");
              var origCtx = cOrig.getContext("2d", { willReadFrequently: true });
              var sw = Math.min(256, origW);
              var sh = Math.min(256, origH);
              cOrig.width = sw;
              cOrig.height = sh;
              origCtx.drawImage(img, 0, 0, sw, sh);
              var idata = origCtx.getImageData(0, 0, sw, sh).data;
              var lumaSum = 0;
              for (var i = 0; i < idata.length; i += 4) {
                lumaSum += 0.299 * idata[i] + 0.587 * idata[i + 1] + 0.114 * idata[i + 2];
              }
              var meanLuma = lumaSum / (sw * sh);

              // 2. Stage 1: Panel Detection (640x640)
              var t0 = performance.now();
              var p1 = letterboxCanvas(img, origW, origH, 640, "c1");
              var results1 = await stage1Session.run({ images: p1.tensor });
              var out1 = results1[stage1Session.outputNames[0]].data;
              var stage1Ms = Math.round(performance.now() - t0);

              var bestPanelConf = 0.0;
              var bestPanelBox = null;
              var numAnchors1 = 8400;

              for (var a = 0; a < numAnchors1; a++) {
                var conf = out1[4 * numAnchors1 + a];
                if (conf > bestPanelConf) {
                  bestPanelConf = conf;
                  var cx = out1[0 * numAnchors1 + a];
                  var cy = out1[1 * numAnchors1 + a];
                  var w = out1[2 * numAnchors1 + a];
                  var h = out1[3 * numAnchors1 + a];

                  var x1 = Math.max(0, Math.min(origW, (cx - w / 2 - p1.padX) / p1.scale));
                  var y1 = Math.max(0, Math.min(origH, (cy - h / 2 - p1.padY) / p1.scale));
                  var x2 = Math.max(0, Math.min(origW, (cx + w / 2 - p1.padX) / p1.scale));
                  var y2 = Math.max(0, Math.min(origH, (cy + h / 2 - p1.padY) / p1.scale));
                  bestPanelBox = [x1, y1, x2, y2];
                }
              }

              // 3. Crop LCD display (with 5% padding) for Stage 2
              var cropW, cropH;
              if (bestPanelConf >= 0.25 && bestPanelBox) {
                var padX = (bestPanelBox[2] - bestPanelBox[0]) * 0.05;
                var padY = (bestPanelBox[3] - bestPanelBox[1]) * 0.05;
                var cx1 = Math.max(0, Math.floor(bestPanelBox[0] - padX));
                var cy1 = Math.max(0, Math.floor(bestPanelBox[1] - padY));
                var cx2 = Math.min(origW, Math.ceil(bestPanelBox[2] + padX));
                var cy2 = Math.min(origH, Math.ceil(bestPanelBox[3] + padY));
                cropW = Math.max(1, cx2 - cx1);
                cropH = Math.max(1, cy2 - cy1);
                cOrig.width = cropW;
                cOrig.height = cropH;
                origCtx.drawImage(img, cx1, cy1, cropW, cropH, 0, 0, cropW, cropH);
              } else {
                cropW = origW;
                cropH = origH;
                cOrig.width = cropW;
                cOrig.height = cropH;
                origCtx.drawImage(img, 0, 0, origW, origH, 0, 0, cropW, cropH);
              }

              // 4. Stage 2: 7-segment digit detection (320x320)
              var t1 = performance.now();
              var p2 = letterboxCanvas(cOrig, cropW, cropH, 320, "c2");
              var results2 = await stage2Session.run({ images: p2.tensor });
              var out2 = results2[stage2Session.outputNames[0]].data;
              var stage2Ms = Math.round(performance.now() - t1);

              var numAnchors2 = 2100;
              var numClasses2 = 12;
              var classNames = ["-", ".", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
              var candidateBoxes = [];

              for (var a = 0; a < numAnchors2; a++) {
                var maxConf = -1;
                var bestClass = -1;
                for (var c = 0; c < numClasses2; c++) {
                  var score = out2[(4 + c) * numAnchors2 + a];
                  if (score > maxConf) {
                    maxConf = score;
                    bestClass = c;
                  }
                }

                if (maxConf >= 0.30) {
                  var cx = out2[0 * numAnchors2 + a];
                  var cy = out2[1 * numAnchors2 + a];
                  var w = out2[2 * numAnchors2 + a];
                  var h = out2[3 * numAnchors2 + a];

                  var x1 = Math.max(0, Math.min(cropW, (cx - w / 2 - p2.padX) / p2.scale));
                  var y1 = Math.max(0, Math.min(cropH, (cy - h / 2 - p2.padY) / p2.scale));
                  var x2 = Math.max(0, Math.min(cropW, (cx + w / 2 - p2.padX) / p2.scale));
                  var y2 = Math.max(0, Math.min(cropH, (cy + h / 2 - p2.padY) / p2.scale));

                  candidateBoxes.push({
                    label: classNames[bestClass],
                    conf: Number(maxConf.toFixed(3)),
                    box: [x1, y1, x2, y2],
                    x_center: (x1 + x2) / 2.0
                  });
                }
              }

              // NMS (IoU 0.45)
              candidateBoxes.sort(function(a, b) { return b.conf - a.conf; });
              var nmsBoxes = [];
              for (var i = 0; i < candidateBoxes.length; i++) {
                var bA = candidateBoxes[i];
                var discard = false;
                for (var j = 0; j < nmsBoxes.length; j++) {
                  var bB = nmsBoxes[j];
                  var interX1 = Math.max(bA.box[0], bB.box[0]);
                  var interY1 = Math.max(bA.box[1], bB.box[1]);
                  var interX2 = Math.min(bA.box[2], bB.box[2]);
                  var interY2 = Math.min(bA.box[3], bB.box[3]);
                  var interW = Math.max(0, interX2 - interX1);
                  var interH = Math.max(0, interY2 - interY1);
                  var interArea = interW * interH;
                  var areaA = (bA.box[2] - bA.box[0]) * (bA.box[3] - bA.box[1]);
                  var areaB = (bB.box[2] - bB.box[0]) * (bB.box[3] - bB.box[1]);
                  var iou = interArea / (areaA + areaB - interArea + 1e-6);
                  if (iou > 0.45) {
                    discard = true;
                    break;
                  }
                }
                if (!discard) {
                  nmsBoxes.push(bA);
                }
              }

              sendToRN({
                type: "INFERENCE_RESULT",
                id: req.id,
                boxes: nmsBoxes,
                panelConf: Number(bestPanelConf.toFixed(3)),
                meanLuma: Math.round(meanLuma),
                stage1Ms: stage1Ms,
                stage2Ms: stage2Ms
              });
            } catch (innerErr) {
              sendToRN({
                type: "INFERENCE_RESULT",
                id: req.id,
                error: innerErr && innerErr.message ? innerErr.message : String(innerErr)
              });
            }
          };
          img.onerror = function() {
            sendToRN({
              type: "INFERENCE_RESULT",
              id: req.id,
              error: "Failed to decode camera image in WebView"
            });
          };
          img.src = "data:image/jpeg;base64," + req.imageBase64;
        } catch (outerErr) {
          sendToRN({
            type: "INFERENCE_RESULT",
            id: req.id,
            error: outerErr && outerErr.message ? outerErr.message : String(outerErr)
          });
        }
      }

      function onMessage(event) {
        var msg;
        try {
          msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        } catch (e) {
          return;
        }
        if (!msg) return;

        if (msg.type === "TRANSFER_START") {
          activeTransfers[msg.transferId] = {
            total: msg.totalChunks,
            chunks: new Array(msg.totalChunks),
            received: 0
          };
          return;
        }

        if (msg.type === "TRANSFER_CHUNK") {
          var t = activeTransfers[msg.transferId];
          if (t) {
            t.chunks[msg.index] = msg.chunk;
            t.received++;
          }
          return;
        }

        if (msg.type === "TRANSFER_END") {
          var t = activeTransfers[msg.transferId];
          if (t) {
            var fullData = t.chunks.join("");
            delete activeTransfers[msg.transferId];
            handleCompletedTransfer(msg.transferId, fullData);
          }
          return;
        }

        if (msg.type === "RUN_INFERENCE") {
          executeInference(msg);
          return;
        }
      }

      window.addEventListener("message", onMessage);
      document.addEventListener("message", onMessage);

      sendToRN({ type: "WEBVIEW_MOUNTED" });
    })();
  </script>
</body>
</html>`;
}

export function OnnxEngineWebView() {
	const webViewRef = useRef<WebViewHandle | null>(null);
	const [html, setHtml] = useState<string | null>(null);
	const hasInitializedRef = useRef(false);
	const transferResolvers = useRef<
		Map<string, { resolve: () => void; reject: (err: Error) => void }>
	>(new Map());

	useEffect(() => {
		onnxBridge.registerWebViewSender((msg) => {
			webViewRef.current?.postMessage(JSON.stringify(msg));
		});

		(async () => {
			try {
				const runtimeAsset = await loadAssetFile(
					require("../../../assets/wasm/ort.runtime.bin"),
				);
				const runtimeText = await runtimeAsset.text();
				setHtml(buildHtml(runtimeText));
			} catch (err) {
				logger.warn("OnnxEngine", "Failed reading ort.runtime.bin", err);
			}
		})();

		return () => {
			onnxBridge.setEngineUnready();
		};
	}, []);

	const sendChunks = async (
		transferId: string,
		data: string,
	): Promise<void> => {
		const CHUNK_SIZE = 512 * 1024;
		const totalChunks = Math.ceil(data.length / CHUNK_SIZE);

		return new Promise((resolve, reject) => {
			transferResolvers.current.set(transferId, { resolve, reject });

			webViewRef.current?.postMessage(
				JSON.stringify({
					type: "TRANSFER_START",
					transferId,
					totalChunks,
				}),
			);

			for (let i = 0; i < totalChunks; i++) {
				const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
				webViewRef.current?.postMessage(
					JSON.stringify({
						type: "TRANSFER_CHUNK",
						transferId,
						index: i,
						chunk,
					}),
				);
			}

			webViewRef.current?.postMessage(
				JSON.stringify({
					type: "TRANSFER_END",
					transferId,
				}),
			);
		});
	};

	const initializePipeline = async () => {
		if (hasInitializedRef.current) return;
		hasInitializedRef.current = true;

		try {
			logger.info(
				"OnnxEngine",
				"WebView mounted. Beginning sequential asset dispatch (WASM + Models)...",
			);

			// 1. WASM Binary (14.8 MB)
			const wasmFile = await loadAssetFile(
				require("../../../assets/wasm/ort-wasm-simd-threaded.wasm"),
			);
			const wasmBase64 = await wasmFile.base64();
			await sendChunks("wasm", wasmBase64);

			// 2. Stage 1 ONNX Model (12.3 MB)
			const s1File = await loadAssetFile(
				require("../../../assets/models/manu_panel_best_640.onnx"),
			);
			const s1Base64 = await s1File.base64();
			await sendChunks("stage1", s1Base64);

			// 3. Stage 2 ONNX Model (12.1 MB)
			const s2File = await loadAssetFile(
				require("../../../assets/models/liamm_7seg_best_320.onnx"),
			);
			const s2Base64 = await s2File.base64();
			await sendChunks("stage2", s2Base64);

			logger.info(
				"OnnxEngine",
				"All models and WASM dispatched to WebView successfully.",
			);
		} catch (err) {
			logger.warn("OnnxEngine", "Failed during asset initialization", err);
		}
	};

	const handleMessage = (event: WebViewMessageEvent) => {
		let data: {
			type: string;
			transferId?: string;
			error?: string;
			message?: string;
			id?: string;
			boxes?: RawBox[];
			panelConf?: number;
			meanLuma?: number;
			stage1Ms?: number;
			stage2Ms?: number;
		};

		try {
			data = JSON.parse(event.nativeEvent.data);
		} catch {
			return;
		}

		if (data.type === "ERROR" && data.message) {
			logger.warn("OnnxEngine [WebView]", data.message);
			return;
		}

		if (data.type === "WEBVIEW_MOUNTED") {
			initializePipeline();
			return;
		}

		if (data.type === "TRANSFER_COMPLETE" && data.transferId) {
			const pending = transferResolvers.current.get(data.transferId);
			if (pending) {
				transferResolvers.current.delete(data.transferId);
				pending.resolve();
			}
			return;
		}

		if (data.type === "ENGINE_ERROR" && data.transferId) {
			const pending = transferResolvers.current.get(data.transferId);
			if (pending) {
				transferResolvers.current.delete(data.transferId);
				pending.reject(new Error(data.error || "Engine initialization failed"));
			}
			logger.warn(
				"OnnxEngine",
				`Engine error on ${data.transferId}: ${data.error}`,
			);
			return;
		}

		// Forward inference results and ready state to onnxBridge
		onnxBridge.handleMessageFromWebView(data);
	};

	if (!html) {
		return null;
	}

	return (
		<View style={styles.container} pointerEvents="none">
			<TypedWebView
				ref={webViewRef}
				source={{ html }}
				originWhitelist={["*"]}
				allowFileAccess={true}
				allowUniversalAccessFromFileURLs={true}
				allowingReadAccessToURL="*"
				javaScriptEnabled={true}
				domStorageEnabled={true}
				onLoadEnd={() => {
					logger.info("OnnxEngine", "WebView onLoadEnd fired");
					initializePipeline();
				}}
				onMessage={handleMessage}
				style={styles.webView}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		position: "absolute",
		left: 0,
		top: 0,
		width: 1,
		height: 1,
		opacity: 0.01,
		pointerEvents: "none",
	},
	webView: {
		width: 1,
		height: 1,
	},
});
