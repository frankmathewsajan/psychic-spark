const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Register binary asset extensions for ONNX models, TFLite models, and WebAssembly binaries
// Note: Do NOT add "mjs" here so Metro continues resolving JS/MJS modules normally.
config.resolver.assetExts.push("onnx", "wasm", "bin", "tflite");

module.exports = config;
