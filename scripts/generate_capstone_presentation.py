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

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def populate_presentation():
    template_path = r"C:\Users\frank\Downloads\Capstone_PPT_Template.pptx"
    output_path = r"docs\presentation\Capstone_Final_Review_Presentation.pptx"
    figures_dir = r"docs\project_report\figures"
    
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template not found at {template_path}")
    
    prs = Presentation(template_path)
    print(f"Loaded template with {len(prs.slides)} slides.")

    # Palette
    DARK_BLUE = RGBColor(16, 44, 87)
    CHARCOAL = RGBColor(40, 40, 40)
    ACCENT_BLUE = RGBColor(41, 128, 185)
    LIGHT_BG = RGBColor(245, 247, 250)
    BORDER_COLOR = RGBColor(200, 210, 225)
    WHITE = RGBColor(255, 255, 255)

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

    def fill_split_slide(slide, text_shape, subtitle_text, bullets, image_path, img_top_in=1.1, img_width_in=4.4, caption=None):
        # Position left text frame
        text_shape.left = Inches(0.5)
        text_shape.top = Inches(1.0)
        text_shape.width = Inches(4.7)
        text_shape.height = Inches(4.2)
        
        tf = text_shape.text_frame
        tf.clear()
        
        p0 = tf.paragraphs[0]
        p0.text = subtitle_text
        p0.font.bold = True
        p0.font.size = Pt(15)
        p0.font.color.rgb = DARK_BLUE
        p0.space_after = Pt(8)
        
        for b_text in bullets:
            p = tf.add_paragraph()
            p.text = b_text
            p.font.size = Pt(11.5)
            p.font.color.rgb = CHARCOAL
            p.space_after = Pt(4)
            p.level = 0
            
        # Add Image on the right
        if os.path.exists(image_path):
            img_left = Inches(5.35)
            slide.shapes.add_picture(image_path, img_left, Inches(img_top_in), width=Inches(img_width_in))
            if caption:
                tx_box = slide.shapes.add_textbox(img_left, Inches(img_top_in + 2.8), Inches(img_width_in), Inches(0.5))
                c_tf = tx_box.text_frame
                c_tf.clear()
                cp = c_tf.paragraphs[0]
                cp.text = caption
                cp.font.size = Pt(9.5)
                cp.font.italic = True
                cp.font.color.rgb = CHARCOAL
                cp.alignment = PP_ALIGN.CENTER

    def create_styled_table(slide, left, top, width, height, headers, data, col_widths=None):
        table_shape = slide.shapes.add_table(len(data) + 1, len(headers), left, top, width, height)
        table = table_shape.table
        
        if col_widths:
            for idx, w in enumerate(col_widths):
                table.columns[idx].width = w
                
        # Style headers
        for col_idx, h_text in enumerate(headers):
            cell = table.cell(0, col_idx)
            cell.fill.solid()
            cell.fill.fore_color.rgb = DARK_BLUE
            cell.margin_left = Inches(0.08)
            cell.margin_right = Inches(0.08)
            cell.margin_top = Inches(0.06)
            cell.margin_bottom = Inches(0.06)
            p = cell.text_frame.paragraphs[0]
            p.text = h_text
            p.font.bold = True
            p.font.size = Pt(10.5)
            p.font.color.rgb = WHITE
            
        # Style data rows
        for row_idx, row_values in enumerate(data):
            is_even = (row_idx % 2 == 0)
            bg_color = LIGHT_BG if is_even else WHITE
            for col_idx, val in enumerate(row_values):
                cell = table.cell(row_idx + 1, col_idx)
                cell.fill.solid()
                cell.fill.fore_color.rgb = bg_color
                cell.margin_left = Inches(0.08)
                cell.margin_right = Inches(0.08)
                cell.margin_top = Inches(0.05)
                cell.margin_bottom = Inches(0.05)
                p = cell.text_frame.paragraphs[0]
                p.text = val
                p.font.size = Pt(9.5)
                p.font.color.rgb = CHARCOAL
                if col_idx == 0:
                    p.font.bold = True
                elif col_idx == 1:
                    p.font.bold = True
                    p.font.color.rgb = ACCENT_BLUE
        return table_shape

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
    fill_split_slide(s7, s7.shapes[1], "Two-Tier Synchronization Advantages", [
        "Engineering Pivot: Transitioned from heavy YOLOv8 ONNX WASM to native INT8 MobileNetV3.",
        "Zero-Cost Edge Gate: Instant 24.34 ms on-device safety lockout blocks hazardous submissions.",
        "Active MEMS Interlock: Shutter locked outside 90 deg +/- 10 deg normal to eliminate keystone tilt.",
        "Two-Tier Decoupled Sync: 1.82 KB Tier-1 JSON dispatches in 1.14 s; photo upload deferred to Wi-Fi.",
        "99.12% OPEX Reduction: Slashes recurring cloud bills from Rs. 77,132/mo (GPUs) to Rs. 675/mo."
    ], os.path.join(figures_dir, "sync_throughput_comparison.png"), img_top_in=1.3, img_width_in=4.3,
       caption="Fig 1: Cellular Sync Throughput Comparison across 2G/EDGE")

    # =========================================================================
    # SLIDE 8: PROPOSED SOLUTION - SYSTEM ARCHITECTURE
    # =========================================================================
    s8 = prs.slides[7]
    fill_split_slide(s8, s8.shapes[1], "End-to-End System Architecture", [
        "Tier 1 (Edge Handset): Camera Viewfinder with MEMS leveling, onLayout reticles & INT8 wire safety.",
        "Tier 2 (Verification HUD): Dual-box HUD + CamScanner polygon cropper with 2.8x loupe & 2x zoom.",
        "Tier 3 (Local SQLite WAL): Atomicity with startup recovery pragmas resetting orphaned sync states.",
        "Tier 4 (FastAPI Gateway): Ephemeral ASGI gateway computing SHA-256 evidence seals & fleet sync-back.",
        "Tier 5 (Cloud VLM Auditor): Gemini 3.8 Flash evaluating 4-point physical QC via async task worker."
    ], os.path.join(figures_dir, "system_architecture.png"), img_top_in=1.15, img_width_in=4.35,
       caption="Fig 2: Hybrid Edge-Cloud Modular System Architecture")

    # =========================================================================
    # SLIDE 9: PROPOSED SOLUTION - KEY MODULES
    # =========================================================================
    s9 = prs.slides[8]
    fill_split_slide(s9, s9.shapes[1], "Key Subsystems & Functional Modules", [
        "1. Dynamic Viewfinder Overlay: Sensor tilt indicator + normalized coordinate reticle cropping.",
        "2. Wire Safety Classifier: 1.24 MB INT8 MobileNetV3 detecting conductor stripping (P >= 0.65).",
        "3. Sim-to-Real Digit Recognizer: ML Kit OCR + 7-segment automaton + height-ratio decimal recovery.",
        "4. CamScanner Polygon Cropper: 4-point polygon isolation with 2.8x floating loupe & 2x canvas zoom.",
        "5. Decoupled Asynchronous Sync: Stage-aware telemetry bar with non-blocking background VLM audit."
    ], os.path.join(figures_dir, "ocr_ablation_accuracy.png"), img_top_in=1.3, img_width_in=4.3,
       caption="Fig 3: Sim-to-Real OCR Automaton Ablation Benchmarking")

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
        "Security & Cryptography: FIPS 180-4 SHA-256 evidence seals and remote fleet disaster recovery sync-back."
    ])

    # =========================================================================
    # SLIDE 11: IMPLEMENTATION & RESULTS - DATASETS
    # =========================================================================
    s11 = prs.slides[10]
    fill_split_slide(s11, s11.shapes[1], "Dataset Structure & Testbed Setup", [
        "Curated Master Dataset: 3,220 field photographs across authentic Indian operational conditions.",
        "OEM Meter Models: Salzer, Genus Smart, Secure Premier 300, HPL Single Phase, and L&T AMI.",
        "Hazard Partition: 1,420 annotated hazardous mountings (stripped copper, loose screws, open bays).",
        "Compliant Partition: 1,800 compliant installations verified against IS 16444 specifications.",
        "Evaluation Handset: Low-cost Xiaomi Redmi 12 (MediaTek Helio G88, 4 GB RAM, Android 14)."
    ], os.path.join(figures_dir, "hazard_classification_matrix.png"), img_top_in=1.1, img_width_in=4.2,
       caption="Fig 4: Wire Safety Confusion Matrix on Test Partition")

    # =========================================================================
    # SLIDE 12: IMPLEMENTATION & RESULTS - PARAMETERS
    # =========================================================================
    s12 = prs.slides[11]
    s12.shapes[1].text_frame.clear()
    s12.shapes[1].left = Inches(0.5)
    s12.shapes[1].top = Inches(1.0)
    s12.shapes[1].width = Inches(9.0)
    s12.shapes[1].height = Inches(0.4)
    p_s12 = s12.shapes[1].text_frame.paragraphs[0]
    p_s12.text = "Empirically Calibrated System Parameters & Enforced Safety Thresholds"
    p_s12.font.bold = True
    p_s12.font.size = Pt(13)
    p_s12.font.color.rgb = DARK_BLUE

    table_headers = ["Subsystem / Interlock", "Calibrated Threshold", "Technical Rationale & Safety Enforcement"]
    table_rows = [
        ["Viewfinder MEMS Interlock", "90 deg +/- 10 deg normal", "Eliminates severe perspective keystone distortion prior to OCR segmentation."],
        ["Wire Safety Classifier", "P_hazard >= 0.65", "1.24 MB MobileNetV3 enforces un-dismissible lock on exposed copper/loose screws."],
        ["Decimal Height Boundary", "r = h_dot / h_digit < 0.82", "Distinguishes decimal dots from noise; prevents false whole-number decimal shifts."],
        ["Cloud VLM Reconciliation", "|Delta kWh| <= 1.0 kWh", "Gemini 3.8 Flash audits edge OCR reading against high-res photo; detects tampering."],
        ["Tier-1 Sync Buffer", "15 records (~1.82 KB)", "Minified JSON array guarantees deterministic 1.14 s dispatch over 2G/EDGE networks."],
        ["Telemetry Heartbeat", "30 s / 246 bytes pkt", "Real-time supervisor dispatch tracking; draws <236 KB across an 8-hour field shift."]
    ]
    create_styled_table(s12, Inches(0.5), Inches(1.5), Inches(9.0), Inches(3.4), table_headers, table_rows, [Inches(2.3), Inches(2.0), Inches(4.7)])

    # =========================================================================
    # SLIDE 13: IMPLEMENTATION & RESULTS - EXPERIMENTAL OUTCOMES
    # =========================================================================
    s13 = prs.slides[12]
    fill_split_slide(s13, s13.shapes[1], "Empirical Benchmarking & Performance Outcomes", [
        "Edge Latency: 24.34 ms (10.2x margin under 250 ms SLA; 50.9x faster than WASM).",
        "Memory Consumption: 4.59 MB RAM (7.6x under 35 MB ceiling; 8.4x drop vs WASM).",
        "Hazard Lockout: 100.0% lockout rate on 1,420 hazardous cases (zero false negatives).",
        "OCR Accuracy: CER slashed from 24.8% to 1.2% with 0.0% silent hallucinations.",
        "2G Sync Reliability: 100.0% in 1.14 s (vs 13.3% for conventional full-image uploads).",
        "Cloud Multimodal QC: 97.98% overall precision on seals, covers, and tamper markers."
    ], os.path.join(figures_dir, "latency_memory_benchmark.png"), img_top_in=1.3, img_width_in=4.35,
       caption="Fig 5: Edge Latency & Heap Memory Benchmark Across Hardware Tiers")

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
