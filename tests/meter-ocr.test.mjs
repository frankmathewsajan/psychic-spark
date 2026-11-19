import test from "node:test";
import assert from "node:assert/strict";

function sanitize7Segment(raw) {
	return raw
		.replace(/O/g, "0")
		.replace(/[Il|!]/g, "1")
		.replace(/Z/g, "2")
		.replace(/[A]/g, "4")
		.replace(/[Ss]/g, "5")
		.replace(/[Gb]/g, "6")
		.replace(/T/g, "7")
		.replace(/B/g, "8")
		.replace(/[gq]/g, "9")
		.replace(/[^0-9.]/g, "");
}

function parseMeterCandidateLine(rawText) {
	const trimmed = rawText.trim();
	if (!trimmed) return null;

	const faceplateSpecRegex = /\b(230V|240V|50Hz|60Hz|TYPE|PE1|imp|IEC)\b/i;
	if (faceplateSpecRegex.test(trimmed)) return null;

	const textWithoutUnits = trimmed
		.replace(/\b(kWh|kVAh|kW\.h|kvarh)\b/gi, "")
		.trim();

	const collapsed = textWithoutUnits.replace(/\s+/g, "");
	const numericRegex = /^\d{1,8}(\.\d{1,2})?$/;

	if (numericRegex.test(collapsed)) {
		return collapsed;
	}

	const sanitized = sanitize7Segment(collapsed);
	const match = sanitized.match(/\d{1,8}(\.\d{1,2})?/);
	return match ? match[0] : null;
}

test("Meter OCR Candidate Parser", async (t) => {
	await t.test("parses clean 7-segment reading with kWh unit", () => {
		assert.equal(parseMeterCandidateLine("0507106 kWh"), "0507106");
		assert.equal(parseMeterCandidateLine("050710.6 kWh"), "050710.6");
		assert.equal(parseMeterCandidateLine("123.4 kW.h"), "123.4");
	});

	await t.test("parses readings with internal spaces", () => {
		assert.equal(parseMeterCandidateLine("0507 106"), "0507106");
		assert.equal(parseMeterCandidateLine("050 710.6 kWh"), "050710.6");
	});

	await t.test("sanitizes 7-segment misreads (A->4, S->5, O->0)", () => {
		assert.equal(parseMeterCandidateLine("O507106"), "0507106");
		assert.equal(parseMeterCandidateLine("05A7106 kWh"), "0547106");
		assert.equal(parseMeterCandidateLine("S507106"), "5507106");
	});

	await t.test("rejects faceplate specs while allowing LCD readings", () => {
		assert.equal(parseMeterCandidateLine("240V 10(40)A 50Hz TYPE: PE1-7"), null);
		assert.equal(parseMeterCandidateLine("2400 imp/kWh"), null);
		assert.equal(parseMeterCandidateLine("IEC 62053-21"), null);
	});

	await t.test("supports short numeric readings (1-3 digits)", () => {
		assert.equal(parseMeterCandidateLine("0.0 kWh"), "0.0");
		assert.equal(parseMeterCandidateLine("42.5"), "42.5");
		assert.equal(parseMeterCandidateLine("105"), "105");
	});
});
