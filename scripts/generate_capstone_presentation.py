r"""
Generate the official 16-slide VIT-AP University Capstone Final Review Presentation.
Strictly adheres to:
1. Official External Guide Reports (Review 1 & Review 2 from Adani AI Labs)
   - Exact Title: "Hybrid Edge-Cloud Visual Inspection System for Utility Meter Verification"
   - Official metrics, guidelines (IS 2500, REC TPQMA), formulas, and architecture.
2. Official VIT-AP SCOPE Capstone Presentation Template (C:\Users\frank\Downloads\Capstone_PPT_Template.pptx)
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

def populate_presentation():
    template_path = r"C:\Users\frank\Downloads\Capstone_PPT_Template.pptx"
    output_path = r"docs\presentation\Capstone_Final_Review_Presentation.pptx"
    
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template not found at {template_path}")
    
    prs = Presentation(template_path)
    print(f"Loaded template with {len(prs.slides)} slides.")

    # Colors
    DARK_BLUE = RGBColor(16, 44, 87)
    CHARCOAL = RGBColor(40, 40, 40)
    ACCENT_BLUE = RGBColor(41, 128, 185)

    def fill_content_box(shape, subtitle_text, bullets):
        tf = shape.text_frame
        tf.clear()
        
        # Subtitle paragraph
        p0 = tf.paragraphs[0]
        p0.text = subtitle_text
        p0.font.bold = True
        p0.font.size = Pt(16)
        p0.font.color.rgb = DARK_BLUE
        p0.space_after = Pt(8)
        
        # Add bullet paragraphs
        for b_text in bullets:
            p = tf.add_paragraph()
            p.text = b_text
            p.font.size = Pt(12.5)
            p.font.color.rgb = CHARCOAL
            p.space_after = Pt(5)
            p.level = 0

    # =========================================================================
    # SLIDE 1: TITLE SLIDE
    # =========================================================================
    s1 = prs.slides[0]
    # Shape 0: Title
    s1.shapes[0].text_frame.clear()
    p_rev = s1.shapes[0].text_frame.paragraphs[0]
    p_rev.text = "Capstone Final Review"
    p_rev.font.bold = True
    p_rev.font.size = Pt(22)
    p_rev.font.color.rgb = ACCENT_BLUE

    p_title = s1.shapes[0].text_frame.add_paragraph()
    p_title.text = "Hybrid Edge-Cloud Visual Inspection System for Utility Meter Verification"
    p_title.font.bold = True
    p_title.font.size = Pt(18)
    p_title.font.color.rgb = DARK_BLUE

    # Shape 1: Guides
    s1.shapes[1].text_frame.clear()
    p_g0 = s1.shapes[1].text_frame.paragraphs[0]
    p_g0.text = "Supervised By:"
    p_g0.font.bold = True
    p_g0.font.size = Pt(13)
    p_g0.font.color.rgb = DARK_BLUE

    p_g1 = s1.shapes[1].text_frame.add_paragraph()
    p_g1.text = "Internal Guide: Dr. Sibi Chakkaravarthy S, Associate Professor, SCOPE, VIT-AP"
    p_g1.font.size = Pt(11)
    p_g1.font.color.rgb = CHARCOAL

    p_g2 = s1.shapes[1].text_frame.add_paragraph()
    p_g2.text = "External Guide: Mr. Gowrav Shekar, Head of Tech & AI Practices, Adani AI Labs"
    p_g2.font.size = Pt(11)
    p_g2.font.color.rgb = CHARCOAL

    # Shape 2: SDP ID & Student Info
    s1.shapes[2].text_frame.clear()
    p_sdp = s1.shapes[2].text_frame.paragraphs[0]
    p_sdp.text = "SDP Id: CAPSTONE - 4001"
    p_sdp.font.bold = True
    p_sdp.font.size = Pt(12)
    p_sdp.font.color.rgb = DARK_BLUE

    p_stu = s1.shapes[2].text_frame.add_paragraph()
    p_stu.text = "Student: Frank Mathew Sajan (23BCE8713)"
    p_stu.font.bold = True
    p_stu.font.size = Pt(12)
    p_stu.font.color.rgb = CHARCOAL

    p_prog = s1.shapes[2].text_frame.add_paragraph()
    p_prog.text = "B.Tech CSE (AIML), School of Computer Science & Engineering"
    p_prog.font.size = Pt(11)
    p_prog.font.color.rgb = CHARCOAL

    # Shape 3: SCOPE VIT-AP block
    s1.shapes[3].text_frame.clear()
    p_sc = s1.shapes[3].text_frame.paragraphs[0]
    p_sc.text = "School of Computer Science and Engineering (SCOPE)"
    p_sc.font.bold = True
    p_sc.font.size = Pt(11)
    p_sc.font.color.rgb = DARK_BLUE

    p_uni = s1.shapes[3].text_frame.add_paragraph()
    p_uni.text = "VIT-AP University, Amaravati - 522237, Andhra Pradesh"
    p_uni.font.size = Pt(10)
    p_uni.font.color.rgb = CHARCOAL

    # =========================================================================
    # SLIDE 2: PRESENTATION OUTLINE
    # =========================================================================
    s2 = prs.slides[1]
    fill_content_box(s2.shapes[1], "Presentation Outline", [
        "1. Introduction: Project Overview, Problem Statement & Objectives",
        "2. Background & Related Work: Existing AMR Limitations & Proposed Improvements",
        "3. Proposed Solution: System Architecture, Key Modules & Evolutionary Narrative",
        "4. Algorithms & Implementation: INT8 Neural Safety, Reticle OCR & Two-Tier Sync",
        "5. Experimental Outcomes: Edge Latency, Lockout Rates, Sim-to-Real Ablation & VLM Audit",
        "6. Summary: Key Findings, Project Limitations, Future Directions & Bibliography"
    ])

    # =========================================================================
    # SLIDE 3: INTRODUCTION - PROJECT OVERVIEW
    # =========================================================================
    s3 = prs.slides[2]
    fill_content_box(s3.shapes[1], "Project Overview: Smart Meter Quality Assurance", [
        "National Mandate: India's RDSS scheme targets deployment of 250M smart electricity meters.",
        "Operational Risk: Field contractor mounting errors cause terminal burnouts and unmetered bypasses.",
        "Core Bottleneck: 20-25% of meters reside in subterranean basements/shafts with 2G/EDGE dead zones.",
        "Proposed Innovation: Novo - offline-first, safety-gated hybrid edge-cloud visual inspection system.",
        "Key Deliverable: 24.34 ms INT8 wire-safety lockout + zero silent OCR misreads + 1.14 s 2G sync."
    ])

    # =========================================================================
    # SLIDE 4: INTRODUCTION - PROBLEM STATEMENT & MOTIVATIONS
    # =========================================================================
    s4 = prs.slides[3]
    fill_content_box(s4.shapes[1], "Problem Statement & Motivations", [
        "Lot Sampling Blind Spot: IS 2500 & REC TPQMA audit only 10-20%; 80-90% remain uninspected.",
        "Terminal Burnout Threat: Loose terminal screws and exposed wires cause >30% of early meter meltdowns.",
        "Sealing & Transcription Errors: Missing seals in 4-8% of setups; manual OCR has 4-7% error rate.",
        "Bandwidth Disconnect: 20-25% meters sit in RF dead zones; multi-MB uploads fail with socket timeouts.",
        "High Remediation Costs: Catching errors post-hoc costs more than the initial installation deployment."
    ])

    # =========================================================================
    # SLIDE 5: INTRODUCTION - OBJECTIVES & EXPECTED IMPACT
    # =========================================================================
    s5 = prs.slides[4]
    fill_content_box(s5.shapes[1], "Objectives & Expected Impact", [
        "1. Point-of-Work Safety Gate: Prevent terminal burnouts via real-time on-device hazard lockout.",
        "2. Viewfinder Leveling: Lock shutter until phone is perpendicular (90 deg +/- 10 deg) to meter face.",
        "3. Zero Silent Misreads: Guarantee 0.0% silent hallucinations via 7-segment character automaton.",
        "4. Instant Field UX: Provide <250 ms zero-delay shutter pushing to Intermediary Verification Screen.",
        "5. Two-Tier SQLite Sync: sub-2 KB Tier-1 JSON dispatches in 1.14 s; Tier-2 images deferred to Wi-Fi.",
        "6. Multimodal Cloud QC: Secondary 4-point physical QC checklist evaluation via Google Gemini VLM."
    ])

    # =========================================================================
    # SLIDE 6: BACKGROUND & RELATED WORK - LIMITATIONS
    # =========================================================================
    s6 = prs.slides[5]
    fill_content_box(s6.shapes[1], "Related Work & Their Limitations", [
        "Unconstrained Cloud AMR (Laroca et al., Salomon et al.): Fails in radio-shielded basements and dead zones.",
        "Dedicated Ruggedized Handhelds: Cost-prohibitive (>Rs. 45,000/unit); unviable for contractor deployment.",
        "Synthetic OCR Models: Exhibit severe domain gap; misread scratched 7-segment displays without alert.",
        "Post-Hoc Supervisory Audits: Occur weeks after handover, shifting remediation expense entirely to DISCOMs.",
        "Absence of Safety Interlocks: Prior AMR literature reads digits but ignores fatal terminal wiring hazards."
    ])

    # =========================================================================
    # SLIDE 7: BACKGROUND & RELATED WORK - IMPROVEMENTS
    # =========================================================================
    s7 = prs.slides[6]
    fill_content_box(s7.shapes[1], "Improvements Over Existing Solutions", [
        "Two-Phase Engineering Evolution: Evolved from heavy 2-stage YOLOv8 ONNX WASM to native INT8 MobileNetV3.",
        "Zero-Cost Edge Safety Gate: Enforces immediate submission block on exposed wiring (1.24 MB, 24.34 ms).",
        "Active Accelerometer Interlock: tilt = arctan(Z / hypot(X, Y)) * 180 / pi locks shutter outside 90 deg +/- 10 deg.",
        "Two-Tier Decoupled Sync: Sub-2 KB Tier-1 JSON dispatches in 1.14 s; high-res image sync deferred to Wi-Fi.",
        "99.12% Cloud OPEX Reduction: Slashes compute fees from Rs. 77,132/mo (GPUs) to Rs. 675/mo (serverless)."
    ])

    # =========================================================================
    # SLIDE 8: PROPOSED SOLUTION - SYSTEM ARCHITECTURE
    # =========================================================================
    s8 = prs.slides[7]
    fill_content_box(s8.shapes[1], "System Architecture: Hybrid Edge-Cloud Topology", [
        "Tier 1 - Edge Handset: Camera Viewfinder with MEMS leveling, onLayout reticle math, INT8 wire safety.",
        "Tier 2 - Verification Screen: inspect-preview.tsx dual-box HUD (Step A safety banner, Step B editable kWh).",
        "Tier 3 - SQLite WAL SSOT: On-device storage with startup recovery pragmas resetting orphaned sync states.",
        "Tier 4 - FastAPI Ingestion Gateway: Ephemeral ASGI backend computing SHA-256 evidence seals.",
        "Tier 5 - Cloud VLM Auditor: Multimodal Gemini 3.8 Flash scoring 4-point physical QC with auto-fallback."
    ])

    # =========================================================================
    # SLIDE 9: PROPOSED SOLUTION - KEY MODULES
    # =========================================================================
    s9 = prs.slides[8]
    fill_content_box(s9.shapes[1], "Key Components & Functional Modules", [
        "1. Dynamic Viewfinder Overlay: Sensor tilt indicator + normalized percentage crop without window offsets.",
        "2. Wire Safety Classifier: 1.24 MB INT8 MobileNetV3 detecting conductor stripping (P_hazard >= 0.65).",
        "3. Sim-to-Real Digit Recognizer: ML Kit OCR + 7-segment automaton + height-ratio decimal recovery (r < 0.82).",
        "4. Intermediary Verification Screen: 1-second technician sign-off eliminating UI thread freeze.",
        "5. Two-Way Fleet Directives: Real-time administrative safety push alerts with local SQLite persistence."
    ])

    # =========================================================================
    # SLIDE 10: PROPOSED SOLUTION - ALGORITHMS & TOOLS
    # =========================================================================
    s10 = prs.slides[9]
    fill_content_box(s10.shapes[1], "Algorithms, Technologies & Frameworks Used", [
        "Edge Machine Learning: INT8 Quantized MobileNetV3 on TensorFlow Lite with ARM NNAPI/XNNPACK.",
        "Mobile Framework: React Native 0.76.7, Expo SDK 54, Expo Router v4, TypeScript 5.3.",
        "Embedded Database: SQLite 3.45 with Write-Ahead Logging (WAL) and synchronous normal mode.",
        "Cloud Ingestion Gateway: Python 3.12, FastAPI 0.115, Uvicorn ASGI, Pydantic v2 data contracts.",
        "Multimodal Cloud AI: Google Gemini Interactions API (gemini-3.8-flash primary, gemini-4-hydrogen fallback).",
        "Security & Cryptography: FIPS 180-4 SHA-256 evidence seals and Tailscale WireGuard overlay mesh."
    ])

    # =========================================================================
    # SLIDE 11: IMPLEMENTATION & RESULTS - DATASETS
    # =========================================================================
    s11 = prs.slides[10]
    fill_content_box(s11.shapes[1], "Dataset Descriptions & Evaluation Setup", [
        "Curated Master Dataset: 3,220 multi-source field photographs across authentic Indian operating conditions.",
        "OEM Meter Models: Salzer, Genus Smart, Secure Premier 300, HPL Single Phase, and L&T AMI meters.",
        "Hazard Partition: 1,420 annotated hazardous mountings (stripped copper, loose screws, unseated covers).",
        "Compliant Partition: 1,800 compliant installations verified against IS 16444 specifications.",
        "Contractor Testbed Handset: Xiaomi Redmi 12 (MediaTek Helio G88, 4 GB LPDDR4X RAM, Android 14)."
    ])

    # =========================================================================
    # SLIDE 12: IMPLEMENTATION & RESULTS - PARAMETERS
    # =========================================================================
    s12 = prs.slides[11]
    fill_content_box(s12.shapes[1], "Operational System Parameters & Thresholds", [
        "Tilt Cutoff Threshold: Perpendicular plane (90 deg +/- 10 deg) relative to meter normal.",
        "Hazard Lockout Threshold: P_hazard >= 0.65 enforces un-dismissible submission lock.",
        "Decimal Height-Ratio Boundary: r = h_dot / h_digit < 0.82 triggers fractional decimal insertion.",
        "VLM Reconciliation Tolerance: | kWh_edge - kWh_cloud | <= 1.0 kWh validates edge transcription.",
        "Tier-1 Batch Boundary: 15 inspections per minified JSON array (payload size: 1.82 KB).",
        "Telemetry Heartbeat Interval: 30 seconds; 246 bytes per packet (<236 KB per 8-hour shift)."
    ])

    # =========================================================================
    # SLIDE 13: IMPLEMENTATION & RESULTS - EXPERIMENTAL OUTCOMES
    # =========================================================================
    s13 = prs.slides[12]
    fill_content_box(s13.shapes[1], "Empirical Benchmarking & Experimental Outcomes", [
        "Edge Inference Latency: 24.34 ms (10.2x margin under 250 ms ceiling; 50.9x speedup vs WASM).",
        "Peak Heap Footprint: 4.59 MB RAM (7.6x margin under 35 MB RAM constraint; 8.4x drop vs WASM).",
        "Hazard Lockout Enforcement: 100.0% lockout rate on 1,420 hazardous cases with zero false negatives.",
        "OCR Error Rate: Reduced CER from 24.8% to 1.2% with 0.0% silent digit hallucinations.",
        "2G Cellular Sync: 100.0% success rate in 1.14 s (vs 13.3% success for conventional photo uploads).",
        "Cloud VLM Physical QC: 97.98% overall accuracy on terminal covers, seals, and casing integrity."
    ])

    # =========================================================================
    # SLIDE 14: SUMMARY - FINDINGS, LIMITATIONS & FUTURE
    # =========================================================================
    s14 = prs.slides[13]
    tf14 = s14.shapes[1].text_frame
    tf14.clear()
    
    # Key Findings
    p_kf_t = tf14.paragraphs[0]
    p_kf_t.text = "Key Findings"
    p_kf_t.font.bold = True
    p_kf_t.font.size = Pt(14.5)
    p_kf_t.font.color.rgb = DARK_BLUE
    p_kf_t.space_after = Pt(3)

    for bullet in [
        "Eliminates 30% terminal burnout failure mode directly at the point of work.",
        "Enables 100% inspection coverage under IS 16444 without recurring cloud GPU costs (99.12% OPEX cut)."
    ]:
        p = tf14.add_paragraph()
        p.text = bullet
        p.font.size = Pt(11.5)
        p.font.color.rgb = CHARCOAL
        p.space_after = Pt(2)

    # Limitations
    p_lim_t = tf14.add_paragraph()
    p_lim_t.text = "Limitations"
    p_lim_t.font.bold = True
    p_lim_t.font.size = Pt(14.5)
    p_lim_t.font.color.rgb = DARK_BLUE
    p_lim_t.space_before = Pt(6)
    p_lim_t.space_after = Pt(3)

    for bullet in [
        "Optical OCR requires minimum ambient illumination (>= 25 lux); heavily scratched lenses require manual verify."
    ]:
        p = tf14.add_paragraph()
        p.text = bullet
        p.font.size = Pt(11.5)
        p.font.color.rgb = CHARCOAL
        p.space_after = Pt(2)

    # Future Directions
    p_fut_t = tf14.add_paragraph()
    p_fut_t.text = "Future Directions"
    p_fut_t.font.bold = True
    p_fut_t.font.size = Pt(14.5)
    p_fut_t.font.color.rgb = DARK_BLUE
    p_fut_t.space_before = Pt(6)
    p_fut_t.space_after = Pt(3)

    for bullet in [
        "Thermal Bolometer Fusion: Smartphone LWIR sensor fusion to detect I^2 R contact resistance heating.",
        "On-Device SLM Distillation: Distilling Gemini VLM into quantized on-device SmolVLM/PaliGemma."
    ]:
        p = tf14.add_paragraph()
        p.text = bullet
        p.font.size = Pt(11.5)
        p.font.color.rgb = CHARCOAL
        p.space_after = Pt(2)

    # =========================================================================
    # SLIDE 15: BIBLIOGRAPHY
    # =========================================================================
    s15 = prs.slides[14]
    s15.shapes[0].text_frame.text = "Bibliography"
    s15.shapes[0].text_frame.paragraphs[0].font.bold = True
    s15.shapes[0].text_frame.paragraphs[0].font.size = Pt(20)
    s15.shapes[0].text_frame.paragraphs[0].font.color.rgb = DARK_BLUE

    tf15 = s15.shapes[1].text_frame
    tf15.clear()
    refs = [
        "[1] R. Laroca et al., 'Convolutional neural networks for automatic meter reading,' J. Electron. Imaging, 2019.",
        "[2] G. R. Salomon et al., 'Deep Learning-Based Automatic Meter Reading: A Review,' IEEE Access, 2020.",
        "[3] A. Howard et al., 'Searching for MobileNetV3,' in IEEE/CVF ICCV, 2019, pp. 1314-1324.",
        "[4] Bureau of Indian Standards, 'IS 16444: A.C. Static Direct Connected Smart Meters,' New Delhi, 2015.",
        "[5] Central Electricity Authority, 'Revamped Distribution Sector Scheme (RDSS) Guidelines,' MoP, 2021.",
        "[6] Gemini Team, 'Gemini: A Family of Highly Capable Multimodal Models,' arXiv:2312.11805, 2023.",
        "[7] National Institute of Standards and Technology, 'FIPS PUB 180-4: Secure Hash Standard (SHS),' 2015."
    ]
    p_init = tf15.paragraphs[0]
    p_init.text = refs[0]
    p_init.font.size = Pt(11)
    p_init.font.color.rgb = CHARCOAL
    p_init.space_after = Pt(4)
    for r in refs[1:]:
        p = tf15.add_paragraph()
        p.text = r
        p.font.size = Pt(11)
        p.font.color.rgb = CHARCOAL
        p.space_after = Pt(4)

    # =========================================================================
    # SLIDE 16: CONCLUDING SLIDE
    # =========================================================================
    s16 = prs.slides[15]
    tf16 = s16.shapes[0].text_frame
    tf16.clear()
    
    p_end_title = tf16.paragraphs[0]
    p_end_title.text = "Thank You!"
    p_end_title.font.bold = True
    p_end_title.font.size = Pt(32)
    p_end_title.font.color.rgb = DARK_BLUE
    p_end_title.alignment = PP_ALIGN.CENTER
    p_end_title.space_after = Pt(14)

    p_end_sub = tf16.add_paragraph()
    p_end_sub.text = "Questions & Technical Discussion"
    p_end_sub.font.bold = True
    p_end_sub.font.size = Pt(18)
    p_end_sub.font.color.rgb = ACCENT_BLUE
    p_end_sub.alignment = PP_ALIGN.CENTER
    p_end_sub.space_after = Pt(20)

    p_end_cand = tf16.add_paragraph()
    p_end_cand.text = "Frank Mathew Sajan (Registration No: 23BCE8713)\nB.Tech Computer Science & Engineering (AIML)\nSchool of Computer Science and Engineering (SCOPE), VIT-AP University"
    p_end_cand.font.size = Pt(13)
    p_end_cand.font.color.rgb = CHARCOAL
    p_end_cand.alignment = PP_ALIGN.CENTER
    p_end_cand.space_after = Pt(14)

    p_end_gd = tf16.add_paragraph()
    p_end_gd.text = "Internal Academic Guide: Dr. Sibi Chakkaravarthy S (SCOPE, VIT-AP)\nExternal Industry Guide: Mr. Gowrav Shekar (Adani AI Labs, Ahmedabad)"
    p_end_gd.font.size = Pt(12)
    p_end_gd.font.color.rgb = DARK_BLUE
    p_end_gd.alignment = PP_ALIGN.CENTER

    prs.save(output_path)
    print(f"Successfully generated {output_path} ({os.path.getsize(output_path)} bytes)")

if __name__ == "__main__":
    populate_presentation()
