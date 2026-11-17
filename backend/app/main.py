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
  </style>
</head>
<body class="bg-[#090a0d] text-zinc-300 antialiased min-h-screen">

  <!-- ========================================================================= -->
  <!-- MINIMAL CALM BOOT OVERLAY                                                 -->
  <!-- ========================================================================= -->
  <div id="boot-overlay" class="fixed inset-0 z-50 bg-[#090a0d] text-zinc-400 font-mono flex flex-col justify-between p-6 sm:p-12 transition-opacity duration-500 select-none overflow-hidden" onclick="dismissBootOverlay()">
    <div class="flex items-center justify-between z-10">
      <div class="text-xs text-zinc-300 font-semibold tracking-wider uppercase">Novo Ops</div>
      <div class="text-[11px] text-zinc-600 font-mono">AP-SOUTH-1</div>
    </div>

    <!-- WIREFRAME GRID ACCENT -->
    <div class="absolute top-0 right-0 w-[45%] h-full pointer-events-none opacity-30 hidden md:block">
      <div class="wireframe-grid">
        <div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div>
        <div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div>
        <div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div>
        <div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div>
        <div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div><div class="wireframe-cell"></div>
      </div>
    </div>

    <!-- TERMINAL LINES -->
    <div class="max-w-xl z-10 my-auto space-y-2 text-xs font-mono">
      <div class="text-zinc-500"><span id="boot-ts-1" class="text-zinc-600">--:--:--</span> <span class="text-zinc-300">HTTP REQUEST DETECTED</span></div>
      <div class="text-zinc-500"><span id="boot-ts-2" class="text-zinc-600">--:--:--</span> <span class="text-zinc-300">SERVICE INITIALIZING</span></div>
      <div class="text-zinc-500"><span id="boot-ts-3" class="text-zinc-600">--:--:--</span> <span class="text-zinc-300">DATABASE POOL CONNECTED</span></div>
      <div class="text-zinc-500"><span id="boot-ts-4" class="text-zinc-600">--:--:--</span> <span class="text-zinc-300">VLM AUDIT ENGINE READY</span></div>
    </div>

    <div class="flex items-center justify-between text-xs font-mono z-10 pt-4 border-t border-zinc-900">
      <span class="text-zinc-600 hover:text-zinc-400 cursor-pointer">CONTINUE &rarr;</span>
      <div class="flex items-center gap-2">
        <div id="boot-spinner" class="w-3 h-3 rounded-full border border-zinc-700 border-t-zinc-300 animate-spin"></div>
        <span id="boot-status-text" class="text-zinc-400 text-[11px] font-mono tracking-wider">LOADING</span>
      </div>
    </div>
  </div>

  <!-- ========================================================================= -->
  <!-- MAIN MINIMAL CONSOLE                                                      -->
  <!-- ========================================================================= -->
  <div class="max-w-5xl mx-auto px-4 py-8">
    
    <!-- HEADER -->
    <header class="flex items-center justify-between pb-5 border-b border-zinc-800/60">
      <div class="flex items-center gap-3">
        <div class="w-2 h-2 rounded-sm bg-zinc-400"></div>
        <h1 class="text-base font-semibold text-zinc-100 tracking-tight">Novo Admin</h1>
        <span id="live-indicator" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Live
        </span>
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
        <button onclick="showBootOverlay()" class="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 rounded transition" title="Terminal">
          Terminal
        </button>
        <button onclick="confirmResetData()" class="px-2 py-1 text-xs text-zinc-600 hover:text-rose-400 rounded transition" title="Clear test records">
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
      <!-- STAT COUNTERS (CLEAN MONOCHROME) -->
      <section class="grid grid-cols-5 gap-3 mb-5">
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
      <section class="grid grid-cols-3 gap-3 mb-4">
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

      <!-- MAP -->
      <div class="bg-[#0e1014] rounded border border-zinc-800/60 p-2 mb-4">
        <div id="fleet-map" style="height: 380px; width: 100%; border-radius: 4px;" class="bg-[#090a0d] z-10"></div>
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
                <th class="p-2.5 text-right"></th>
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

    function applyTheme(theme) {
      currentTheme = theme;
      localStorage.setItem('novo_theme', theme);
      if (theme === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        const btn = document.getElementById('theme-btn');
        if (btn) btn.textContent = 'Theme: Light';
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
        const btn = document.getElementById('theme-btn');
        if (btn) btn.textContent = 'Theme: Dark';
      }
      updateMapTileLayer();
    }

    function toggleTheme() {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
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

    function initBootTimestamps() {
      const now = new Date();
      function fmt(offsetSec) {
        const d = new Date(now.getTime() - offsetSec * 1000);
        return d.toTimeString().split(' ')[0];
      }
      const el1 = document.getElementById('boot-ts-1'); if (el1) el1.textContent = fmt(10);
      const el2 = document.getElementById('boot-ts-2'); if (el2) el2.textContent = fmt(7);
      const el3 = document.getElementById('boot-ts-3'); if (el3) el3.textContent = fmt(4);
      const el4 = document.getElementById('boot-ts-4'); if (el4) el4.textContent = fmt(1);
    }

    function dismissBootOverlay() {
      const overlay = document.getElementById('boot-overlay');
      if (!overlay) return;
      overlay.classList.add('opacity-0', 'pointer-events-none');
      setTimeout(() => { overlay.style.display = 'none'; }, 400);
    }

    function showBootOverlay() {
      const overlay = document.getElementById('boot-overlay');
      if (!overlay) return;
      initBootTimestamps();
      const statusText = document.getElementById('boot-status-text');
      const spinner = document.getElementById('boot-spinner');
      if (statusText) statusText.textContent = 'LOADING';
      if (spinner) spinner.className = 'w-3 h-3 rounded-full border border-zinc-700 border-t-zinc-300 animate-spin';
      overlay.style.display = 'flex';
      overlay.classList.remove('opacity-0', 'pointer-events-none');

      setTimeout(() => {
        if (statusText) statusText.textContent = 'READY';
        if (spinner) spinner.className = 'w-2 h-2 rounded-full bg-emerald-400';
      }, 700);
      setTimeout(dismissBootOverlay, 1100);
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
          initMap();
          if (map) map.invalidateSize();
          renderFleetMap();
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
    }

    function findLatestActivityForDevice(deviceId) {
      // Check directives ACKs first
      for (const d of allDirectives) {
        if (!d.acks) continue;
        const matchingAck = d.acks.find(a => a.device_id === deviceId);
        if (matchingAck) {
          const time = matchingAck.actioned_at || matchingAck.delivered_at;
          const timeStr = time ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          if (matchingAck.reply_note) {
            return {
              text: matchingAck.reply_note,
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
          <td class="p-2.5 text-right">
            <button onclick="dispatchDirectToDevice('${escapeHtml(d.device_id)}')" class="text-zinc-400 hover:text-zinc-200 text-xs font-mono">Alert &rarr;</button>
          </td>
        </tr>`;
      }).join('');
    }

    function renderFleetMap() {
      if (!map) return;
      allDevices.forEach(d => {
        const lat = d.latitude || 19.0760;
        const lon = d.longitude || 72.8777;
        const key = d.device_id;
        const color = d.is_online ? '#10b981' : '#52525b';

        const popupHtml = `
          <div class="p-1 text-xs text-zinc-300 font-mono">
            <div class="text-zinc-100 font-medium">${escapeHtml(d.technician_id)} (${d.is_online ? 'Online' : 'Offline'})</div>
            <div class="text-[11px] text-zinc-500 mt-0.5">${escapeHtml(d.device_id)}</div>
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
            radius: 6,
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
                ${a.reply_note ? `<div class="mt-1 text-zinc-300 font-sans bg-zinc-900/60 p-1.5 rounded border border-zinc-800/50">&ldquo;${escapeHtml(a.reply_note)}&rdquo;</div>` : ''}
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
        dismissBootOverlay();
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#export-btn') && !e.target.closest('#export-menu')) {
        closeExportMenu();
      }
    });

    applyTheme(currentTheme);
    initBootTimestamps();
    setupAdminWebSocket();
    refreshAll().then(() => {
      const statusText = document.getElementById('boot-status-text');
      const spinner = document.getElementById('boot-spinner');
      if (statusText) statusText.textContent = 'READY';
      if (spinner) spinner.className = 'w-2 h-2 rounded-full bg-emerald-400';
      setTimeout(dismissBootOverlay, 700);
    });
    setInterval(refreshAll, 5000);
  </script>
</body>
</html>
"""

@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
def admin_dashboard():
    return HTMLResponse(content=ADMIN_HTML)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
