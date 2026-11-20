r"""
Generate the official 16-slide VIT-AP University Capstone Final Review Presentation.
Strictly adheres to:
1. Official External Guide Reports (Review 1 & Review 2 from Adani AI Labs)
   - Exact Title: "Hybrid Edge-Cloud Visual Inspection System for Utility Meter Verification"
   - Official metrics, guidelines (IS 2500, REC TPQMA), formulas, and architecture.
2. Official VIT-AP SCOPE Capstone Presentation Template (C:\Users\frank\Downloads\Capstone_PPT_Template.pptx)
   - Strict diagonal logo scaling for both Adani and VIT-AP (zero distortion).
   - Minimum 14pt body font size, professional headers and subtitles.
   - Clean alignment, centered layouts, and zero overlap with slide footers.
"""

import os
from PIL import Image
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_AUTO_SIZE
from pptx.oxml import parse_xml

def populate_presentation():
    template_path = r"C:\Users\frank\Downloads\Capstone_PPT_Template.pptx"
    output_path = r"docs\presentation\Capstone_Final_Review_Presentation.pptx"
    figures_dir = r"docs\project_report\figures"
    
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template not found at {template_path}")
    
    prs = Presentation(template_path)
    print(f"Loaded template with {len(prs.slides)} slides.")

    # Official Presentation Color Palette
    DARK_BLUE = RGBColor(16, 44, 87)
    CHARCOAL = RGBColor(35, 35, 35)
    ACCENT_BLUE = RGBColor(41, 128, 185)
    LIGHT_BG = RGBColor(245, 247, 250)
    BORDER_COLOR = RGBColor(200, 210, 225)
    WHITE = RGBColor(255, 255, 255)

    def clear_bullet_formatting(p):
        """Remove template-inherited erratic Wingdings bullets so runs control bullets cleanly."""
        pPr = p._p.get_or_add_pPr()
        for child in list(pPr):
            if child.tag.endswith(('buClr', 'buSzPct', 'buFont', 'buChar', 'buNone')):
                pPr.remove(child)
        pPr.append(parse_xml('<a:buNone xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>'))
        pPr.set('marL', '0')
        pPr.set('indent', '0')

    def style_header(slide, title_text):
        """Format the top header title and ensure the top-right VIT-AP logo maintains exact diagonal proportions."""
        if len(slide.shapes) > 0 and slide.shapes[0].has_text_frame:
            s_top = slide.shapes[0]
            s_top.left = Inches(0.6)
            s_top.top = Inches(0.20)
            s_top.width = Inches(7.6)
            s_top.height = Inches(0.80)
            tf = s_top.text_frame
            tf.auto_size = MSO_AUTO_SIZE.NONE
            tf.word_wrap = True
            tf.margin_left = Inches(0)
            tf.margin_right = Inches(0)
            tf.margin_top = Inches(0)
            tf.margin_bottom = Inches(0)
            tf.clear()
            p = tf.paragraphs[0]
            clear_bullet_formatting(p)
            p.text = title_text
            p.font.bold = True
            p.font.size = Pt(24)
            p.font.color.rgb = DARK_BLUE

        # Adjust top-right VIT-AP logo to preserve exact 3.231 diagonal aspect ratio (no horizontal dragging)
        for s in slide.shapes:
            if s.shape_type == 13:  # PICTURE
                s.left = Inches(8.30)
                s.top = Inches(0.18)
                s.width = Inches(1.45)
                s.height = Inches(0.449)

    def add_bullets_to_frame(text_frame, bullet_tuples, font_size=14, space_after=6, show_bullet=True):
        """Add bullet items where each item is (bold_lead, body_text) with uniform accent bullets."""
        text_frame.clear()
        for idx, (lead, body) in enumerate(bullet_tuples):
            p = text_frame.paragraphs[0] if idx == 0 else text_frame.add_paragraph()
            clear_bullet_formatting(p)
            p.space_after = Pt(space_after)
            p.level = 0
            
            if show_bullet:
                # Cyan accent bullet
                rb = p.add_run()
                rb.text = "\u2022  "
                rb.font.bold = True
                rb.font.size = Pt(font_size)
                rb.font.color.rgb = ACCENT_BLUE

            # Bold lead-in run
            r1 = p.add_run()
            r1.text = lead + " "
            r1.font.bold = True
            r1.font.size = Pt(font_size)
            r1.font.color.rgb = DARK_BLUE
            
            # Body description run
            r2 = p.add_run()
            r2.text = body
            r2.font.bold = False
            r2.font.size = Pt(font_size)
            r2.font.color.rgb = CHARCOAL

    def fill_content_box(shape, bullet_tuples, space_after=6):
        """Format full-width bulleted slides (Slides 2, 3, 4, 5, 6)."""
        shape.left = Inches(0.6)
        shape.top = Inches(1.10)
        shape.width = Inches(8.8)
        shape.height = Inches(4.0)
        add_bullets_to_frame(shape.text_frame, bullet_tuples, font_size=14, space_after=space_after)

    def fill_split_slide(slide, text_shape, bullet_tuples, image_path, caption=None, max_w=4.30, max_h=3.10):
        """Format split layout slides (text left, figure/chart right)."""
        text_shape.left = Inches(0.6)
        text_shape.top = Inches(1.10)
        text_shape.width = Inches(4.55)
        text_shape.height = Inches(4.0)
        
        add_bullets_to_frame(text_shape.text_frame, bullet_tuples, font_size=14, space_after=5)
            
        # Add Image on the right with strict proportional diagonal scaling
        if os.path.exists(image_path):
            with Image.open(image_path) as im:
                aspect = im.width / im.height
            
            if aspect >= (max_w / max_h):
                w_in = max_w
                h_in = max_w / aspect
            else:
                h_in = max_h
                w_in = max_h * aspect
                
            left_in = 5.35 + (max_w - w_in) / 2.0
            top_in = 1.15
            
            slide.shapes.add_picture(image_path, Inches(left_in), Inches(top_in), width=Inches(w_in), height=Inches(h_in))
            
            if caption:
                cap_top = top_in + h_in + 0.10
                tx_box = slide.shapes.add_textbox(Inches(5.20), Inches(cap_top), Inches(4.50), Inches(0.35))
                tx_box.text_frame.word_wrap = True
                c_tf = tx_box.text_frame
                c_tf.clear()
                cp = c_tf.paragraphs[0]
                cp.text = caption
                cp.font.size = Pt(9.5)
                cp.font.italic = True
                cp.font.color.rgb = CHARCOAL
                cp.alignment = PP_ALIGN.CENTER

    def fill_dual_phone_slide(slide, text_shape, bullet_tuples, img1_path, img2_path, caption=None):
        """Format split slide with two mobile handset screenshots side-by-side."""
        text_shape.left = Inches(0.6)
        text_shape.top = Inches(1.10)
        text_shape.width = Inches(4.55)
        text_shape.height = Inches(4.0)
        
        add_bullets_to_frame(text_shape.text_frame, bullet_tuples, font_size=14, space_after=4)
            
        # Two phone screens side-by-side
        if os.path.exists(img1_path) and os.path.exists(img2_path):
            phone_h = 3.00
            phone_w = phone_h * 0.4475  # ~1.34 inches (716x1600 aspect ratio)
            
            p1_left = 5.75
            p2_left = 7.30
            p_top = 1.15
            
            slide.shapes.add_picture(img1_path, Inches(p1_left), Inches(p_top), width=Inches(phone_w), height=Inches(phone_h))
            slide.shapes.add_picture(img2_path, Inches(p2_left), Inches(p_top), width=Inches(phone_w), height=Inches(phone_h))
            
            if caption:
                cap_top = p_top + phone_h + 0.10
                tx_box = slide.shapes.add_textbox(Inches(5.25), Inches(cap_top), Inches(4.50), Inches(0.35))
                tx_box.text_frame.word_wrap = True
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
            p.font.size = Pt(12)
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
                p.font.size = Pt(11)
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
    
    # Remove existing distorted VIT-AP logo from template to avoid doubling
    for shape in list(s1.shapes):
        if shape.shape_type == 13:  # PICTURE
            sp = shape._element
            sp.getparent().remove(sp)

    # Shape 0: Title box
    s1.shapes[0].left = Inches(0.5)
    s1.shapes[0].top = Inches(0.35)
    s1.shapes[0].width = Inches(5.9)
    s1.shapes[0].height = Inches(1.8)
    s1.shapes[0].text_frame.clear()
    
    p_rev = s1.shapes[0].text_frame.paragraphs[0]
    p_rev.text = "Capstone Final Review"
    p_rev.font.bold = True
    p_rev.font.size = Pt(28)
    p_rev.font.color.rgb = ACCENT_BLUE
    p_rev.space_after = Pt(4)

    p_title = s1.shapes[0].text_frame.add_paragraph()
    p_title.text = "Hybrid Edge-Cloud Visual Inspection System for Utility Meter Verification"
    p_title.font.bold = True
    p_title.font.size = Pt(20)
    p_title.font.color.rgb = DARK_BLUE

    # Shape 1: Supervised By
    s1.shapes[1].left = Inches(0.5)
    s1.shapes[1].top = Inches(2.25)
    s1.shapes[1].width = Inches(9.2)
    s1.shapes[1].height = Inches(1.1)
    s1.shapes[1].text_frame.clear()
    
    p_g0 = s1.shapes[1].text_frame.paragraphs[0]
    p_g0.text = "Supervised By:"
    p_g0.font.bold = True
    p_g0.font.size = Pt(16)
    p_g0.font.color.rgb = DARK_BLUE
    p_g0.space_after = Pt(3)

    p_g1 = s1.shapes[1].text_frame.add_paragraph()
    p_g1.text = "Internal Academic Guide: Dr. Sibi Chakkaravarthy S, Associate Professor, SCOPE, VIT-AP University"
    p_g1.font.size = Pt(14)
    p_g1.font.color.rgb = CHARCOAL

    p_g2 = s1.shapes[1].text_frame.add_paragraph()
    p_g2.text = "External Industry Guide: Mr. Gowrav Shekar, Head of Technology & AI Practices, Adani AI Labs, Ahmedabad"
    p_g2.font.size = Pt(14)
    p_g2.font.color.rgb = CHARCOAL

    # Shape 2: Student Info (Bottom Left)
    s1.shapes[2].left = Inches(0.5)
    s1.shapes[2].top = Inches(3.60)
    s1.shapes[2].width = Inches(4.7)
    s1.shapes[2].height = Inches(1.4)
    s1.shapes[2].text_frame.clear()
    
    p_sdp = s1.shapes[2].text_frame.paragraphs[0]
    p_sdp.text = "SDP Id: CAPSTONE - 4001"
    p_sdp.font.bold = True
    p_sdp.font.size = Pt(15)
    p_sdp.font.color.rgb = DARK_BLUE
    p_sdp.space_after = Pt(2)

    p_stu = s1.shapes[2].text_frame.add_paragraph()
    p_stu.text = "Candidate: Frank Mathew Sajan (23BCE8713)"
    p_stu.font.bold = True
    p_stu.font.size = Pt(14)
    p_stu.font.color.rgb = CHARCOAL

    p_prog = s1.shapes[2].text_frame.add_paragraph()
    p_prog.text = "B.Tech Computer Science and Engineering (AIML)"
    p_prog.font.size = Pt(14)
    p_prog.font.color.rgb = CHARCOAL

    # Shape 3: University Info (Bottom Right)
    s1.shapes[3].left = Inches(5.3)
    s1.shapes[3].top = Inches(3.60)
    s1.shapes[3].width = Inches(4.4)
    s1.shapes[3].height = Inches(1.4)
    s1.shapes[3].text_frame.clear()
    
    p_sc = s1.shapes[3].text_frame.paragraphs[0]
    p_sc.text = "School of Computer Science and Engineering"
    p_sc.font.bold = True
    p_sc.font.size = Pt(15)
    p_sc.font.color.rgb = DARK_BLUE
    p_sc.space_after = Pt(2)

    p_uni = s1.shapes[3].text_frame.add_paragraph()
    p_uni.text = "VIT-AP University, Amaravati -- 522237, Andhra Pradesh"
    p_uni.font.size = Pt(14)
    p_uni.font.color.rgb = CHARCOAL

    # LOGOS ON SLIDE 1 (Strict diagonal scaling, zero stretching)
    # Adani Logo (clean PNG, aspect ratio 2.554)
    adani_logo_path = os.path.join(figures_dir, "adani_logo_clean.png")
    if os.path.exists(adani_logo_path):
        # width = 1.30 in, height = 1.30 / 2.554 = 0.509 in
        s1.shapes.add_picture(adani_logo_path, Inches(6.60), Inches(0.20), width=Inches(1.30), height=Inches(0.509))

    # VIT-AP Logo (aspect ratio 3.231)
    vit_logo_path = os.path.join(figures_dir, "vit_logo.jpeg")
    if os.path.exists(vit_logo_path):
        # width = 1.65 in, height = 1.65 / 3.231 = 0.511 in
        s1.shapes.add_picture(vit_logo_path, Inches(8.05), Inches(0.20), width=Inches(1.65), height=Inches(0.511))

    # =========================================================================
    # SLIDE 2: PRESENTATION OUTLINE
    # =========================================================================
    s2 = prs.slides[1]
    style_header(s2, "Presentation Outline")
    s2.shapes[1].left = Inches(0.6)
    s2.shapes[1].top = Inches(1.10)
    s2.shapes[1].width = Inches(8.8)
    s2.shapes[1].height = Inches(4.0)
    add_bullets_to_frame(s2.shapes[1].text_frame, [
        ("1. Introduction:", "National Mandate, Lot Sampling Blind Spot & Specific Research Objectives"),
        ("2. Background & Related Work:", "Prevailing AMR Limitations & Two-Tier Synchronization Engineering"),
        ("3. System Architecture:", "Hybrid Edge-Cloud Topology, Local SQLite SSOT & Evolutionary Pivot"),
        ("4. Operational Workflows:", "Field Mobile Verification HUD, Polygon Cropper & Central Admin Intelligence"),
        ("5. Empirical Benchmarks:", "Edge Latency, INT8 Safety Lockout, 7-Segment OCR Ablation & Cloud VLM QC"),
        ("6. Summary & Impact:", "Core Findings, Operational Limitations, Future Roadmap & References")
    ], space_after=10, show_bullet=False)

    # =========================================================================
    # SLIDE 3: INTRODUCTION - PROJECT OVERVIEW
    # =========================================================================
    s3 = prs.slides[2]
    style_header(s3, "Introduction: Smart Meter Quality Assurance")
    fill_content_box(s3.shapes[1], [
        ("National Mandate:", "Under India's RDSS scheme, electric utilities are deploying over 250 million smart meters to curtail AT&C commercial losses."),
        ("Operational Risk:", "Contractor mounting errors cause severe terminal burnouts, unmetered power bypasses, and hazardous phase connections."),
        ("Physical Dead Zones:", "20% to 25% of meters reside in subterranean basements and shielded shafts with legacy 2G/EDGE cellular dead zones."),
        ("Core Innovation:", "Novo provides an offline-first, safety-gated hybrid edge-cloud verification framework that scales audits from 10% sampling to 100% enforcement."),
        ("Key Deliverables:", "24.34 ms on-device wire safety lockout + zero silent OCR misreads + deterministic 1.14 s 2G cellular sync.")
    ], space_after=8)

    # =========================================================================
    # SLIDE 4: INTRODUCTION - PROBLEM STATEMENT & MOTIVATIONS
    # =========================================================================
    s4 = prs.slides[3]
    style_header(s4, "Introduction: Problem Statement & Motivations")
    fill_content_box(s4.shapes[1], [
        ("Lot Sampling Blind Spot:", "IS 2500 & REC TPQMA guidelines audit only 10% to 20% of meters; 80% to 90% of field mountings remain completely uninspected."),
        ("Terminal Burnout Threat:", "Loose terminal screws and exposed wires cause >30% of field meltdowns due to localized I^2 R contact resistance heating."),
        ("Sealing & Logging Errors:", "Missing seals in 4% to 8% of setups; manual OCR exhibits a 4% to 7% human transcription error rate."),
        ("Bandwidth Disconnect:", "Subterranean RF attenuation causes multi-MB image uploads to fail with persistent socket timeouts in field operations."),
        ("Remediation Cost Penalty:", "Post-hoc supervisory audits occur weeks after handover, shifting repair expenses entirely to DISCOMs.")
    ], space_after=8)

    # =========================================================================
    # SLIDE 5: INTRODUCTION - OBJECTIVES & EXPECTED IMPACT
    # =========================================================================
    s5 = prs.slides[4]
    style_header(s5, "Introduction: Research Objectives & Scope")
    fill_content_box(s5.shapes[1], [
        ("1. Prevent Terminal Burnouts:", "Enforce a <30 ms on-device visual safety interlock blocking hazardous wiring submissions at point-of-work."),
        ("2. Standardize Camera Pose:", "Lock shutter via 3-axis MEMS accelerometer leveling (90 deg +/- 10 deg) to eliminate perspective keystone and solar glare."),
        ("3. Eliminate Silent Misreads:", "Achieve 0.0% silent hallucinations via a sim-to-real 7-segment digit recognition and character sanitization automaton."),
        ("4. Instant Zero-Delay Field UX:", "Provide <250 ms shutter response pushing directly to an Intermediary Verification Screen for rapid technician sign-off."),
        ("5. Guarantee 2G Sync Reliability:", "Implement an embedded SQLite WAL SSOT dispatching sub-2 KB Tier-1 JSON telemetry in 1.14 s across dead zones."),
        ("6. Cloud Multimodal Auditing:", "Execute asynchronous 4-point physical QC checks (wire safety, cover, seal, casing) via multimodal Gemini foundation models.")
    ], space_after=7)

    # =========================================================================
    # SLIDE 6: BACKGROUND & RELATED WORK - LIMITATIONS
    # =========================================================================
    s6 = prs.slides[5]
    style_header(s6, "Background: AMR Limitations & Literature Gaps")
    fill_content_box(s6.shapes[1], [
        ("Unconstrained Cloud AMR:", "Prior works (Laroca et al., Salomon et al.) mandate synchronous multi-MB image streaming, failing in shielded electrical shafts."),
        ("Dedicated Rugged Handhelds:", "Custom utility hardware is cost-prohibitive (>Rs. 45,000/device), preventing universal contractor adoption across mass rollouts."),
        ("Sim-to-Real Domain Gap:", "Synthetic OCR models misread scratched 7-segment displays without alert, introducing silent whole-number billing errors."),
        ("Post-Hoc Supervisory Audits:", "Dispatched weeks after commissioning, shifting remediation costs entirely to utilities rather than enforcing contractor accountability."),
        ("Absence of Physical Safety Interlocks:", "Prevailing AMR systems digitize readings but completely ignore fatal exposed wiring and terminal burnout hazards.")
    ], space_after=8)

    # =========================================================================
    # SLIDE 7: BACKGROUND & RELATED WORK - IMPROVEMENTS
    # =========================================================================
    s7 = prs.slides[6]
    style_header(s7, "Engineering Evolution: On-Device Edge Pivot")
    fill_split_slide(s7, s7.shapes[1], [
        ("Evolutionary Pivot:", "Transitioned from heavy YOLOv8 ONNX WASM (1,240 ms, 38.6 MB RAM) to native INT8 MobileNetV3."),
        ("Zero-Cost Safety Gate:", "Instant 24.34 ms on-device safety interlock triggers an automated submission lockout upon detecting exposed wiring."),
        ("Active MEMS Interlock:", "Shutter locked outside 90 deg +/- 10 deg normal to eliminate perspective distortion and specular glare."),
        ("Two-Tier Decoupled Sync:", "1.82 KB Tier-1 JSON dispatches in 1.14 s; high-res audit photos deferred to depot Wi-Fi."),
        ("99.12% OPEX Reduction:", "Replaced always-on cloud GPU clusters (Rs. 77,132/mo) with edge-gated serverless APIs (Rs. 675/mo).")
    ], os.path.join(figures_dir, "sync_throughput_comparison.png"),
       caption="Fig 1: Cellular Sync Throughput Comparison across 2G/EDGE")

    # =========================================================================
    # SLIDE 8: PROPOSED SOLUTION - SYSTEM ARCHITECTURE
    # =========================================================================
    s8 = prs.slides[7]
    style_header(s8, "Proposed System: End-to-End Architecture")
    fill_split_slide(s8, s8.shapes[1], [
        ("Tier 1 (Edge Handset):", "Camera Viewfinder with MEMS leveling, onLayout LCD reticle, and INT8 wire safety classification."),
        ("Tier 2 (Verification HUD):", "Intermediary sign-off screen + CamScanner 4-point polygon cropper with 2.8x loupe and 2x zoom."),
        ("Tier 3 (Local SQLite WAL):", "Crash-resilient SSOT database with startup recovery pragmas resetting orphaned sync states."),
        ("Tier 4 (FastAPI Cloud Gateway):", "High-throughput ASGI gateway computing SHA-256 evidence seals and 17-column compliance exports."),
        ("Tier 5 (Cloud VLM Auditor):", "Google Gemini 3.8 Flash performing secondary 4-point physical QC verification asynchronously.")
    ], os.path.join(figures_dir, "system_architecture.png"),
       caption="Fig 2: Hybrid Edge-Cloud Modular System Architecture")

    # =========================================================================
    # SLIDE 9: PROPOSED SOLUTION - KEY MODULES & FIELD APP UI
    # =========================================================================
    s9 = prs.slides[8]
    style_header(s9, "Field Mobile Client: Technician Verification HUD")
    app_img1 = os.path.join(figures_dir, "app_screens", "app_verification_screen.jpeg")
    app_img2 = os.path.join(figures_dir, "app_screens", "app_directive_alert.jpeg")
    fill_dual_phone_slide(s9, s9.shapes[1], [
        ("Dynamic Viewfinder:", "Accelerometer leveling interlock (90 deg +/- 10 deg) + onLayout LCD bounding reticle."),
        ("INT8 Wire Safety Gate:", "1.24 MB MobileNetV3 (24.34 ms) blocks hazardous wiring submissions directly at point-of-work."),
        ("Sim-to-Real Digit Recognizer:", "Google ML Kit + 7-segment character automaton + height-ratio decimal recovery."),
        ("Precision Polygon Cropper:", "4-point selector with 2.8x floating loupe tracking 85 px above finger and 2x canvas zoom."),
        ("Real-Time Push Directives:", "WebSocket alerts with instant one-touch technician ACK telemetry and field notes.")
    ], app_img1, app_img2, caption="Fig 3: Point-of-Work Verification Screen (Left) & Supervisor Directive Alert (Right)")

    # =========================================================================
    # SLIDE 10: PROPOSED SOLUTION - CENTRAL ADMIN & FLEET CONSOLE
    # =========================================================================
    s10 = prs.slides[9]
    style_header(s10, "Central Admin Dashboard & Fleet Operations")
    admin_showcase_img = os.path.join(figures_dir, "admin_panel", "admin_composite_showcase.png")
    if not os.path.exists(admin_showcase_img):
        admin_showcase_img = os.path.join(figures_dir, "admin_panel", "admin_inspections_feed.png")
        
    fill_split_slide(s10, s10.shapes[1], [
        ("Live Ingestion Stream:", "20 synchronized meter audits with timestamped SHA-256 evidence seals and technician attribution."),
        ("Dual-Stream Reconciliation:", "Instant comparison of on-device Edge OCR readings against secondary Cloud VLM verdicts."),
        ("Interactive GIS Fleet Map:", "2D Leaflet and 3D Mapbox GL vertical floor tracking (L0 Yard, L1 Switch, L2 Lab, L3 Roof)."),
        ("Directives Dispatch Modal:", "Real-time broadcast and device-targeted safety alerts with ACK telemetry and field remediation notes."),
        ("Disaster Recovery Sync-Back:", "Instant cloud restore of historical audits upon handset loss or hardware replacement.")
    ], admin_showcase_img, caption="Fig 4: Central Admin Dashboard & Directives Dispatch Modal")

    # =========================================================================
    # SLIDE 11: IMPLEMENTATION & RESULTS - DATASETS & EVALUATION
    # =========================================================================
    s11 = prs.slides[10]
    style_header(s11, "Experimental Results: Testbed & Confusion Matrix")
    fill_split_slide(s11, s11.shapes[1], [
        ("Curated Master Dataset:", "3,220 field photographs across authentic Indian operational and ambient lighting conditions."),
        ("OEM Meter Diversity:", "Salzer, Genus Smart, Secure Premier 300, HPL Single Phase, and L&T AMI smart meters."),
        ("Hazard Partition:", "1,420 annotated hazardous mountings (stripped copper, loose screws, unseated covers)."),
        ("Compliant Partition:", "1,800 compliant installations verified against IS 16444 specifications."),
        ("Evaluation Handset:", "Low-cost Xiaomi Redmi 12 (MediaTek Helio G88, 4 GB RAM, Android 14).")
    ], os.path.join(figures_dir, "hazard_classification_matrix.png"),
       caption="Fig 5: Wire Safety Confusion Matrix on Test Partition")

    # =========================================================================
    # SLIDE 12: IMPLEMENTATION & RESULTS - PARAMETERS TABLE
    # =========================================================================
    s12 = prs.slides[11]
    style_header(s12, "Experimental Results: Calibrated System Parameters")
    
    # Reposition and clear text shape 1
    s12.shapes[1].text_frame.clear()
    s12.shapes[1].left = Inches(0.6)
    s12.shapes[1].top = Inches(0.95)
    s12.shapes[1].width = Inches(8.8)
    s12.shapes[1].height = Inches(0.1)

    table_headers = ["Subsystem / Interlock", "Calibrated Threshold", "Technical Rationale & Safety Enforcement"]
    table_rows = [
        ["Viewfinder MEMS Interlock", "90 deg +/- 10 deg normal", "Eliminates severe perspective keystone distortion prior to OCR segmentation."],
        ["Wire Safety Classifier", "P_hazard >= 0.65", "1.24 MB MobileNetV3 enforces un-dismissible lock on exposed copper/loose screws."],
        ["Decimal Height Boundary", "r = h_dot / h_digit < 0.82", "Distinguishes decimal dots from noise; prevents false whole-number decimal shifts."],
        ["Cloud VLM Reconciliation", "|Delta kWh| <= 1.0 kWh", "Gemini 3.8 Flash audits edge OCR reading against high-res photo; detects tampering."],
        ["Tier-1 Sync Buffer", "15 records (~1.82 KB)", "Minified JSON array guarantees deterministic 1.14 s dispatch over 2G/EDGE networks."],
        ["Telemetry Heartbeat", "30 s / 246 bytes pkt", "Real-time supervisor dispatch tracking; draws <236 KB across an 8-hour field shift."]
    ]
    create_styled_table(s12, Inches(0.6), Inches(1.15), Inches(8.8), Inches(3.80), table_headers, table_rows, [Inches(2.3), Inches(1.9), Inches(4.6)])

    # =========================================================================
    # SLIDE 13: IMPLEMENTATION & RESULTS - EXPERIMENTAL OUTCOMES
    # =========================================================================
    s13 = prs.slides[12]
    style_header(s13, "Experimental Results: Performance & Latency Benchmark")
    fill_split_slide(s13, s13.shapes[1], [
        ("Edge Latency:", "24.34 ms execution (10.2x margin under 250 ms SLA; 50.9x faster than ONNX WASM)."),
        ("Memory Footprint:", "4.59 MB peak heap RAM (7.6x under 35 MB ceiling; 8.4x reduction vs WASM runtime)."),
        ("Hazard Lockout:", "100.0% lockout enforcement on 1,420 hazardous cases (zero false negatives)."),
        ("OCR Accuracy:", "CER slashed from 24.8% to 1.2% with 0.0% silent whole-number hallucinations."),
        ("2G Sync Reliability:", "100.0% in 1.14 s (vs 13.3% completion for conventional multi-MB uploads)."),
        ("Cloud Multimodal QC:", "97.98% overall precision on seals, covers, and physical casing integrity.")
    ], os.path.join(figures_dir, "latency_memory_benchmark.png"),
       caption="Fig 6: Edge Latency & Heap Memory Benchmark Across Hardware Tiers")

    # =========================================================================
    # SLIDE 14: SUMMARY - FINDINGS, LIMITATIONS & FUTURE
    # =========================================================================
    s14 = prs.slides[13]
    style_header(s14, "Summary & Conclusions: Key Findings & Future Work")
    
    tf14 = s14.shapes[1].text_frame
    tf14.clear()
    s14.shapes[1].left = Inches(0.6)
    s14.shapes[1].top = Inches(1.10)
    s14.shapes[1].width = Inches(8.8)
    s14.shapes[1].height = Inches(4.0)
    
    # Key Findings
    p_kf_t = tf14.paragraphs[0]
    clear_bullet_formatting(p_kf_t)
    p_kf_t.text = "Key Findings & Production Impact"
    p_kf_t.font.bold = True
    p_kf_t.font.size = Pt(16)
    p_kf_t.font.color.rgb = DARK_BLUE
    p_kf_t.space_after = Pt(2)

    for bullet in [
        "Eliminates the 30% terminal burnout failure mode directly at the point of work via on-device hazard lockout.",
        "Scales inspection coverage from 10-20% lot sampling to 100% automated enforcement with a 99.12% cloud OPEX reduction."
    ]:
        p = tf14.add_paragraph()
        clear_bullet_formatting(p)
        rb = p.add_run()
        rb.text = "\u2022  "
        rb.font.bold = True
        rb.font.size = Pt(14)
        rb.font.color.rgb = ACCENT_BLUE
        r = p.add_run()
        r.text = bullet
        r.font.size = Pt(14)
        r.font.color.rgb = CHARCOAL
        p.space_after = Pt(4)

    # Limitations
    p_lim_t = tf14.add_paragraph()
    clear_bullet_formatting(p_lim_t)
    p_lim_t.text = "Operational Limitations"
    p_lim_t.font.bold = True
    p_lim_t.font.size = Pt(16)
    p_lim_t.font.color.rgb = DARK_BLUE
    p_lim_t.space_before = Pt(6)
    p_lim_t.space_after = Pt(2)

    for bullet in [
        "Optical OCR requires minimum ambient illumination (>= 25 lux); heavily scratched or weathered lenses require manual sign-off."
    ]:
        p = tf14.add_paragraph()
        clear_bullet_formatting(p)
        rb = p.add_run()
        rb.text = "\u2022  "
        rb.font.bold = True
        rb.font.size = Pt(14)
        rb.font.color.rgb = ACCENT_BLUE
        r = p.add_run()
        r.text = bullet
        r.font.size = Pt(14)
        r.font.color.rgb = CHARCOAL
        p.space_after = Pt(4)

    # Future Directions
    p_fut_t = tf14.add_paragraph()
    clear_bullet_formatting(p_fut_t)
    p_fut_t.text = "Future Engineering Directions"
    p_fut_t.font.bold = True
    p_fut_t.font.size = Pt(16)
    p_fut_t.font.color.rgb = DARK_BLUE
    p_fut_t.space_before = Pt(6)
    p_fut_t.space_after = Pt(2)

    for bullet in [
        "Thermal Bolometer Fusion: Smartphone LWIR sensor fusion to detect I^2 R contact resistance heating in real time.",
        "On-Device SLM Distillation: Distilling Gemini multimodal audits into quantized on-device SmolVLM/PaliGemma weights."
    ]:
        p = tf14.add_paragraph()
        clear_bullet_formatting(p)
        rb = p.add_run()
        rb.text = "\u2022  "
        rb.font.bold = True
        rb.font.size = Pt(14)
        rb.font.color.rgb = ACCENT_BLUE
        r = p.add_run()
        r.text = bullet
        r.font.size = Pt(14)
        r.font.color.rgb = CHARCOAL
        p.space_after = Pt(3)

    # =========================================================================
    # SLIDE 15: BIBLIOGRAPHY
    # =========================================================================
    s15 = prs.slides[14]
    style_header(s15, "Bibliography: Academic & Standard References")

    tf15 = s15.shapes[1].text_frame
    tf15.clear()
    s15.shapes[1].left = Inches(0.6)
    s15.shapes[1].top = Inches(1.10)
    s15.shapes[1].width = Inches(8.8)
    s15.shapes[1].height = Inches(4.0)
    
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
    clear_bullet_formatting(p_init)
    p_init.text = refs[0]
    p_init.font.size = Pt(13)
    p_init.font.color.rgb = CHARCOAL
    p_init.space_after = Pt(5)
    for r in refs[1:]:
        p = tf15.add_paragraph()
        clear_bullet_formatting(p)
        p.text = r
        p.font.size = Pt(13)
        p.font.color.rgb = CHARCOAL
        p.space_after = Pt(5)

    # =========================================================================
    # SLIDE 16: CONCLUDING SLIDE
    # =========================================================================
    s16 = prs.slides[15]
    
    # Top Title text box (strictly inside upper bounds)
    s16.shapes[0].left = Inches(0.5)
    s16.shapes[0].top = Inches(0.35)
    s16.shapes[0].width = Inches(9.0)
    s16.shapes[0].height = Inches(1.10)
    tf16 = s16.shapes[0].text_frame
    tf16.clear()
    
    p_end_title = tf16.paragraphs[0]
    p_end_title.text = "Thank You!"
    p_end_title.font.bold = True
    p_end_title.font.size = Pt(30)
    p_end_title.font.color.rgb = DARK_BLUE
    p_end_title.alignment = PP_ALIGN.CENTER
    p_end_title.space_after = Pt(2)

    p_end_sub = tf16.add_paragraph()
    p_end_sub.text = "Questions & Technical Discussion"
    p_end_sub.font.bold = True
    p_end_sub.font.size = Pt(18)
    p_end_sub.font.color.rgb = ACCENT_BLUE
    p_end_sub.alignment = PP_ALIGN.CENTER

    # Middle Calligraphy picture (Shape 2) - centered
    if len(s16.shapes) > 2 and s16.shapes[2].shape_type == 13:  # PICTURE
        s16.shapes[2].left = Inches(2.70)
        s16.shapes[2].top = Inches(1.55)
        s16.shapes[2].width = Inches(4.60)
        s16.shapes[2].height = Inches(1.65)

    # Bottom Candidate and Guide information in dedicated bottom text box
    tb_bottom = s16.shapes.add_textbox(Inches(0.5), Inches(3.35), Inches(9.0), Inches(1.70))
    tb_bottom.text_frame.word_wrap = True
    tf_b = tb_bottom.text_frame
    tf_b.clear()
    
    p_c1 = tf_b.paragraphs[0]
    p_c1.text = "Candidate: Frank Mathew Sajan (Registration No: 23BCE8713)"
    p_c1.font.bold = True
    p_c1.font.size = Pt(14)
    p_c1.font.color.rgb = CHARCOAL
    p_c1.alignment = PP_ALIGN.CENTER

    p_c2 = tf_b.add_paragraph()
    p_c2.text = "B.Tech Computer Science and Engineering (AIML) | SCOPE, VIT-AP University"
    p_c2.font.size = Pt(13)
    p_c2.font.color.rgb = CHARCOAL
    p_c2.alignment = PP_ALIGN.CENTER
    p_c2.space_after = Pt(3)

    p_g_acad = tf_b.add_paragraph()
    p_g_acad.text = "Internal Academic Guide: Dr. Sibi Chakkaravarthy S, SCOPE, VIT-AP University"
    p_g_acad.font.bold = True
    p_g_acad.font.size = Pt(13)
    p_g_acad.font.color.rgb = DARK_BLUE
    p_g_acad.alignment = PP_ALIGN.CENTER

    p_g_ind = tf_b.add_paragraph()
    p_g_ind.text = "External Industry Guide: Mr. Gowrav Shekar, Head of Technology & AI Practices, Adani AI Labs"
    p_g_ind.font.bold = True
    p_g_ind.font.size = Pt(13)
    p_g_ind.font.color.rgb = DARK_BLUE
    p_g_ind.alignment = PP_ALIGN.CENTER

    prs.save(output_path)
    print(f"Successfully generated {output_path} ({os.path.getsize(output_path)} bytes)")

if __name__ == "__main__":
    populate_presentation()
