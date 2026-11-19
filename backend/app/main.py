# app/main.py
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.core.database import Base, engine
import app.models.device  # noqa: F401
import app.models.inspection  # noqa: F401
import app.models.message  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Render & cold restart safe: ensure directories exist
    os.makedirs(settings.STORAGE_DIR, exist_ok=True)
    os.makedirs(settings.BASE_DIR / "storage", exist_ok=True)
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

storage_dir = settings.BASE_DIR / "storage"
os.makedirs(storage_dir, exist_ok=True)
app.mount("/storage", StaticFiles(directory=storage_dir), name="storage")

app.include_router(api_router, prefix=settings.API_V1_STR)

# ---------------------------------------------------------------------------
# Live Web Admin Dashboard (Inspections, Live Fleet Map, Directives)
# Minimal, Calm Monochrome Technical UI with Clean Typography
# ---------------------------------------------------------------------------
ADMIN_HTML = r"""<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo Admin &bull; Inspections & Fleet</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js"></script>
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css" rel="stylesheet" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body {
      background-color: #090a0d;
      color: #d4d4d8;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }
    .leaflet-popup-content-wrapper {
      background: #0e1014 !important;
      color: #e4e4e7 !important;
      border: 1px solid #27272a !important;
      border-radius: 6px !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6) !important;
    }
    .leaflet-popup-tip {
      background: #0e1014 !important;
    }
    .wireframe-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      grid-template-rows: repeat(5, 1fr);
      width: 100%;
      height: 100%;
    }
    .wireframe-cell {
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      border-left: 1px solid rgba(255, 255, 255, 0.03);
    }
    ::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: #27272a;
      border-radius: 2px;
    }

    /* ======================================================================= */
    /* CALM, MINIMAL LIGHT MODE                                                */
    /* ======================================================================= */
    html.light body {
      background-color: #f8fafc;
      color: #1e293b;
    }
    html.light #boot-overlay {
      background-color: #f8fafc;
      color: #334155;
    }
    html.light .wireframe-cell {
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      border-left: 1px solid rgba(0, 0, 0, 0.05);
    }
    html.light .bg-\[\#0e1014\] {
      background-color: #ffffff !important;
      border-color: #e2e8f0 !important;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.03);
    }
    html.light .bg-\[\#090a0d\] {
      background-color: #f1f5f9 !important;
      border-color: #e2e8f0 !important;
    }
    html.light .border-zinc-800,
    html.light .border-zinc-800\/60,
    html.light .border-zinc-800\/40,
    html.light .border-zinc-800\/80,
    html.light .divide-zinc-800\/40 {
      border-color: #e2e8f0 !important;
    }
    html.light .text-zinc-100 { color: #0f172a !important; }
    html.light .text-zinc-200 { color: #1e293b !important; }
    html.light .text-zinc-300 { color: #334155 !important; }
    html.light .text-zinc-400 { color: #475569 !important; }
    html.light .text-zinc-500 { color: #64748b !important; }
    html.light .text-zinc-600 { color: #94a3b8 !important; }
    html.light .bg-zinc-900 { background-color: #f1f5f9 !important; }
    html.light .bg-zinc-800 { background-color: #e2e8f0 !important; }
    html.light .hover\:bg-zinc-800:hover { background-color: #e2e8f0 !important; }
    html.light tr.hover\:bg-\[\#13161c\]:hover { background-color: #f8fafc !important; }
    html.light input, html.light select, html.light textarea {
      background-color: #ffffff !important;
      color: #0f172a !important;
      border-color: #cbd5e1 !important;
    }
    html.light #detail-modal > div,
    html.light #directive-modal > div,
    html.light #export-menu {
      background-color: #ffffff !important;
      border-color: #e2e8f0 !important;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05) !important;
    }
    html.light .leaflet-popup-content-wrapper {
      background: #ffffff !important;
      color: #0f172a !important;
      border: 1px solid #e2e8f0 !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08) !important;
    }
    html.light .leaflet-popup-tip {
      background: #ffffff !important;
    }

    /* Mapbox 3D Styling */
    .mapboxgl-popup-content {
      background: #0e1014 !important;
      color: #e4e4e7 !important;
      border: 1px solid #27272a !important;
      border-radius: 6px !important;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.7) !important;
      padding: 10px !important;
    }
    .mapboxgl-popup-tip {
      border-top-color: #0e1014 !important;
      border-bottom-color: #0e1014 !important;
    }
    html.light .mapboxgl-popup-content {
      background: #ffffff !important;
      color: #0f172a !important;
      border: 1px solid #e2e8f0 !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1) !important;
    }
    html.light .mapboxgl-popup-tip {
      border-top-color: #ffffff !important;
      border-bottom-color: #ffffff !important;
    }

    /* Slate Theme */
    html.slate body {
      background-color: #0f172a !important;
    }
    html.slate .bg-\[\#090a0d\] {
      background-color: #0f172a !important;
    }
    html.slate .bg-\[\#0e1014\] {
      background-color: #1e293b !important;
    }
    html.slate .bg-\[\#13161c\] {
      background-color: #334155 !important;
    }
    html.slate .border-zinc-800\/60, html.slate .border-zinc-800\/80, html.slate .border-zinc-800\/40 {
      border-color: #334155 !important;
    }
    html.slate .mapboxgl-popup-content {
      background: #1e293b !important;
      border-color: #334155 !important;
    }
    html.slate .mapboxgl-popup-tip {
      border-top-color: #1e293b !important;
      border-bottom-color: #1e293b !important;
    }
  </style>
</head>
<body class="bg-[#090a0d] text-zinc-300 antialiased min-h-screen">

  <!-- ========================================================================= -->
  <!-- MAIN CONSOLE (RESPONSIVE FULL-WIDTH)                                      -->
  <!-- ========================================================================= -->
  <div class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    
    <!-- HEADER -->
    <header class="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-zinc-800/60">
      <div class="flex items-center gap-3">
        <div class="w-2.5 h-2.5 rounded-sm bg-zinc-400"></div>
        <h1 class="text-base font-semibold text-zinc-100 tracking-tight">Novo Admin</h1>
      </div>

      <div class="flex items-center gap-2 text-xs">
        <!-- EXPORT AUDIT DROPDOWN -->
        <div class="relative inline-block text-left">
          <button onclick="toggleExportMenu(event)" id="export-btn" class="px-2.5 py-1 text-xs text-zinc-300 hover:text-zinc-100 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded transition flex items-center gap-1.5">
            <span>Export Audit</span>
            <span class="text-[10px] text-zinc-500">&darr;</span>
          </button>
          <div id="export-menu" class="hidden absolute right-0 mt-1.5 w-64 bg-[#0e1014] border border-zinc-800 rounded shadow-2xl py-1 z-30 font-mono text-xs">
            <div class="px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-800/60 font-semibold">
              DISCOM Audit Artifacts
            </div>
            <a href="/api/v1/inspections/report?format=print" target="_blank" onclick="closeExportMenu()" class="block px-3 py-2 text-zinc-200 hover:bg-zinc-800 transition">
              <div class="font-medium text-xs text-zinc-100">CEA Audit Report (PDF / Print)</div>
              <div class="text-[10px] text-zinc-400 font-sans mt-0.5">Government certificate with photos, QC scorecards & SHA-256 seals</div>
            </a>
            <a href="/api/v1/inspections/export.csv" download="DISCOM_Installation_QC_Audit.csv" onclick="closeExportMenu()" class="block px-3 py-2 text-zinc-200 hover:bg-zinc-800 transition border-t border-zinc-800/40">
              <div class="font-medium text-xs text-zinc-100">DISCOM Data Sheet (CSV)</div>
              <div class="text-[10px] text-zinc-400 font-sans mt-0.5">Raw telemetry records for ERP, analytics & spreadsheet ingestion</div>
            </a>
          </div>
        </div>

        <!-- THEME SWITCHER -->
        <button id="theme-btn" onclick="toggleTheme()" class="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 hover:border-zinc-700 rounded transition" title="Toggle theme">
          Theme: Dark
        </button>

        <button onclick="refreshAll()" class="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 hover:border-zinc-700 rounded transition">
          Refresh
        </button>
        <button onclick="confirmResetData()" class="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded transition font-medium" title="Clear test records">
          Reset
        </button>
      </div>
    </header>

    <!-- TABS NAVIGATION -->
    <div class="flex border-b border-zinc-800/60 mt-4 mb-6 gap-4 text-xs font-medium">
      <button onclick="switchTab('inspections')" id="tab-btn-inspections" class="tab-btn pb-2.5 border-b-2 border-zinc-200 text-zinc-100 transition">
        Inspections
      </button>
      <button onclick="switchTab('fleet')" id="tab-btn-fleet" class="tab-btn pb-2.5 border-b-2 border-transparent text-zinc-500 hover:text-zinc-300 transition">
        Fleet (<span id="fleet-online-badge">0</span>)
      </button>
      <button onclick="switchTab('directives')" id="tab-btn-directives" class="tab-btn pb-2.5 border-b-2 border-transparent text-zinc-500 hover:text-zinc-300 transition">
        Directives (<span id="unread-ack-badge">0</span>)
      </button>
    </div>

    <!-- TAB 1: INSPECTIONS -->
    <div id="tab-inspections">
      <!-- STAT COUNTERS (RESPONSIVE) -->
      <section class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-5">
        <div class="bg-[#0e1014] p-3 rounded border border-zinc-800/60">
          <div class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Total</div>
          <div id="stat-total" class="text-xl font-mono font-semibold text-zinc-100 mt-1">0</div>
        </div>
        <div class="bg-[#0e1014] p-3 rounded border border-zinc-800/60">
          <div class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Pass</div>
          <div id="stat-pass" class="text-xl font-mono font-semibold text-zinc-100 mt-1">0</div>
        </div>
        <div class="bg-[#0e1014] p-3 rounded border border-zinc-800/60">
          <div class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Verified</div>
          <div id="stat-vlm" class="text-xl font-mono font-semibold text-zinc-100 mt-1">0</div>
        </div>
        <div class="bg-[#0e1014] p-3 rounded border border-zinc-800/60">
          <div class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Warning</div>
          <div id="stat-warn" class="text-xl font-mono font-semibold text-zinc-100 mt-1">0</div>
        </div>
        <div class="bg-[#0e1014] p-3 rounded border border-zinc-800/60">
          <div class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Hazard</div>
          <div id="stat-crit" class="text-xl font-mono font-semibold text-zinc-100 mt-1">0</div>
        </div>
      </section>

      <!-- SEARCH & FILTER BAR -->
      <div class="flex flex-col sm:flex-row gap-2.5 mb-4 items-center justify-between text-xs">
        <div class="flex gap-2 w-full sm:w-auto">
          <input id="search-input" type="text" placeholder="Search..." oninput="renderTable()"
            class="w-full sm:w-60 px-2.5 py-1.5 bg-[#0e1014] border border-zinc-800 rounded focus:outline-none focus:border-zinc-600 text-zinc-200 placeholder-zinc-600 font-mono text-xs">
          <select id="tech-filter" onchange="renderTable()" class="px-2.5 py-1.5 bg-[#0e1014] border border-zinc-800 rounded focus:outline-none text-zinc-400 text-xs">
            <option value="ALL">All Techs</option>
          </select>
        </div>
        
        <div class="flex items-center gap-1 self-start sm:self-auto">
          <button onclick="setFilter('ALL')" id="filter-ALL" class="filter-btn px-2.5 py-1 text-xs rounded bg-zinc-800 text-zinc-100 transition">All</button>
          <button onclick="setFilter('PASS')" id="filter-PASS" class="filter-btn px-2.5 py-1 text-xs rounded text-zinc-500 hover:text-zinc-300 transition">Pass</button>
          <button onclick="setFilter('VLM_VERIFIED')" id="filter-VLM_VERIFIED" class="filter-btn px-2.5 py-1 text-xs rounded text-zinc-500 hover:text-zinc-300 transition">Verified</button>
          <button onclick="setFilter('WARNING')" id="filter-WARNING" class="filter-btn px-2.5 py-1 text-xs rounded text-zinc-500 hover:text-zinc-300 transition">Warning</button>
          <button onclick="setFilter('CRITICAL_HAZARD')" id="filter-CRITICAL_HAZARD" class="filter-btn px-2.5 py-1 text-xs rounded text-zinc-500 hover:text-zinc-300 transition">Hazard</button>
        </div>
      </div>

      <!-- TABLE -->
      <div class="bg-[#0e1014] rounded border border-zinc-800/60 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-zinc-800/60 text-zinc-500 font-mono text-[11px] uppercase tracking-wider">
                <th class="p-2.5 w-12">Photo</th>
                <th class="p-2.5">Meter</th>
                <th class="p-2.5">Edge</th>
                <th class="p-2.5">Cloud VLM</th>
                <th class="p-2.5">Audit</th>
                <th class="p-2.5">Status</th>
                <th class="p-2.5">Tech</th>
                <th class="p-2.5">Time</th>
                <th class="p-2.5 text-right"></th>
              </tr>
            </thead>
            <tbody id="table-body" class="divide-y divide-zinc-800/40">
              <tr><td colspan="9" class="p-6 text-center text-zinc-600 font-mono text-xs">Loading records...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 2: FLEET MAP -->
    <div id="tab-fleet" class="hidden">
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div class="bg-[#0e1014] p-3 rounded border border-zinc-800/60">
          <div class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Devices</div>
          <div id="fleet-stat-total" class="text-xl font-mono font-semibold text-zinc-100 mt-1">0</div>
        </div>
        <div class="bg-[#0e1014] p-3 rounded border border-zinc-800/60">
          <div class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Online</div>
          <div id="fleet-stat-online" class="text-xl font-mono font-semibold text-zinc-100 mt-1">0</div>
        </div>
        <div class="bg-[#0e1014] p-3 rounded border border-zinc-800/60">
          <div class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Technicians</div>
          <div id="fleet-stat-techs" class="text-xl font-mono font-semibold text-zinc-100 mt-1">0</div>
        </div>
      </section>

      <!-- MAP CONTROL TOOLBAR & VIEW SWITCHER -->
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2 px-0.5">
        <!-- View Mode Switcher -->
        <div class="inline-flex items-center bg-[#13161c] p-0.5 rounded border border-zinc-800/80 text-xs font-mono">
          <button id="btn-view-2d" onclick="setMapViewMode('2d')" class="px-3 py-1.5 rounded text-zinc-100 bg-zinc-800 font-medium transition flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
            2D Classic
          </button>
          <button id="btn-view-3d" onclick="setMapViewMode('3d')" class="px-3 py-1.5 rounded text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            Modern 3D View
          </button>
        </div>

        <!-- 3D Specialized Controls -->
        <div id="controls-3d" class="hidden flex flex-wrap items-center gap-2 text-xs font-mono">
          <!-- Floor Slicer -->
          <div class="inline-flex items-center bg-[#13161c] p-0.5 rounded border border-zinc-800/80">
            <span class="px-2 text-zinc-500 text-[11px]">Floor:</span>
            <button onclick="setFloorFilter('ALL')" id="floor-btn-all" class="px-2 py-1 rounded text-zinc-100 bg-zinc-800 text-[11px] font-semibold">All</button>
            <button onclick="setFloorFilter('L0')" id="floor-btn-l0" class="px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 text-[11px]">L0 Yard</button>
            <button onclick="setFloorFilter('L1')" id="floor-btn-l1" class="px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 text-[11px]">L1 Switch</button>
            <button onclick="setFloorFilter('L2')" id="floor-btn-l2" class="px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 text-[11px]">L2 Lab</button>
            <button onclick="setFloorFilter('L3')" id="floor-btn-l3" class="px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 text-[11px]">L3 Roof</button>
          </div>

          <!-- Auto-Rotate Orbit Button -->
          <button id="btn-orbit" onclick="toggleAutoRotate()" class="px-2.5 py-1.5 bg-[#13161c] hover:bg-zinc-800 text-zinc-300 hover:text-white rounded border border-zinc-800/80 transition flex items-center gap-1.5 text-xs">
            <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            <span id="orbit-status-text">Orbit: OFF</span>
          </button>

          <!-- Simulate Fleet Button -->
          <button id="btn-simulate" onclick="toggleSimulation()" class="px-2.5 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 hover:text-indigo-100 rounded border border-indigo-700/50 transition flex items-center gap-1.5 text-xs font-semibold">
            <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span id="sim-status-text">Simulate Fleet</span>
          </button>

          <!-- Key Management -->
          <button onclick="promptMapboxToken()" title="Mapbox Access Token" class="p-1.5 bg-[#13161c] hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded border border-zinc-800/80 transition">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
          </button>
        </div>
      </div>

      <!-- MAP CONTAINER -->
      <div class="bg-[#0e1014] rounded border border-zinc-800/60 p-2 mb-4 relative overflow-hidden">
        <!-- 2D Leaflet Container -->
        <div id="fleet-map" style="height: 480px; width: 100%; border-radius: 4px;" class="bg-[#090a0d] z-10"></div>

        <!-- 3D Mapbox Container -->
        <div id="fleet-mapbox-3d" style="height: 480px; width: 100%; border-radius: 4px;" class="hidden bg-[#090a0d] z-10"></div>

        <!-- Floating Simulation HUD Pill -->
        <div id="sim-banner" class="hidden absolute top-4 left-4 z-20 bg-zinc-950/85 backdrop-blur-md px-3 py-1.5 rounded border border-indigo-500/40 text-xs font-mono text-zinc-200 flex items-center gap-2 shadow-lg">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Simulation Active: <strong id="sim-tech-count" class="text-indigo-300">8</strong> Techs &bull; <span id="sim-floor-label" class="text-zinc-400">All Floors</span></span>
        </div>
      </div>

      <!-- DEVICES LIST -->
      <div class="bg-[#0e1014] rounded border border-zinc-800/60 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-zinc-800/60 text-zinc-500 font-mono text-[11px] uppercase tracking-wider">
                <th class="p-2.5">Status</th>
                <th class="p-2.5">Device ID</th>
                <th class="p-2.5">Technician</th>
                <th class="p-2.5">Hardware</th>
                <th class="p-2.5">Recent Activity / Reply</th>
                <th class="p-2.5">Battery</th>
                <th class="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="devices-table-body" class="divide-y divide-zinc-800/40">
              <tr><td colspan="7" class="p-6 text-center text-zinc-600 font-mono text-xs">Loading fleet...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 3: DIRECTIVES -->
    <div id="tab-directives" class="hidden">
      <div class="flex justify-end mb-3">
        <button onclick="openDirectiveModal()" class="px-3 py-1.5 text-xs font-medium bg-zinc-200 hover:bg-white text-zinc-950 rounded transition">
          + New Directive
        </button>
      </div>

      <div class="bg-[#0e1014] rounded border border-zinc-800/60 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-zinc-800/60 text-zinc-500 font-mono text-[11px] uppercase tracking-wider">
                <th class="p-2.5">Dispatched</th>
                <th class="p-2.5">Priority</th>
                <th class="p-2.5">Target</th>
                <th class="p-2.5">Message</th>
                <th class="p-2.5">Field Acknowledgements & Replies</th>
              </tr>
            </thead>
            <tbody id="directives-table-body" class="divide-y divide-zinc-800/40">
              <tr><td colspan="5" class="p-6 text-center text-zinc-600 font-mono text-xs">No dispatched directives.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- INSPECTION DETAIL MODAL                                                   -->
  <!-- ========================================================================= -->
  <div id="detail-modal" class="hidden fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onclick="closeDetailModal()">
    <div class="relative w-full max-w-3xl max-h-[90vh] bg-[#0e1014] border border-zinc-800 rounded-lg shadow-2xl overflow-y-auto p-5 text-zinc-300" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div>
          <h3 id="modal-meter-title" class="text-sm font-semibold text-zinc-100 font-mono">METER DETAIL</h3>
          <p id="modal-meta-subtitle" class="text-[11px] text-zinc-500 font-mono mt-0.5">Audit Record</p>
        </div>
        <button onclick="closeDetailModal()" class="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded transition">Close</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4 text-xs">
        <div>
          <div class="relative bg-[#090a0d] rounded border border-zinc-800 flex items-center justify-center min-h-[220px]">
            <img id="detail-modal-img" src="" alt="Inspection photo" class="max-h-[300px] w-auto object-contain mx-auto">
          </div>
          <div id="detail-photo-caption" class="text-[11px] text-zinc-600 mt-1 font-mono text-center"></div>
        </div>

        <div class="space-y-3.5">
          <div class="bg-[#090a0d] p-3 rounded border border-zinc-800/60 space-y-1.5 text-xs">
            <div class="flex justify-between py-1 border-b border-zinc-800/40">
              <span class="text-zinc-500">Edge Reading</span>
              <span id="detail-edge-kwh" class="font-mono text-zinc-200">—</span>
            </div>
            <div class="flex justify-between py-1 border-b border-zinc-800/40">
              <span class="text-zinc-500">Cloud VLM</span>
              <span id="detail-vlm-kwh" class="font-mono text-zinc-200">—</span>
            </div>
            <div class="flex justify-between py-1 border-b border-zinc-800/40">
              <span class="text-zinc-500">Reconciliation</span>
              <span id="detail-reconcile-badge">—</span>
            </div>
            <div class="flex justify-between py-1">
              <span class="text-zinc-500">QA Status</span>
              <span id="detail-edge-status">—</span>
            </div>
          </div>

          <div class="bg-[#090a0d] p-3 rounded border border-zinc-800/60 space-y-1 text-xs">
            <div class="text-[10px] font-mono text-zinc-500 uppercase">AI Diagnostics</div>
            <p id="detail-vlm-summary" class="text-zinc-400 text-xs italic">No summary generated.</p>
            <div id="detail-vlm-tags" class="flex flex-wrap gap-1 mt-1"></div>
            <p id="detail-vlm-notes" class="text-zinc-500 text-[11px] font-mono mt-1"></p>
          </div>

          <div id="detail-qc-scorecard" class="bg-[#090a0d] p-2.5 rounded border border-zinc-800/60 grid grid-cols-2 gap-1.5 text-xs">
            <!-- Populated via openDetailModal -->
          </div>

          <div class="bg-[#090a0d] p-2.5 rounded border border-zinc-800/60 text-xs">
            <span class="text-zinc-500 text-[10px] block font-mono uppercase">SHA-256 Seal</span>
            <div id="detail-evidence-seal" class="mt-0.5 font-mono text-zinc-400 break-all text-[11px]">—</div>
          </div>

          <div class="bg-[#090a0d] p-3 rounded border border-zinc-800/60 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span class="text-zinc-500 text-[10px] block font-mono">TECH</span>
              <span id="detail-attr-tech" class="font-mono text-zinc-300">—</span>
            </div>
            <div>
              <span class="text-zinc-500 text-[10px] block font-mono">DEVICE</span>
              <span id="detail-attr-device" class="font-mono text-zinc-400">—</span>
            </div>
            <div>
              <span class="text-zinc-500 text-[10px] block font-mono">MODEL</span>
              <span id="detail-attr-model" class="text-zinc-400">—</span>
            </div>
            <div>
              <span class="text-zinc-500 text-[10px] block font-mono">VERSION</span>
              <span id="detail-attr-ver" class="font-mono text-zinc-400">—</span>
            </div>
            <div class="col-span-2 pt-1 border-t border-zinc-800/40">
              <span class="text-zinc-500 text-[10px] block font-mono">COORDINATES</span>
              <span id="detail-attr-geo" class="font-mono text-zinc-400">—</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- DISPATCH DIRECTIVE MODAL                                                  -->
  <!-- ========================================================================= -->
  <div id="directive-modal" class="hidden fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onclick="closeDirectiveModal()">
    <div class="relative w-full max-w-md bg-[#0e1014] border border-zinc-800 rounded-lg shadow-2xl p-5 text-zinc-300" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between pb-3 border-b border-zinc-800">
        <h3 class="text-sm font-semibold text-zinc-100">Dispatch Directive</h3>
        <button onclick="closeDirectiveModal()" class="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
      </div>

      <form onsubmit="submitDirective(event)" class="space-y-3 mt-3 text-xs">
        <div>
          <label class="block text-zinc-500 mb-1">Target</label>
          <div class="grid grid-cols-3 gap-2">
            <select id="dir-target-type" onchange="updateTargetInput()" class="px-2.5 py-1.5 bg-[#090a0d] border border-zinc-800 rounded text-zinc-300">
              <option value="BROADCAST">All Techs</option>
              <option value="TECHNICIAN">Tech</option>
              <option value="DEVICE">Device</option>
            </select>
            <div class="col-span-2 relative">
              <select id="dir-target-select" onchange="syncTargetFromSelect()" class="w-full px-2.5 py-1.5 bg-[#090a0d] border border-zinc-800 rounded font-mono text-zinc-300 text-xs hidden">
              </select>
              <input id="dir-target-id" type="text" value="ALL" placeholder="Target ID" class="w-full px-2.5 py-1.5 bg-[#090a0d] border border-zinc-800 rounded font-mono text-zinc-300 text-xs">
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-zinc-500 mb-1">Type</label>
            <select id="dir-msg-type" class="w-full px-2.5 py-1.5 bg-[#090a0d] border border-zinc-800 rounded text-zinc-300">
              <option value="ALERT">Alert</option>
              <option value="DIRECTIVE">Directive</option>
              <option value="REINSPECT">Reinspect</option>
              <option value="PING">Ping</option>
            </select>
          </div>
          <div>
            <label class="block text-zinc-500 mb-1">Priority</label>
            <select id="dir-priority" class="w-full px-2.5 py-1.5 bg-[#090a0d] border border-zinc-800 rounded text-zinc-300">
              <option value="NORMAL">Normal</option>
              <option value="URGENT">Urgent</option>
              <option value="CRITICAL">Critical</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-zinc-500 mb-1">Title</label>
          <input id="dir-title" type="text" required placeholder="Subject" class="w-full px-2.5 py-1.5 bg-[#090a0d] border border-zinc-800 rounded text-zinc-200">
        </div>

        <div>
          <label class="block text-zinc-500 mb-1">Message</label>
          <textarea id="dir-body" rows="3" required placeholder="Instructions for field device..." class="w-full px-2.5 py-1.5 bg-[#090a0d] border border-zinc-800 rounded text-zinc-200"></textarea>
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <button type="button" onclick="closeDirectiveModal()" class="px-3 py-1.5 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded transition">Cancel</button>
          <button type="submit" id="dir-submit-btn" class="px-3 py-1.5 bg-zinc-200 hover:bg-white text-zinc-950 rounded font-medium transition">Dispatch</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    function escapeHtml(str) {
      if (str == null) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    const CARTO_KEY = 'cb1_5as9_1_c576e671f3b866cffdf1ad64';
    let currentTheme = localStorage.getItem('novo_theme') || 'dark';
    let allData = [];
    let allDirectives = [];
    let allDevices = [];
    let activeFilter = 'ALL';
    let currentTab = 'inspections';
    let map = null;
    let tileLayer = null;
    let mapMarkers = {};

    // Mapbox 3D State
    let currentMapView = '2d';
    let mapbox3d = null;
    let mapboxInitialized = false;
    let isOrbiting = false;
    let orbitAnimationId = null;
    let currentFloorFilter = 'ALL';
    let isSimulationRunning = false;
    let simIntervalId = null;
    let mapboxMarkers = {};
    let simulatedTechs = [];

    function applyTheme(theme) {
      currentTheme = theme;
      localStorage.setItem('novo_theme', theme);
      const btn = document.getElementById('theme-btn');
      
      document.documentElement.classList.remove('light', 'dark', 'slate');
      if (theme === 'light') {
        document.documentElement.classList.add('light');
        if (btn) btn.textContent = 'Theme: Light';
      } else if (theme === 'slate') {
        document.documentElement.classList.add('dark', 'slate');
        if (btn) btn.textContent = 'Theme: Slate';
      } else {
        document.documentElement.classList.add('dark');
        if (btn) btn.textContent = 'Theme: Dark';
      }

      updateMapTileLayer();
      updateMapboxLighting();
    }

    function toggleTheme() {
      // Cycle: dark -> slate -> light -> dark
      const next = currentTheme === 'dark' ? 'slate' : currentTheme === 'slate' ? 'light' : 'dark';
      applyTheme(next);
    }

    function toggleExportMenu(e) {
      e.stopPropagation();
      const menu = document.getElementById('export-menu');
      if (menu) menu.classList.toggle('hidden');
    }

    function closeExportMenu() {
      const menu = document.getElementById('export-menu');
      if (menu) menu.classList.add('hidden');
    }

    function getCartoTileUrl(theme) {
      const variant = theme === 'light' ? 'voyager' : 'dark_all';
      return `https://basemaps.cartocdn.com/rastertiles/${variant}/{z}/{x}/{y}.png?key=${CARTO_KEY}`;
    }

    function updateMapTileLayer() {
      if (!map) return;
      if (tileLayer) map.removeLayer(tileLayer);
      tileLayer = L.tileLayer(getCartoTileUrl(currentTheme), {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      }).addTo(map);
    }

    function initMap() {
      if (map || typeof L === 'undefined') return;
      const el = document.getElementById('fleet-map');
      if (!el) return;
      map = L.map('fleet-map').setView([19.0760, 72.8777], 5);
      updateMapTileLayer();
    }

    function switchTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.className = 'tab-btn pb-2.5 border-b-2 border-transparent text-zinc-500 hover:text-zinc-300 transition';
      });
      document.getElementById('tab-btn-' + tab).className = 'tab-btn pb-2.5 border-b-2 border-zinc-200 text-zinc-100 transition';

      document.getElementById('tab-inspections').classList.toggle('hidden', tab !== 'inspections');
      document.getElementById('tab-fleet').classList.toggle('hidden', tab !== 'fleet');
      document.getElementById('tab-directives').classList.toggle('hidden', tab !== 'directives');

      if (tab === 'fleet') {
        setTimeout(() => {
          if (currentMapView === '2d') {
            initMap();
            if (map) map.invalidateSize();
            renderFleetMap();
          } else {
            if (mapbox3d) {
              mapbox3d.resize();
              render3DMarkers();
            } else {
              initMapbox3D();
            }
          }
        }, 100);
      }
    }

    function setFilter(filter) {
      activeFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.className = 'filter-btn px-2.5 py-1 text-xs rounded text-zinc-500 hover:text-zinc-300 transition';
      });
      document.getElementById('filter-' + filter).className = 'filter-btn px-2.5 py-1 text-xs rounded bg-zinc-800 text-zinc-100 transition';
      renderTable();
    }

    async function refreshAll() {
      await Promise.all([fetchData(), fetchDirectives(), fetchDevices()]);
    }

    async function fetchData() {
      try {
        const res = await fetch('/api/v1/inspections');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        allData = await res.json();
        updateStats();
        updateTechFilterDropdown();
        renderTable();
      } catch (e) { console.error('Fetch error:', e); }
    }

    async function fetchDirectives() {
      try {
        const res = await fetch('/api/v1/admin/messages');
        if (!res.ok) return;
        allDirectives = await res.json();
        document.getElementById('unread-ack-badge').textContent = allDirectives.length;
        renderDirectivesTable();
      } catch (e) { console.error('Directives fetch error:', e); }
    }

    async function fetchDevices() {
      try {
        const res = await fetch('/api/v1/devices');
        if (!res.ok) return;
        allDevices = await res.json();
        renderFleetUI();
      } catch (e) { console.error('Devices fetch error:', e); }
    }

    function updateStats() {
      document.getElementById('stat-total').textContent = allData.length;
      document.getElementById('stat-pass').textContent = allData.filter(d => d.qa_status === 'PASS').length;
      document.getElementById('stat-vlm').textContent = allData.filter(d => d.audit_stage === 'VLM_VERIFIED').length;
      document.getElementById('stat-warn').textContent = allData.filter(d => d.qa_status === 'WARNING' || d.audit_stage === 'MISMATCH_FLAGGED').length;
      document.getElementById('stat-crit').textContent = allData.filter(d => d.qa_status === 'CRITICAL_HAZARD').length;
    }

    function updateTechFilterDropdown() {
      const select = document.getElementById('tech-filter');
      const currentVal = select.value;
      const techs = Array.from(new Set(allData.map(d => d.technician_id).filter(Boolean)));
      let html = '<option value="ALL">All Techs</option>';
      techs.forEach(t => { html += `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`; });
      select.innerHTML = html;
      select.value = currentVal;
    }

    function renderTable() {
      const q = (document.getElementById('search-input').value || '').toLowerCase().trim();
      const techFilter = document.getElementById('tech-filter').value;

      const filtered = allData.filter(item => {
        let matchesFilter = true;
        if (activeFilter === 'VLM_VERIFIED') matchesFilter = item.audit_stage === 'VLM_VERIFIED';
        else if (activeFilter !== 'ALL') matchesFilter = item.qa_status === activeFilter;
        const matchesTech = techFilter === 'ALL' || item.technician_id === techFilter;
        const matchesQuery = !q ||
          (item.meter_serial_number || '').toLowerCase().includes(q) ||
          (item.id || '').toLowerCase().includes(q) ||
          (item.technician_id || '').toLowerCase().includes(q) ||
          (item.device_id || '').toLowerCase().includes(q);
        return matchesFilter && matchesTech && matchesQuery;
      });

      const tbody = document.getElementById('table-body');
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="p-6 text-center text-zinc-600 font-mono text-xs">No records found.</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(item => {
        const photo = item.photos && item.photos.length > 0 ? item.photos[0].file_path : null;
        const photoHtml = photo 
          ? `<img src="${escapeHtml(photo)}" onclick="openDetailModal('${escapeHtml(item.id)}')" onerror="this.outerHTML='<div class=\\'w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 font-mono\\'>N/A</div>'" class="w-8 h-8 object-cover rounded border border-zinc-800 cursor-pointer hover:border-zinc-600 transition">`
          : `<div class="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 font-mono">N/A</div>`;

        let statusDot = 'bg-zinc-600';
        let statusLabel = item.qa_status;
        if (item.qa_status === 'PASS') { statusDot = 'bg-emerald-500'; statusLabel = 'Pass'; }
        else if (item.qa_status === 'WARNING') { statusDot = 'bg-amber-500'; statusLabel = 'Warning'; }
        else if (item.qa_status === 'CRITICAL_HAZARD') { statusDot = 'bg-rose-500'; statusLabel = 'Hazard'; }

        const statusHtml = `<span class="inline-flex items-center gap-1.5 text-zinc-300 text-xs font-mono"><span class="w-1.5 h-1.5 rounded-full ${statusDot}"></span>${statusLabel}</span>`;

        let auditHtml = '<span class="text-zinc-600 font-mono">—</span>';
        if (item.audit_stage === 'VLM_VERIFIED') {
          auditHtml = `<span class="text-zinc-300 font-mono" title="${escapeHtml(item.vlm_notes || 'Verified')}">Verified</span>`;
        } else if (item.audit_stage === 'MISMATCH_FLAGGED') {
          auditHtml = `<span class="text-amber-400 font-mono" title="${escapeHtml(item.vlm_notes || 'Mismatch')}">Mismatch</span>`;
        } else if (item.audit_stage === 'IMAGE_RECEIVED') {
          auditHtml = '<span class="text-zinc-500 font-mono">Received</span>';
        } else if (item.audit_stage === 'VLM_SKIPPED') {
          auditHtml = `<span class="text-zinc-600 font-mono">Skipped</span>`;
        }

        const edgeKwhText = item.kwh_reading != null ? `${Number(item.kwh_reading).toFixed(1)}` : '<span class="text-zinc-600">—</span>';
        const vlmKwhText = item.vlm_kwh != null ? `${Number(item.vlm_kwh).toFixed(1)}` : '<span class="text-zinc-600">—</span>';
        const timeText = item.ingested_at ? new Date(item.ingested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (escapeHtml(item.timestamp_utc) || '—');

        return `<tr class="hover:bg-[#13161c] transition cursor-pointer" onclick="openDetailModal('${escapeHtml(item.id)}')">
          <td class="p-2.5" onclick="event.stopPropagation()">${photoHtml}</td>
          <td class="p-2.5 font-mono text-zinc-200">${escapeHtml(item.meter_serial_number || 'UNKNOWN')}</td>
          <td class="p-2.5 font-mono text-zinc-300">${edgeKwhText}</td>
          <td class="p-2.5 font-mono text-zinc-400">${vlmKwhText}</td>
          <td class="p-2.5">${auditHtml}</td>
          <td class="p-2.5">${statusHtml}</td>
          <td class="p-2.5 text-zinc-400 font-mono">${escapeHtml(item.technician_id || 'UNKNOWN')}</td>
          <td class="p-2.5 text-zinc-500 font-mono text-[11px]">${timeText}</td>
          <td class="p-2.5 text-right">
            <button onclick="openDetailModal('${escapeHtml(item.id)}')" class="text-zinc-500 hover:text-zinc-200 text-xs font-mono">Inspect &rarr;</button>
          </td>
        </tr>`;
      }).join('');
    }

    function renderFleetUI() {
      const onlineCount = allDevices.filter(d => d.is_online).length;
      document.getElementById('fleet-online-badge').textContent = onlineCount;
      document.getElementById('fleet-stat-total').textContent = allDevices.length;
      document.getElementById('fleet-stat-online').textContent = onlineCount;
      const techCount = new Set(allDevices.map(d => d.technician_id).filter(Boolean)).size;
      document.getElementById('fleet-stat-techs').textContent = techCount;

      renderFleetTable();
      renderFleetMap();
      render3DMarkers();
    }

    function findLatestActivityForDevice(deviceId) {
      // Check directives ACKs first
      for (const d of allDirectives) {
        if (!d.acks) continue;
        const matchingAck = d.acks.find(a => a.device_id === deviceId);
        if (matchingAck) {
          const time = matchingAck.actioned_at || matchingAck.delivered_at;
          const timeStr = time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          const note = matchingAck.client_notes || matchingAck.reply_note;
          if (note) {
            return {
              text: note,
              time: timeStr,
              isReply: true
            };
          }
          return {
            text: 'Acknowledged directive',
            time: timeStr,
            isReply: false
          };
        }
      }
      // Check inspections
      const insp = allData.find(i => i.device_id === deviceId);
      if (insp) {
        const time = insp.ingested_at || insp.timestamp_utc;
        const timeStr = time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return {
          text: `Inspected meter ${insp.meter_serial_number || 'UNKNOWN'}`,
          time: timeStr,
          isReply: false
        };
      }
      return null;
    }

    function renderFleetTable() {
      const tbody = document.getElementById('devices-table-body');
      if (allDevices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-zinc-600 font-mono text-xs">No registered devices.</td></tr>';
        return;
      }

      tbody.innerHTML = allDevices.map(d => {
        const isOnline = d.is_online;
        const statusBadge = isOnline
          ? `<span class="inline-flex items-center gap-1.5 text-zinc-300 font-mono text-xs"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Online</span>`
          : `<span class="text-zinc-600 font-mono text-xs">Offline</span>`;

        const lastSeen = d.last_seen_at ? new Date(d.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
        const batteryText = d.battery_level != null ? `${Math.round(d.battery_level * 100)}%` : '—';
        
        const act = findLatestActivityForDevice(d.device_id);
        let activityHtml = `<span class="text-zinc-500 font-mono text-[11px]">Last seen @ ${lastSeen}</span>`;
        if (act) {
          if (act.isReply) {
            activityHtml = `
              <div class="text-zinc-300 font-sans text-xs">
                <span class="text-emerald-400 font-mono text-[11px] font-semibold">[REPLY]</span> &ldquo;${escapeHtml(act.text)}&rdquo;
                <span class="text-zinc-500 font-mono text-[10px] ml-1">@ ${act.time}</span>
              </div>
            `;
          } else {
            activityHtml = `
              <div class="text-zinc-400 text-xs">
                ${escapeHtml(act.text)}
                <span class="text-zinc-500 font-mono text-[10px] ml-1">@ ${act.time}</span>
              </div>
            `;
          }
        }

        return `<tr class="hover:bg-[#13161c] transition">
          <td class="p-2.5">${statusBadge}</td>
          <td class="p-2.5 font-mono text-zinc-200">${escapeHtml(d.device_id)}</td>
          <td class="p-2.5 text-zinc-400 font-mono">${escapeHtml(d.technician_id)}</td>
          <td class="p-2.5 text-zinc-500 text-xs">${escapeHtml(d.device_model || 'Android')}</td>
          <td class="p-2.5">${activityHtml}</td>
          <td class="p-2.5 text-zinc-400 font-mono">${batteryText}</td>
          <td class="p-2.5 text-right flex items-center justify-end gap-1.5">
            <button onclick="triggerDeviceSyncBack('${escapeHtml(d.device_id)}')" title="Restore cloud inspections and photos to this device" class="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-[11px] font-mono transition flex items-center gap-1.5">
              <svg class="w-3 h-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              <span>Sync Back</span>
            </button>
            <button onclick="dispatchDirectToDevice('${escapeHtml(d.device_id)}')" class="px-2 py-1 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[11px] font-mono rounded transition">Alert &rarr;</button>
          </td>
        </tr>`;
      }).join('');
    }

    function renderFleetMap() {
      if (!map) return;
      const validPoints = [];
      allDevices.forEach(d => {
        if (d.latitude && d.longitude && (d.latitude !== 0 || d.longitude !== 0)) {
          validPoints.push([d.latitude, d.longitude]);
        }
        const lat = d.latitude || 19.0760;
        const lon = d.longitude || 72.8777;
        const key = d.device_id;
        const color = d.is_online ? '#10b981' : '#52525b';

        const popupHtml = `
          <div class="p-1 text-xs text-zinc-300 font-mono">
            <div class="text-zinc-100 font-medium">${escapeHtml(d.technician_id)} (${d.is_online ? 'Online' : 'Offline'})</div>
            <div class="text-[11px] text-zinc-500 mt-0.5">${escapeHtml(d.device_id)}</div>
            <div class="text-[11px] text-zinc-400 mt-0.5">${lat.toFixed(4)}, ${lon.toFixed(4)}</div>
            <div class="mt-2 pt-2 border-t border-zinc-800">
              <button onclick="dispatchDirectToDevice('${escapeHtml(d.device_id)}')" class="w-full py-1 bg-zinc-200 hover:bg-white text-zinc-950 rounded text-center text-xs">Alert Device</button>
            </div>
          </div>
        `;

        if (mapMarkers[key]) {
          mapMarkers[key].setLatLng([lat, lon]);
          mapMarkers[key].setPopupContent(popupHtml);
        } else {
          const marker = L.circleMarker([lat, lon], {
            radius: 7,
            fillColor: color,
            color: '#090a0d',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
          }).addTo(map);
          marker.bindPopup(popupHtml);
          mapMarkers[key] = marker;
        }
      });

      if (validPoints.length === 1) {
        map.setView(validPoints[0], 15);
      } else if (validPoints.length > 1) {
        map.fitBounds(L.latLngBounds(validPoints).pad(0.2));
      }
    }

    // =========================================================================
    // MAPBOX 3D FLEET & MULTI-FLOOR DIGITAL TWIN
    // =========================================================================

    function getMapboxToken() {
      const serverToken = "__SERVER_MAPBOX_TOKEN__";
      if (serverToken && !serverToken.startsWith("__SERVER_")) return serverToken;
      return localStorage.getItem('novo_mapbox_token') || "";
    }

    function promptMapboxToken() {
      const current = getMapboxToken();
      const entered = prompt("Enter your Mapbox Access Token (pk.eyJ...):", current);
      if (entered !== null) {
        const cleaned = entered.trim();
        if (cleaned) {
          localStorage.setItem('novo_mapbox_token', cleaned);
          alert("Mapbox token saved. Initializing 3D engine...");
          if (mapbox3d) {
            mapbox3d.remove();
            mapbox3d = null;
            mapboxInitialized = false;
          }
          initMapbox3D();
        }
      }
    }

    function setMapViewMode(mode) {
      currentMapView = mode;
      const btn2d = document.getElementById('btn-view-2d');
      const btn3d = document.getElementById('btn-view-3d');
      const controls3d = document.getElementById('controls-3d');
      const el2d = document.getElementById('fleet-map');
      const el3d = document.getElementById('fleet-mapbox-3d');

      if (mode === '2d') {
        btn2d.className = 'px-3 py-1.5 rounded text-zinc-100 bg-zinc-800 font-medium transition flex items-center gap-1.5';
        btn3d.className = 'px-3 py-1.5 rounded text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1.5';
        controls3d.classList.add('hidden');
        controls3d.classList.remove('flex');
        el3d.classList.add('hidden');
        el2d.classList.remove('hidden');
        if (isOrbiting) toggleAutoRotate();
        if (map) map.invalidateSize();
      } else {
        btn3d.className = 'px-3 py-1.5 rounded text-zinc-100 bg-sky-900/60 border border-sky-500/40 font-medium transition flex items-center gap-1.5';
        btn2d.className = 'px-3 py-1.5 rounded text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1.5';
        controls3d.classList.remove('hidden');
        controls3d.classList.add('flex');
        el2d.classList.add('hidden');
        el3d.classList.remove('hidden');
        initMapbox3D();
      }
    }

    function updateMapboxLighting() {
      if (!mapbox3d || !mapboxInitialized) return;
      try {
        const preset = currentTheme === 'light' ? 'day' : currentTheme === 'slate' ? 'dusk' : 'night';
        mapbox3d.setConfigProperty('basemap', 'lightPreset', preset);
      } catch (e) {}
    }

    // GeoJSON Model: Ahmedabad Central Substation & Testing Depot Multi-Story Facility
    const DEPOT_FACILITY_GEOJSON = {
      type: 'FeatureCollection',
      features: [
        // Level 0: 66kV Transformer Yard & Heavy Fleet Bay (0m - 4m)
        {
          type: 'Feature',
          properties: {
            floor: 'L0',
            name: 'L0: Transformer Yard & Fleet Bay',
            height: 4,
            base: 0,
            color: '#1e293b'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [72.5706, 23.0219],
              [72.5720, 23.0219],
              [72.5720, 23.0229],
              [72.5706, 23.0229],
              [72.5706, 23.0219]
            ]]
          }
        },
        // Level 1: Switchgear & Feeder Automation Lab (4m - 8m)
        {
          type: 'Feature',
          properties: {
            floor: 'L1',
            name: 'L1: Feeder Switchgear & Control',
            height: 8,
            base: 4,
            color: '#0e7490'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [72.5708, 23.0221],
              [72.5718, 23.0221],
              [72.5718, 23.0227],
              [72.5708, 23.0227],
              [72.5708, 23.0221]
            ]]
          }
        },
        // Level 2: Smart Meter Calibration & VLM Verification Lab (8m - 12m)
        {
          type: 'Feature',
          properties: {
            floor: 'L2',
            name: 'L2: Smart Meter QA Lab',
            height: 12,
            base: 8,
            color: '#047857'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [72.5710, 23.0222],
              [72.5716, 23.0222],
              [72.5716, 23.0226],
              [72.5710, 23.0226],
              [72.5710, 23.0222]
            ]]
          }
        },
        // Level 3: Rooftop Solar Array & Battery Inverter Deck (12m - 15m)
        {
          type: 'Feature',
          properties: {
            floor: 'L3',
            name: 'L3: Solar Rooftop & Inverters',
            height: 15,
            base: 12,
            color: '#b45309'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [72.5711, 23.0223],
              [72.5715, 23.0223],
              [72.5715, 23.0225],
              [72.5711, 23.0225],
              [72.5711, 23.0223]
            ]]
          }
        },
        // Maintenance Garage & EV Charging Annex (0m - 5m)
        {
          type: 'Feature',
          properties: {
            floor: 'L0',
            name: 'L0: EV Fleet Charging Garage',
            height: 5,
            base: 0,
            color: '#334155'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [72.5722, 23.0220],
              [72.5729, 23.0220],
              [72.5729, 23.0228],
              [72.5722, 23.0228],
              [72.5722, 23.0220]
            ]]
          }
        }
      ]
    };

    function setupFacility3DLayers() {
      if (!mapbox3d) return;
      if (mapbox3d.getSource('depot-facility')) return;

      mapbox3d.addSource('depot-facility', {
        type: 'geojson',
        data: DEPOT_FACILITY_GEOJSON
      });

      mapbox3d.addLayer({
        id: 'depot-floors-3d',
        type: 'fill-extrusion',
        source: 'depot-facility',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-opacity': 0.82
        }
      });
    }

    function initMapbox3D() {
      if (mapboxInitialized && mapbox3d) {
        mapbox3d.resize();
        render3DMarkers();
        return;
      }

      const token = getMapboxToken();
      if (!token) {
        promptMapboxToken();
        return;
      }

      if (typeof mapboxgl === 'undefined') {
        alert("Mapbox GL JS is still loading. Please wait a second.");
        return;
      }

      mapboxgl.accessToken = token;

      try {
        mapbox3d = new mapboxgl.Map({
          container: 'fleet-mapbox-3d',
          style: 'mapbox://styles/mapbox/standard',
          center: [72.5714, 23.0225], // Ahmedabad Substation Depot
          zoom: 16.5,
          pitch: 62,
          bearing: -24,
          antialias: true
        });

        mapbox3d.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

        mapbox3d.on('style.load', () => {
          mapboxInitialized = true;
          updateMapboxLighting();
          setupFacility3DLayers();
          render3DMarkers();
        });

        mapbox3d.on('error', (e) => {
          console.warn("Mapbox 3D error:", e);
        });
      } catch (err) {
        console.error("Mapbox init failed:", err);
      }
    }

    function setFloorFilter(floor) {
      currentFloorFilter = floor;
      ['all', 'l0', 'l1', 'l2', 'l3'].forEach(f => {
        const btn = document.getElementById('floor-btn-' + f);
        if (!btn) return;
        if (f.toUpperCase() === floor) {
          btn.className = 'px-2 py-1 rounded text-zinc-100 bg-zinc-800 text-[11px] font-semibold border border-zinc-700';
        } else {
          btn.className = 'px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 text-[11px]';
        }
      });

      const label = document.getElementById('sim-floor-label');
      if (label) label.textContent = floor === 'ALL' ? 'All Floors' : `Floor ${floor}`;

      if (mapbox3d && mapbox3d.getLayer('depot-floors-3d')) {
        if (floor === 'ALL') {
          mapbox3d.setFilter('depot-floors-3d', null);
        } else {
          mapbox3d.setFilter('depot-floors-3d', ['==', ['get', 'floor'], floor]);
        }
      }

      render3DMarkers();
    }

    function toggleAutoRotate() {
      isOrbiting = !isOrbiting;
      const btn = document.getElementById('btn-orbit');
      const txt = document.getElementById('orbit-status-text');
      if (isOrbiting) {
        if (txt) txt.textContent = 'Orbit: ON';
        if (btn) btn.className = 'px-2.5 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 hover:text-emerald-100 rounded border border-emerald-500/50 transition flex items-center gap-1.5 text-xs font-semibold';
        rotateCamera();
      } else {
        if (txt) txt.textContent = 'Orbit: OFF';
        if (btn) btn.className = 'px-2.5 py-1.5 bg-[#13161c] hover:bg-zinc-800 text-zinc-300 hover:text-white rounded border border-zinc-800/80 transition flex items-center gap-1.5 text-xs';
        if (orbitAnimationId) {
          cancelAnimationFrame(orbitAnimationId);
          orbitAnimationId = null;
        }
      }
    }

    function rotateCamera() {
      if (!isOrbiting || !mapbox3d) return;
      const currentBearing = mapbox3d.getBearing();
      mapbox3d.setBearing((currentBearing + 0.12) % 360);
      orbitAnimationId = requestAnimationFrame(rotateCamera);
    }

    // =========================================================================
    // MULTI-FLOOR IN-MEMORY SIMULATION ENGINE
    // =========================================================================

    const SIMULATED_TECH_TEMPLATES = [
      { id: 'sim_tech_01', name: 'TECH-01 (Ahmed)', floor: 'L1', lat: 23.0225, lng: 72.5712, task: 'Feeder Switchgear Test', status: 'PASS', battery: 88, angle: 0 },
      { id: 'sim_tech_02', name: 'TECH-02 (Pooja)', floor: 'L2', lat: 23.0223, lng: 72.5715, task: 'Smart Meter Calib Bay 4', status: 'INSPECTING', battery: 74, angle: 1 },
      { id: 'sim_tech_03', name: 'TECH-03 (Rahul)', floor: 'L0', lat: 23.0227, lng: 72.5710, task: '66kV Step-Down Transformer', status: 'ALERT', battery: 61, angle: 2 },
      { id: 'sim_tech_04', name: 'TECH-04 (Fatima)', floor: 'L3', lat: 23.0224, lng: 72.5713, task: 'Rooftop Inverter Check', status: 'PASS', battery: 92, angle: 3 },
      { id: 'sim_tech_05', name: 'TECH-05 (Vikram)', floor: 'L1', lat: 23.0226, lng: 72.5716, task: 'Busbar Insulation Test', status: 'PASS', battery: 83, angle: 4 },
      { id: 'sim_tech_06', name: 'TECH-06 (Ananya)', floor: 'L2', lat: 23.0221, lng: 72.5714, task: 'VLM OCR Verification', status: 'INSPECTING', battery: 95, angle: 5 },
      { id: 'sim_tech_07', name: 'TECH-07 (Dev)', floor: 'L0', lat: 23.0225, lng: 72.5725, task: 'EV Fleet Diagnostic Port', status: 'PASS', battery: 69, angle: 6 },
      { id: 'sim_tech_08', name: 'TECH-08 (Kiran)', floor: 'L1', lat: 23.0224, lng: 72.5709, task: 'Current Transformer Ratio', status: 'PASS', battery: 79, angle: 7 },
    ];

    function toggleSimulation() {
      isSimulationRunning = !isSimulationRunning;
      const btn = document.getElementById('btn-simulate');
      const banner = document.getElementById('sim-banner');
      const txt = document.getElementById('sim-status-text');

      if (isSimulationRunning) {
        simulatedTechs = JSON.parse(JSON.stringify(SIMULATED_TECH_TEMPLATES));
        if (txt) txt.textContent = 'Stop Simulation';
        if (btn) btn.className = 'px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-rose-100 rounded border border-rose-500/50 transition flex items-center gap-1.5 text-xs font-semibold';
        if (banner) banner.classList.remove('hidden');

        // Center 3D view on depot facility
        if (mapbox3d) {
          mapbox3d.flyTo({
            center: [72.5714, 23.0225],
            zoom: 16.6,
            pitch: 62,
            bearing: -24,
            essential: true
          });
        }

        render3DMarkers();
        simIntervalId = setInterval(tickSimulation, 1600);
      } else {
        if (simIntervalId) clearInterval(simIntervalId);
        simIntervalId = null;
        simulatedTechs = [];
        if (txt) txt.textContent = 'Simulate Fleet';
        if (btn) btn.className = 'px-2.5 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 hover:text-indigo-100 rounded border border-indigo-700/50 transition flex items-center gap-1.5 text-xs font-semibold';
        if (banner) banner.classList.add('hidden');
        render3DMarkers();
      }
    }

    function tickSimulation() {
      if (!isSimulationRunning) return;
      simulatedTechs.forEach(t => {
        t.angle += 0.25;
        const radius = 0.00015;
        t.lat += Math.sin(t.angle) * radius * 0.25;
        t.lng += Math.cos(t.angle) * radius * 0.25;
        
        // Random slight battery discharge
        if (Math.random() < 0.2 && t.battery > 15) {
          t.battery -= 1;
        }

        // Occasional status or floor shift
        if (Math.random() < 0.05) {
          const floors = ['L0', 'L1', 'L2', 'L3'];
          t.floor = floors[Math.floor(Math.random() * floors.length)];
        }
      });
      render3DMarkers();
    }

    function render3DMarkers() {
      if (!mapbox3d || !mapboxInitialized) return;

      // Clear previous markers
      Object.keys(mapboxMarkers).forEach(k => {
        mapboxMarkers[k].remove();
        delete mapboxMarkers[k];
      });

      // 1. Render real registered devices
      allDevices.forEach(d => {
        const lat = d.latitude || 23.0225;
        const lon = d.longitude || 72.5714;
        const key = 'real_' + d.device_id;
        const isOnline = d.is_online;

        const el = document.createElement('div');
        el.className = 'cursor-pointer group';
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-6 h-6 rounded-full ${isOnline ? 'bg-emerald-500/30 animate-ping' : 'bg-zinc-600/20'}"></span>
            <div class="w-4 h-4 rounded-full ${isOnline ? 'bg-emerald-500 border-2 border-zinc-950' : 'bg-zinc-600 border-2 border-zinc-950'} flex items-center justify-center shadow-lg"></div>
            <div class="absolute -bottom-5 whitespace-nowrap bg-zinc-950/90 text-zinc-300 font-mono text-[10px] px-1 rounded border border-zinc-800 shadow pointer-events-none">
              ${escapeHtml(d.technician_id || 'Tech')}
            </div>
          </div>
        `;

        const popupHtml = `
          <div class="p-1 font-mono text-xs">
            <div class="flex items-center gap-1.5 font-semibold ${isOnline ? 'text-emerald-400' : 'text-zinc-400'}">
              <span class="w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-zinc-500'}"></span>
              ${escapeHtml(d.technician_id || 'Tech')} (${isOnline ? 'Online' : 'Offline'})
            </div>
            <div class="text-[11px] text-zinc-500 mt-1">Device: ${escapeHtml(d.device_id)}</div>
            <div class="text-[11px] text-zinc-400">Coords: ${lat.toFixed(4)}, ${lon.toFixed(4)}</div>
            <div class="mt-2 pt-2 border-t border-zinc-800">
              <button onclick="dispatchDirectToDevice('${escapeHtml(d.device_id)}')" class="w-full py-1 bg-zinc-200 hover:bg-white text-zinc-950 rounded text-center text-xs font-semibold">
                Alert Device
              </button>
            </div>
          </div>
        `;

        const popup = new mapboxgl.Popup({ offset: 15 }).setHTML(popupHtml);
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([lon, lat])
          .setPopup(popup)
          .addTo(mapbox3d);

        mapboxMarkers[key] = marker;
      });

      // 2. Render simulated devices
      if (isSimulationRunning) {
        simulatedTechs.forEach(t => {
          if (currentFloorFilter !== 'ALL' && t.floor !== currentFloorFilter) {
            return;
          }

          const key = 'sim_' + t.id;
          const statusColor = t.status === 'ALERT' ? 'bg-rose-500' : t.status === 'INSPECTING' ? 'bg-amber-400' : 'bg-sky-400';
          const pingColor = t.status === 'ALERT' ? 'bg-rose-500/40' : t.status === 'INSPECTING' ? 'bg-amber-400/40' : 'bg-sky-400/40';

          const el = document.createElement('div');
          el.className = 'cursor-pointer group';
          el.innerHTML = `
            <div class="relative flex items-center justify-center">
              <span class="absolute w-7 h-7 rounded-full ${pingColor} animate-ping"></span>
              <div class="w-4 h-4 rounded-full ${statusColor} border-2 border-zinc-950 flex items-center justify-center shadow-md">
                <span class="text-[7px] text-zinc-950 font-bold">${t.floor}</span>
              </div>
              <div class="absolute -bottom-5 whitespace-nowrap bg-indigo-950/90 text-indigo-200 font-mono text-[9px] px-1 rounded border border-indigo-700/60 shadow pointer-events-none">
                ${escapeHtml(t.name)} &bull; ${t.floor}
              </div>
            </div>
          `;

          const popupHtml = `
            <div class="p-1 font-mono text-xs">
              <div class="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1 mb-1.5">
                <span class="font-bold text-indigo-300">[SIMULATED] ${escapeHtml(t.name)}</span>
                <span class="px-1 bg-zinc-800 rounded text-[10px] text-zinc-300 font-semibold">${t.floor}</span>
              </div>
              <div class="text-[11px] text-zinc-400"><strong class="text-zinc-300">Task:</strong> ${escapeHtml(t.task)}</div>
              <div class="text-[11px] text-zinc-400"><strong class="text-zinc-300">Status:</strong> <span class="${t.status === 'ALERT' ? 'text-rose-400' : t.status === 'INSPECTING' ? 'text-amber-300' : 'text-emerald-400'}">${t.status}</span></div>
              <div class="text-[11px] text-zinc-400"><strong class="text-zinc-300">Battery:</strong> ${t.battery}%</div>
              <div class="text-[10px] text-zinc-500 mt-1 italic">In-memory telemetry agent &bull; Zero DB impact</div>
            </div>
          `;

          const popup = new mapboxgl.Popup({ offset: 15 }).setHTML(popupHtml);
          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([t.lng, t.lat])
            .setPopup(popup)
            .addTo(mapbox3d);

          mapboxMarkers[key] = marker;
        });
      }
    }

    async function triggerDeviceSyncBack(deviceId) {
      if (!confirm(`Trigger Sync Back to device "${deviceId}"?\n\nThis will send all cloud inspections and images back to the mobile device in case of local data wipe.`)) return;
      try {
        const res = await fetch(`/api/v1/devices/${encodeURIComponent(deviceId)}/sync-back`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          alert(`[SYNC BACK TRIGGERED]\n\nDevice: ${data.device_id}\nRecords available in cloud: ${data.inspection_count}\nDevice online: ${data.is_online ? 'YES (Live push sent)' : 'NO (Will sync on reconnection)'}\n\n${data.message}`);
        } else {
          alert(`Failed to trigger sync: ${data.detail || 'Server error'}`);
        }
      } catch (err) {
        alert(`Sync back network error: ${err.message}`);
      }
    }

    function dispatchDirectToDevice(deviceId) {
      document.getElementById('dir-target-type').value = 'DEVICE';
      updateTargetInput();
      document.getElementById('dir-target-id').value = deviceId;
      const select = document.getElementById('dir-target-select');
      if (select) select.value = deviceId;
      document.getElementById('dir-priority').value = 'URGENT';
      document.getElementById('dir-msg-type').value = 'ALERT';
      openDirectiveModal();
    }

    function renderDirectivesTable() {
      const tbody = document.getElementById('directives-table-body');
      if (allDirectives.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-zinc-600 font-mono text-xs">No dispatched directives.</td></tr>';
        return;
      }

      tbody.innerHTML = allDirectives.map(d => {
        const createdStr = d.created_at ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
        const acks = d.acks || [];
        const actionedCount = acks.filter(a => a.status === 'ACTIONED').length;
        const deliveredCount = acks.filter(a => a.status === 'DELIVERED').length;

        let statusHeader = `<span class="text-zinc-500 font-mono text-xs">Pending</span>`;
        if (actionedCount > 0) statusHeader = `<span class="text-emerald-400 font-mono text-xs font-semibold">Actioned (${actionedCount})</span>`;
        else if (deliveredCount > 0) statusHeader = `<span class="text-zinc-300 font-mono text-xs">Delivered (${deliveredCount})</span>`;

        let repliesList = '';
        if (acks.length > 0) {
          repliesList = acks.map(a => {
            const isAct = a.status === 'ACTIONED';
            const tagColor = isAct ? 'text-emerald-400' : 'text-zinc-400';
            const tagText = isAct ? 'ACTIONED' : 'DELIVERED';
            const timeStr = a.actioned_at || a.delivered_at ? new Date(a.actioned_at || a.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return `
              <div class="mt-1.5 pt-1.5 border-t border-zinc-800/40 text-[11px] font-mono">
                <div class="flex items-center gap-1.5 ${tagColor}">
                  <span class="font-semibold">[${tagText}]</span>
                  <span class="text-zinc-200">${escapeHtml(a.technician_id || 'Tech')}</span>
                  <span class="text-zinc-500 text-[10px]">(${escapeHtml(a.device_id || 'dev')})</span>
                  ${timeStr ? `<span class="text-zinc-500 text-[10px]">@ ${timeStr}</span>` : ''}
                </div>
                ${(a.client_notes || a.reply_note) ? `<div class="mt-1 text-zinc-300 font-sans bg-zinc-900/60 p-1.5 rounded border border-zinc-800/50">&ldquo;${escapeHtml(a.client_notes || a.reply_note)}&rdquo;</div>` : ''}
              </div>
            `;
          }).join('');
        }

        return `<tr class="hover:bg-[#13161c] transition">
          <td class="p-2.5 font-mono text-zinc-500 text-[11px]">${createdStr}</td>
          <td class="p-2.5 font-mono text-xs text-zinc-400">${escapeHtml(d.priority)}</td>
          <td class="p-2.5 font-mono text-xs text-zinc-300">${escapeHtml(d.target_type)}: ${escapeHtml(d.target_id)}</td>
          <td class="p-2.5">
            <div class="text-zinc-200 text-xs font-medium">${escapeHtml(d.title)}</div>
            <div class="text-zinc-400 text-[11px] truncate max-w-sm mt-0.5">${escapeHtml(d.body)}</div>
          </td>
          <td class="p-2.5">
            ${statusHeader}
            ${repliesList}
          </td>
        </tr>`;
      }).join('');
    }

    function openDetailModal(id) {
      const item = allData.find(d => d.id === id);
      if (!item) return;

      document.getElementById('modal-meter-title').textContent = `${item.meter_serial_number || 'UNKNOWN METER'} (${item.id.slice(0, 8)})`;
      document.getElementById('modal-meta-subtitle').textContent = `Ingested: ${item.ingested_at || item.timestamp_utc || '—'}`;

      const photo = item.photos && item.photos.length > 0 ? item.photos[0].file_path : null;
      const imgElem = document.getElementById('detail-modal-img');
      if (photo) {
        imgElem.src = photo;
        imgElem.style.display = 'block';
        document.getElementById('detail-photo-caption').textContent = photo.split('/').pop();
      } else {
        imgElem.style.display = 'none';
        document.getElementById('detail-photo-caption').textContent = 'No photo uploaded';
      }

      document.getElementById('detail-edge-kwh').textContent = item.kwh_reading != null ? `${Number(item.kwh_reading).toFixed(1)} kWh` : 'null';
      document.getElementById('detail-vlm-kwh').textContent = item.vlm_kwh != null ? `${Number(item.vlm_kwh).toFixed(1)} kWh` : '—';

      let rBadge = '<span class="text-zinc-500 font-mono">None</span>';
      if (item.audit_stage === 'VLM_VERIFIED') {
        rBadge = '<span class="text-emerald-400 font-mono">Matched</span>';
      } else if (item.audit_stage === 'MISMATCH_FLAGGED') {
        rBadge = '<span class="text-amber-400 font-mono">Discrepancy</span>';
      } else if (item.audit_stage === 'IMAGE_RECEIVED') {
        rBadge = '<span class="text-zinc-400 font-mono">Received</span>';
      }
      document.getElementById('detail-reconcile-badge').innerHTML = rBadge;

      document.getElementById('detail-edge-status').innerHTML = `<span class="text-zinc-200 font-mono">${escapeHtml(item.qa_status)}</span>`;
      document.getElementById('detail-vlm-summary').textContent = item.vlm_summary || 'No AI summary generated.';
      document.getElementById('detail-vlm-notes').textContent = item.vlm_notes ? `Notes: ${item.vlm_notes}` : '';

      const tagsElem = document.getElementById('detail-vlm-tags');
      tagsElem.innerHTML = '';
      if (item.vlm_tags) {
        item.vlm_tags.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
          const span = document.createElement('span');
          span.className = 'px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-300 rounded';
          span.textContent = tag;
          tagsElem.appendChild(span);
        });
      }

      // 4-Point Physical Installation QC Scorecard
      let qc = null;
      if (item.qc_checklist_json) {
        try { qc = JSON.parse(item.qc_checklist_json); } catch(e) {}
      }
      const qcElem = document.getElementById('detail-qc-scorecard');
      if (qc) {
        const wireSafe = !qc.wire_hazard_visible && item.qa_status !== 'CRITICAL_HAZARD';
        const coverSeated = qc.terminal_cover_seated !== false;
        const sealIntact = qc.tamper_seal_intact !== false;
        const casingOk = qc.casing_undamaged !== false;

        qcElem.innerHTML = `
          <div class="p-2 rounded bg-zinc-900 border border-zinc-800">
            <span class="text-[9px] text-zinc-500 block uppercase font-mono">Wire</span>
            <span class="font-mono text-xs ${wireSafe ? 'text-zinc-300' : 'text-rose-400'}">${wireSafe ? 'Safe' : 'Hazard'}</span>
          </div>
          <div class="p-2 rounded bg-zinc-900 border border-zinc-800">
            <span class="text-[9px] text-zinc-500 block uppercase font-mono">Cover</span>
            <span class="font-mono text-xs ${coverSeated ? 'text-zinc-300' : 'text-amber-400'}">${coverSeated ? 'Seated' : 'Unseated'}</span>
          </div>
          <div class="p-2 rounded bg-zinc-900 border border-zinc-800">
            <span class="text-[9px] text-zinc-500 block uppercase font-mono">Seal</span>
            <span class="font-mono text-xs ${sealIntact ? 'text-zinc-300' : 'text-amber-400'}">${sealIntact ? 'Intact' : 'Tampered'}</span>
          </div>
          <div class="p-2 rounded bg-zinc-900 border border-zinc-800">
            <span class="text-[9px] text-zinc-500 block uppercase font-mono">Casing</span>
            <span class="font-mono text-xs ${casingOk ? 'text-zinc-300' : 'text-rose-400'}">${casingOk ? 'Undamaged' : 'Damaged'}</span>
          </div>
        `;
      } else {
        qcElem.innerHTML = `<div class="col-span-2 text-zinc-600 italic py-1 text-center font-mono text-[11px]">Pending VLM review</div>`;
      }

      const sealElem = document.getElementById('detail-evidence-seal');
      if (item.evidence_sha256) {
        sealElem.innerHTML = `
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono text-zinc-400 break-all select-all text-[10px]">${escapeHtml(item.evidence_sha256)}</span>
            <button onclick="navigator.clipboard.writeText('${escapeHtml(item.evidence_sha256)}')" class="px-1.5 py-0.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-mono">Copy</button>
          </div>
        `;
      } else {
        sealElem.innerHTML = '<span class="text-zinc-600 italic font-mono text-[11px]">None</span>';
      }

      document.getElementById('detail-attr-tech').textContent = item.technician_id || 'UNKNOWN';
      document.getElementById('detail-attr-device').textContent = item.device_id || 'UNKNOWN';
      document.getElementById('detail-attr-model').textContent = item.device_model || 'Android';
      document.getElementById('detail-attr-ver').textContent = item.app_version || '1.0.0';

      const lat = item.latitude != null ? Number(item.latitude).toFixed(4) : null;
      const lon = item.longitude != null ? Number(item.longitude).toFixed(4) : null;
      if (lat && lon) {
        document.getElementById('detail-attr-geo').innerHTML = `<a href="https://maps.google.com/?q=${lat},${lon}" target="_blank" class="text-zinc-400 hover:underline font-mono">${lat}, ${lon} &nearr;</a>`;
      } else {
        document.getElementById('detail-attr-geo').textContent = '—';
      }

      document.getElementById('detail-modal').classList.remove('hidden');
    }

    function closeDetailModal() { document.getElementById('detail-modal').classList.add('hidden'); }
    function openDirectiveModal() { 
      updateTargetInput();
      document.getElementById('directive-modal').classList.remove('hidden'); 
    }
    function closeDirectiveModal() { document.getElementById('directive-modal').classList.add('hidden'); }

    function updateTargetInput() {
      const type = document.getElementById('dir-target-type').value;
      const input = document.getElementById('dir-target-id');
      const select = document.getElementById('dir-target-select');

      if (type === 'BROADCAST') {
        select.classList.add('hidden');
        input.classList.remove('hidden');
        input.value = 'ALL';
        input.readOnly = true;
      } else if (type === 'DEVICE') {
        input.readOnly = false;
        // Populate select with connected devices
        let opts = '';
        if (allDevices.length > 0) {
          allDevices.forEach(d => {
            const label = `${d.device_id} (${d.technician_id || 'Tech'}${d.device_model ? ' - ' + d.device_model : ''})`;
            opts += `<option value="${escapeHtml(d.device_id)}">${escapeHtml(label)}</option>`;
          });
          select.innerHTML = opts;
          select.classList.remove('hidden');
          input.classList.add('hidden');
          input.value = select.value || (allDevices[0] ? allDevices[0].device_id : 'dev_android');
        } else {
          select.classList.add('hidden');
          input.classList.remove('hidden');
          if (input.value === 'ALL') input.value = 'dev_android';
        }
      } else if (type === 'TECHNICIAN') {
        input.readOnly = false;
        // Populate select with known technicians
        const techs = Array.from(new Set([
          ...allDevices.map(d => d.technician_id),
          ...allData.map(d => d.technician_id)
        ].filter(Boolean)));

        if (techs.length > 0) {
          let opts = '';
          techs.forEach(t => {
            opts += `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`;
          });
          select.innerHTML = opts;
          select.classList.remove('hidden');
          input.classList.add('hidden');
          input.value = select.value || techs[0];
        } else {
          select.classList.add('hidden');
          input.classList.remove('hidden');
          if (input.value === 'ALL') input.value = 'TECH-01';
        }
      }
    }

    function syncTargetFromSelect() {
      const select = document.getElementById('dir-target-select');
      const input = document.getElementById('dir-target-id');
      if (select && input) {
        input.value = select.value;
      }
    }

    async function submitDirective(e) {
      e.preventDefault();
      const btn = document.getElementById('dir-submit-btn');
      btn.disabled = true;
      btn.textContent = 'Sending...';

      const payload = {
        target_type: document.getElementById('dir-target-type').value,
        target_id: document.getElementById('dir-target-id').value.trim() || 'ALL',
        message_type: document.getElementById('dir-msg-type').value,
        priority: document.getElementById('dir-priority').value,
        title: document.getElementById('dir-title').value.trim(),
        body: document.getElementById('dir-body').value.trim()
      };

      try {
        const res = await fetch('/api/v1/admin/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        closeDirectiveModal();
        document.getElementById('dir-title').value = '';
        document.getElementById('dir-body').value = '';
        await fetchDirectives();
        switchTab('directives');
      } catch (err) {
        alert('Failed: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Dispatch';
      }
    }

    async function confirmResetData() {
      if (!confirm("Purge all test inspection records, messages, and telemetry?")) return;
      try {
        const res = await fetch('/api/v1/admin/reset-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: 'RESET_ALL_DATA' })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        await refreshAll();
      } catch (err) {
        alert('Reset failed: ' + err.message);
      }
    }

    function setupAdminWebSocket() {
      try {
        const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProto}//${location.host}/api/v1/ws/admin`;
        const socket = new WebSocket(wsUrl);
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'DEVICE_PRESENCE' || data.type === 'DEVICE_UPDATE') {
              fetchDevices();
            } else if (data.type === 'MESSAGE_ACK') {
              fetchDirectives();
            }
          } catch(e) {}
        };
        socket.onclose = () => { setTimeout(setupAdminWebSocket, 5000); };
      } catch(e) {}
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDetailModal();
        closeDirectiveModal();
        closeExportMenu();
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#export-btn') && !e.target.closest('#export-menu')) {
        closeExportMenu();
      }
    });

    applyTheme(currentTheme);
    setupAdminWebSocket();
    refreshAll();
    setInterval(refreshAll, 5000);
  </script>
</body>
</html>
"""

@app.get("/api/v1/config/mapbox")
def get_mapbox_config():
    token = settings.MAPBOX_ACCESS_TOKEN or os.getenv("MAPBOX_ACCESS_TOKEN", "")
    return {"token": token}


@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
def admin_dashboard():
    token = settings.MAPBOX_ACCESS_TOKEN or os.getenv("MAPBOX_ACCESS_TOKEN", "")
    rendered = ADMIN_HTML.replace("__SERVER_MAPBOX_TOKEN__", token)
    return HTMLResponse(content=rendered)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
