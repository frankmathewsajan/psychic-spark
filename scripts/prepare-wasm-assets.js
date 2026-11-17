const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const ONNX_DIST = path.join(ROOT, "node_modules", "onnxruntime-web", "dist");
const MODELS_DIR = path.join(ROOT, "models");

const ASSETS_WASM = path.join(ROOT, "assets", "wasm");
const ASSETS_MODELS = path.join(ROOT, "assets", "models");

function copyFile(src, dest) {
	if (!fs.existsSync(src)) {
		throw new Error(`Source file missing: ${src}`);
	}
	fs.copyFileSync(src, dest);
	const sizeMb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
	console.log(`Copied: ${path.basename(dest)} (${sizeMb} MB)`);
}

function main() {
	fs.mkdirSync(ASSETS_WASM, { recursive: true });
	fs.mkdirSync(ASSETS_MODELS, { recursive: true });

	console.log("--- 1. Packaging ONNX Runtime Assets into assets/wasm/ ---");

	// Create self-contained, inlined ORT runtime bundle (with Emscripten factory pre-bound)
	// This eliminates all dynamic import() and file:// CORS blocks in iOS WKWebView!
	let mjsText = fs.readFileSync(
		path.join(ONNX_DIST, "ort-wasm-simd-threaded.mjs"),
		"utf8",
	);
	mjsText = mjsText.replace(
		/if\(m\)\{[^}]+import\("module"\)[^}]+\}/,
		"if(false){}",
	);
	mjsText = mjsText.replace(/import\.meta\.url/g, '"./"');
	mjsText = mjsText.replace(
		/export\s+default\s+ortWasmThreaded;[\s\S]*$/,
		"window.__ortWasmFactory = ortWasmThreaded;\n",
	);

	let ortJs = fs.readFileSync(path.join(ONNX_DIST, "ort.min.js"), "utf8");
	ortJs = ortJs.replace(
		"go=void 0,",
		'go=(typeof window!=="undefined"&&window.__ortWasmFactory)||void 0,',
	);

	const combinedRuntime = `${mjsText}\n;\n${ortJs}`;
	const runtimeDest = path.join(ASSETS_WASM, "ort.runtime.bin");
	fs.writeFileSync(runtimeDest, combinedRuntime, "utf8");
	const runtimeMb = (fs.statSync(runtimeDest).size / (1024 * 1024)).toFixed(2);
	console.log(`Prepared inlined bundle: ort.runtime.bin (${runtimeMb} MB)`);

	copyFile(
		path.join(ONNX_DIST, "ort-wasm-simd-threaded.wasm"),
		path.join(ASSETS_WASM, "ort-wasm-simd-threaded.wasm"),
	);

	console.log("\n--- 2. Packaging Verified ONNX Models into assets/models/ ---");
	copyFile(
		path.join(MODELS_DIR, "manu_panel_best_640.onnx"),
		path.join(ASSETS_MODELS, "manu_panel_best_640.onnx"),
	);
	copyFile(
		path.join(MODELS_DIR, "liamm_7seg_best_320.onnx"),
		path.join(ASSETS_MODELS, "liamm_7seg_best_320.onnx"),
	);

	console.log("\n[SUCCESS] Mobile assets staged successfully.");
}

main();
