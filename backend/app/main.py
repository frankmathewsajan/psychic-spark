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
# ---------------------------------------------------------------------------
ADMIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo Admin &bull; Inspections & Fleet</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <style>
    .leaflet-popup-content-wrapper { border-radius: 8px; font-family: sans-serif; }
    .online-pulse {
      display: inline-block; width: 10px; height: 10px; border-radius: 50%;
      background: #10b981; box-shadow: 0 0 0 rgba(16, 185, 129, 0.4);
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
  </style>
</head>
<body class="bg-zinc-50 text-zinc-950 font-sans antialiased min-h-screen">
  <div class="max-w-6xl mx-auto px-4 py-8">
    
    <!-- HEADER -->
    <header class="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-200 gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Novo Ops Center</h1>
        <p class="text-sm text-zinc-500 mt-1">Live edge telemetry, Tier-3 VLM verification, and real-time fleet command</p>
      </div>
      <div class="flex items-center gap-2">
        <span id="live-indicator" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Live (5s)
        </span>
        <button onclick="refreshAll()" class="px-3 py-1.5 text-xs font-medium bg-white hover:bg-zinc-100 text-zinc-800 rounded-md border border-zinc-200 transition">
          Refresh
        </button>
        <button onclick="confirmResetData()" class="px-2.5 py-1.5 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-700 rounded-md border border-red-200 transition" title="Clear dummy test records">
          Reset Data
        </button>
      </div>
    </header>

    <!-- TABS NAVIGATION -->
    <div class="flex border-b border-zinc-200 mt-4 mb-6 gap-2">
      <button onclick="switchTab('inspections')" id="tab-btn-inspections" class="tab-btn pb-3 px-3 text-sm font-semibold border-b-2 border-zinc-900 text-zinc-900 transition">
        Audit SSOT & Inspections
      </button>
      <button onclick="switchTab('fleet')" id="tab-btn-fleet" class="tab-btn pb-3 px-3 text-sm font-medium border-b-2 border-transparent text-zinc-500 hover:text-zinc-800 transition">
        Live Devices & Fleet Map (<span id="fleet-online-badge">0</span> Online)
      </button>
      <button onclick="switchTab('directives')" id="tab-btn-directives" class="tab-btn pb-3 px-3 text-sm font-medium border-b-2 border-transparent text-zinc-500 hover:text-zinc-800 transition">
        Directives & Messages (<span id="unread-ack-badge">0</span>)
      </button>
    </div>

    <!-- TAB 1: INSPECTIONS CONTENT -->
    <div id="tab-inspections">
      <section class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div class="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
          <div class="text-xs font-medium text-zinc-500 uppercase tracking-wide">Total Ingested</div>
          <div id="stat-total" class="text-2xl font-bold mt-1">0</div>
        </div>
        <div class="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
          <div class="text-xs font-medium text-emerald-600 uppercase tracking-wide">Edge Pass</div>
          <div id="stat-pass" class="text-2xl font-bold text-emerald-600 mt-1">0</div>
        </div>
        <div class="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
          <div class="text-xs font-medium text-teal-600 uppercase tracking-wide">VLM Audited</div>
          <div id="stat-vlm" class="text-2xl font-bold text-teal-600 mt-1">0</div>
        </div>
        <div class="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
          <div class="text-xs font-medium text-amber-600 uppercase tracking-wide">Warnings / Mismatch</div>
          <div id="stat-warn" class="text-2xl font-bold text-amber-600 mt-1">0</div>
        </div>
        <div class="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
          <div class="text-xs font-medium text-red-600 uppercase tracking-wide">Critical Hazards</div>
          <div id="stat-crit" class="text-2xl font-bold text-red-600 mt-1">0</div>
        </div>
      </section>

      <div class="flex flex-col sm:flex-row gap-3 mb-4 items-center justify-between">
        <div class="flex gap-2 w-full sm:w-auto">
          <input id="search-input" type="text" placeholder="Search Meter S/N, Tech, Device..." oninput="renderTable()"
            class="w-full sm:w-72 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-900 placeholder-zinc-400">
          <select id="tech-filter" onchange="renderTable()" class="px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none text-zinc-700">
            <option value="ALL">All Technicians</option>
          </select>
        </div>
        
        <div class="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto">
          <button onclick="setFilter('ALL')" id="filter-ALL" class="filter-btn px-3 py-1 text-xs font-medium rounded-md bg-zinc-900 text-white">All</button>
          <button onclick="setFilter('PASS')" id="filter-PASS" class="filter-btn px-3 py-1 text-xs font-medium rounded-md bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100">Pass</button>
          <button onclick="setFilter('VLM_VERIFIED')" id="filter-VLM_VERIFIED" class="filter-btn px-3 py-1 text-xs font-medium rounded-md bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100">VLM Verified</button>
          <button onclick="setFilter('WARNING')" id="filter-WARNING" class="filter-btn px-3 py-1 text-xs font-medium rounded-md bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100">Warning</button>
          <button onclick="setFilter('CRITICAL_HAZARD')" id="filter-CRITICAL_HAZARD" class="filter-btn px-3 py-1 text-xs font-medium rounded-md bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100">Hazard</button>
        </div>
      </div>

      <div class="bg-white rounded-lg border border-zinc-200 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="border-b border-zinc-200 bg-zinc-50/75 text-zinc-500 font-medium text-xs uppercase tracking-wider">
                <th class="p-3 w-16">Photo</th>
                <th class="p-3">Meter S/N</th>
                <th class="p-3">Edge Reading</th>
                <th class="p-3">Cloud VLM</th>
                <th class="p-3">Audit Stage</th>
                <th class="p-3">Status</th>
                <th class="p-3">Device & Tech</th>
                <th class="p-3">Timestamp</th>
                <th class="p-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody id="table-body" class="divide-y divide-zinc-200 font-normal">
              <tr><td colspan="9" class="p-8 text-center text-zinc-400">Loading inspection records...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 2: LIVE FLEET MAP CONTENT -->
    <div id="tab-fleet" class="hidden">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div class="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
          <div class="text-xs font-medium text-zinc-500 uppercase tracking-wide">Registered Devices</div>
          <div id="fleet-stat-total" class="text-2xl font-bold mt-1">0</div>
        </div>
        <div class="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
          <div class="text-xs font-medium text-emerald-600 uppercase tracking-wide">Live Connected (WS)</div>
          <div id="fleet-stat-online" class="text-2xl font-bold text-emerald-600 mt-1">0</div>
        </div>
        <div class="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
          <div class="text-xs font-medium text-sky-600 uppercase tracking-wide">Active Technicians</div>
          <div id="fleet-stat-techs" class="text-2xl font-bold text-sky-600 mt-1">0</div>
        </div>
      </div>

      <!-- MAP CONTAINER -->
      <div class="bg-white rounded-lg border border-zinc-200 p-3 mb-6 shadow-sm">
        <div class="flex items-center justify-between mb-2 px-1">
          <div class="text-xs font-semibold uppercase tracking-wider text-zinc-600">Real-Time Fleet Geolocation</div>
          <div class="text-xs text-zinc-400">Pulsing Green = Connected &bull; Gray = Offline (Last Seen)</div>
        </div>
        <div id="fleet-map" style="height: 380px; width: 100%; border-radius: 6px;" class="bg-zinc-100 z-10"></div>
      </div>

      <!-- DEVICES LIST TABLE -->
      <div class="bg-white rounded-lg border border-zinc-200 overflow-hidden shadow-sm">
        <div class="px-4 py-3 border-b border-zinc-200 bg-zinc-50/75">
          <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-700">Device Fleet Directory</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="border-b border-zinc-200 text-zinc-500 font-medium text-xs uppercase tracking-wider">
                <th class="p-3">Status</th>
                <th class="p-3">Device ID</th>
                <th class="p-3">Technician</th>
                <th class="p-3">Hardware & Version</th>
                <th class="p-3">Location / Last Seen</th>
                <th class="p-3">Battery</th>
                <th class="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody id="devices-table-body" class="divide-y divide-zinc-200 font-normal">
              <tr><td colspan="7" class="p-8 text-center text-zinc-400">Loading device fleet...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 3: DIRECTIVES & MESSAGING CONTENT -->
    <div id="tab-directives" class="hidden">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-lg font-bold text-zinc-900">Field Communication Hub</h2>
          <p class="text-xs text-zinc-500">Real-time WebSocket alerts and store-and-forward fallback directives</p>
        </div>
        <button onclick="openDirectiveModal()" class="px-3.5 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-md transition shadow-sm">
          + New Directive / Alert
        </button>
      </div>

      <div class="bg-white rounded-lg border border-zinc-200 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="border-b border-zinc-200 bg-zinc-50/75 text-zinc-500 font-medium text-xs uppercase tracking-wider">
                <th class="p-3">Dispatched</th>
                <th class="p-3">Priority & Type</th>
                <th class="p-3">Target</th>
                <th class="p-3">Directive / Message</th>
                <th class="p-3">Delivery & Technician Replies</th>
              </tr>
            </thead>
            <tbody id="directives-table-body" class="divide-y divide-zinc-200 font-normal">
              <tr><td colspan="5" class="p-8 text-center text-zinc-400">Loading dispatched directives...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- INSPECTION DETAIL MODAL -->
  <div id="detail-modal" class="hidden fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onclick="closeDetailModal()">
    <div class="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-xl shadow-2xl overflow-y-auto p-6" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between pb-4 border-b border-zinc-200">
        <div>
          <h3 id="modal-meter-title" class="text-xl font-bold text-zinc-900 font-mono">METER DETAIL</h3>
          <p id="modal-meta-subtitle" class="text-xs text-zinc-500 mt-0.5">Audit Record</p>
        </div>
        <button onclick="closeDetailModal()" class="px-3 py-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 bg-zinc-100 rounded-md">Close (Esc)</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Audit Capture</h4>
          <div class="relative bg-zinc-950 rounded-lg overflow-hidden border border-zinc-200 flex items-center justify-center min-h-[260px]">
            <img id="detail-modal-img" src="" alt="Inspection photo" class="max-h-[380px] w-auto object-contain mx-auto">
          </div>
          <div id="detail-photo-caption" class="text-xs text-zinc-400 mt-1 font-mono text-center"></div>
        </div>

        <div class="space-y-4">
          <div>
            <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Verification Matrix</h4>
            <div class="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200 space-y-2 text-xs">
              <div class="flex justify-between items-center py-1 border-b border-zinc-200">
                <span class="text-zinc-500">Edge OCR Reading:</span>
                <span id="detail-edge-kwh" class="font-mono font-bold text-zinc-900">—</span>
              </div>
              <div class="flex justify-between items-center py-1 border-b border-zinc-200">
                <span class="text-zinc-500">Cloud VLM Reading:</span>
                <span id="detail-vlm-kwh" class="font-mono font-bold text-teal-700">—</span>
              </div>
              <div class="flex justify-between items-center py-1 border-b border-zinc-200">
                <span class="text-zinc-500">Reconciliation Status:</span>
                <span id="detail-reconcile-badge">—</span>
              </div>
              <div class="flex justify-between items-center py-1">
                <span class="text-zinc-500">Edge QA Status:</span>
                <span id="detail-edge-status">—</span>
              </div>
            </div>
          </div>

          <div>
            <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">AI Summary & Diagnostics</h4>
            <div class="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200 space-y-1.5 text-xs">
              <p id="detail-vlm-summary" class="text-zinc-700 leading-relaxed italic">No AI summary generated.</p>
              <div id="detail-vlm-tags" class="flex flex-wrap gap-1 mt-2"></div>
              <p id="detail-vlm-notes" class="text-zinc-500 text-[11px] mt-1 pt-1 border-t border-zinc-200 font-mono"></p>
            </div>
          </div>

          <div>
            <h4 class="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Device & Field Attribution</h4>
            <div class="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span class="text-zinc-400 text-[10px] block">TECHNICIAN</span>
                <span id="detail-attr-tech" class="font-mono font-medium text-zinc-900">—</span>
              </div>
              <div>
                <span class="text-zinc-400 text-[10px] block">DEVICE ID</span>
                <span id="detail-attr-device" class="font-mono text-zinc-700">—</span>
              </div>
              <div>
                <span class="text-zinc-400 text-[10px] block">HARDWARE MODEL</span>
                <span id="detail-attr-model" class="text-zinc-700">—</span>
              </div>
              <div>
                <span class="text-zinc-400 text-[10px] block">APP VERSION</span>
                <span id="detail-attr-ver" class="font-mono text-zinc-700">—</span>
              </div>
              <div class="col-span-2 pt-1 border-t border-zinc-200">
                <span class="text-zinc-400 text-[10px] block">GEO COORDINATES</span>
                <span id="detail-attr-geo" class="font-mono text-zinc-700">—</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- DISPATCH DIRECTIVE MODAL -->
  <div id="directive-modal" class="hidden fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onclick="closeDirectiveModal()">
    <div class="relative w-full max-w-lg bg-white rounded-xl shadow-2xl p-6" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between pb-3 border-b border-zinc-200">
        <h3 class="text-base font-bold text-zinc-900">Dispatch Field Directive</h3>
        <button onclick="closeDirectiveModal()" class="text-xs font-semibold text-zinc-400 hover:text-zinc-700">Cancel</button>
      </div>

      <form onsubmit="submitDirective(event)" class="space-y-4 mt-4 text-xs">
        <div>
          <label class="block font-medium text-zinc-700 mb-1">Target Group</label>
          <div class="grid grid-cols-3 gap-2">
            <select id="dir-target-type" onchange="updateTargetInput()" class="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-md font-medium text-zinc-800">
              <option value="BROADCAST">All Technicians</option>
              <option value="TECHNICIAN">Specific Tech</option>
              <option value="DEVICE">Specific Device</option>
            </select>
            <input id="dir-target-id" type="text" value="ALL" placeholder="Target ID" class="col-span-2 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-md font-mono">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-medium text-zinc-700 mb-1">Directive Type</label>
            <select id="dir-msg-type" class="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-md font-medium text-zinc-800">
              <option value="ALERT">Safety Alert</option>
              <option value="DIRECTIVE">Task Directive</option>
              <option value="REINSPECT">Re-inspection Request</option>
              <option value="PING">Network Ping</option>
            </select>
          </div>
          <div>
            <label class="block font-medium text-zinc-700 mb-1">Priority</label>
            <select id="dir-priority" class="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-md font-medium text-zinc-800">
              <option value="NORMAL">Normal</option>
              <option value="URGENT">Urgent</option>
              <option value="CRITICAL">Critical</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block font-medium text-zinc-700 mb-1">Title</label>
          <input id="dir-title" type="text" required placeholder="e.g. Mandatory Seal Re-check" class="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-md">
        </div>

        <div>
          <label class="block font-medium text-zinc-700 mb-1">Directive Content</label>
          <textarea id="dir-body" rows="3" required placeholder="Describe the mandatory instructions for the field team..." class="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-md"></textarea>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" onclick="closeDirectiveModal()" class="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md font-medium">Cancel</button>
          <button type="submit" id="dir-submit-btn" class="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-md font-semibold">Dispatch Now</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    function escapeHtml(str) {
      if (str == null) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    let allData = [];
    let allDirectives = [];
    let allDevices = [];
    let activeFilter = 'ALL';
    let currentTab = 'inspections';
    let map = null;
    let mapMarkers = {};

    function initMap() {
      if (map || typeof L === 'undefined') return;
      const el = document.getElementById('fleet-map');
      if (!el) return;
      map = L.map('fleet-map').setView([19.0760, 72.8777], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
    }

    function switchTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.className = 'tab-btn pb-3 px-3 text-sm font-medium border-b-2 border-transparent text-zinc-500 hover:text-zinc-800 transition';
      });
      document.getElementById('tab-btn-' + tab).className = 'tab-btn pb-3 px-3 text-sm font-semibold border-b-2 border-zinc-900 text-zinc-900 transition';

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
        btn.className = 'filter-btn px-3 py-1 text-xs font-medium rounded-md bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100';
      });
      document.getElementById('filter-' + filter).className = 'filter-btn px-3 py-1 text-xs font-medium rounded-md bg-zinc-900 text-white';
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
      let html = '<option value="ALL">All Technicians</option>';
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
        tbody.innerHTML = '<tr><td colspan="9" class="p-8 text-center text-zinc-400">No matching inspection records found.</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(item => {
        const photo = item.photos && item.photos.length > 0 ? item.photos[0].file_path : null;
        const photoHtml = photo 
          ? `<img src="${escapeHtml(photo)}" onclick="openDetailModal('${escapeHtml(item.id)}')" onerror="this.outerHTML='<div class=\\'w-10 h-10 rounded bg-zinc-100 flex items-center justify-center text-zinc-400 text-xs font-mono\\'>N/A</div>'" class="w-10 h-10 object-cover rounded border border-zinc-200 cursor-pointer hover:opacity-80 transition">`
          : `<div class="w-10 h-10 rounded bg-zinc-100 flex items-center justify-center text-zinc-400 text-xs font-mono">N/A</div>`;

        let statusClass = 'bg-zinc-100 text-zinc-700 border-zinc-200';
        if (item.qa_status === 'PASS') statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        else if (item.qa_status === 'WARNING') statusClass = 'bg-amber-50 text-amber-700 border-amber-200';
        else if (item.qa_status === 'CRITICAL_HAZARD') statusClass = 'bg-red-50 text-red-700 border-red-200';

        let auditHtml = '<span class="text-zinc-400 text-xs">—</span>';
        if (item.audit_stage === 'VLM_VERIFIED') {
          auditHtml = `<span class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded border bg-teal-50 text-teal-700 border-teal-200" title="${escapeHtml(item.vlm_notes || 'Verified')}">✓✓ VLM Verified</span>`;
        } else if (item.audit_stage === 'MISMATCH_FLAGGED') {
          auditHtml = `<span class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded border bg-amber-50 text-amber-700 border-amber-200 cursor-help" title="${escapeHtml(item.vlm_notes || 'Mismatch')}">⚠ Mismatch</span>`;
        } else if (item.audit_stage === 'IMAGE_RECEIVED') {
          auditHtml = '<span class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded border bg-sky-50 text-sky-700 border-sky-200">✓ Received</span>';
        } else if (item.audit_stage === 'VLM_SKIPPED') {
          auditHtml = `<span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border bg-zinc-100 text-zinc-500 border-zinc-200" title="${escapeHtml(item.vlm_notes || '')}">Skipped</span>`;
        }

        const edgeKwhText = item.kwh_reading != null ? `${Number(item.kwh_reading).toFixed(1)} kWh` : '<span class="text-zinc-400">—</span>';
        const vlmKwhText = item.vlm_kwh != null 
          ? `<span class="font-medium text-teal-700" title="${escapeHtml(item.vlm_summary || '')}">${Number(item.vlm_kwh).toFixed(1)} kWh</span>`
          : '<span class="text-zinc-400">—</span>';
        const timeText = item.ingested_at ? new Date(item.ingested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (escapeHtml(item.timestamp_utc) || '—');

        return `<tr class="hover:bg-zinc-50 transition cursor-pointer" onclick="openDetailModal('${escapeHtml(item.id)}')">
          <td class="p-3" onclick="event.stopPropagation()">${photoHtml}</td>
          <td class="p-3 font-mono font-medium text-zinc-900">${escapeHtml(item.meter_serial_number || 'UNKNOWN')}</td>
          <td class="p-3 font-medium">${edgeKwhText}</td>
          <td class="p-3">${vlmKwhText}</td>
          <td class="p-3">${auditHtml}</td>
          <td class="p-3">
            <span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded border ${statusClass}">
              ${escapeHtml(item.qa_status)}
            </span>
          </td>
          <td class="p-3 text-xs">
            <div class="font-medium text-zinc-800">${escapeHtml(item.technician_id || 'UNKNOWN')}</div>
            <div class="text-zinc-400 font-mono text-[11px] truncate max-w-[120px]">${escapeHtml(item.device_model || item.device_id || 'Android')}</div>
          </td>
          <td class="p-3 text-zinc-500 text-xs font-mono">${timeText}</td>
          <td class="p-3 text-right">
            <button onclick="openDetailModal('${escapeHtml(item.id)}')" class="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded font-medium">Inspect</button>
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

    function renderFleetTable() {
      const tbody = document.getElementById('devices-table-body');
      if (allDevices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-zinc-400">No registered mobile devices found yet. Connect Expo app to see devices.</td></tr>';
        return;
      }

      tbody.innerHTML = allDevices.map(d => {
        const isOnline = d.is_online;
        const statusBadge = isOnline
          ? `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="online-pulse"></span> Online</span>`
          : `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-500 border border-zinc-200">Offline</span>`;

        const lastSeen = d.last_seen_at ? new Date(d.last_seen_at).toLocaleTimeString() : '—';
        const latLon = d.latitude && d.longitude ? `${Number(d.latitude).toFixed(4)}, ${Number(d.longitude).toFixed(4)}` : 'Last Known (Default)';
        const batteryText = d.battery_level != null ? `${Math.round(d.battery_level * 100)}%` : '—';

        return `<tr class="hover:bg-zinc-50 transition">
          <td class="p-3">${statusBadge}</td>
          <td class="p-3 font-mono font-medium text-xs text-zinc-900">${escapeHtml(d.device_id)}</td>
          <td class="p-3 font-medium text-xs text-zinc-800">${escapeHtml(d.technician_id)}</td>
          <td class="p-3 text-xs text-zinc-500">${escapeHtml(d.device_model || 'Android')} (${escapeHtml(d.app_version || '1.0.0')})</td>
          <td class="p-3 text-xs font-mono text-zinc-600">${latLon} <span class="text-zinc-400">@ ${lastSeen}</span></td>
          <td class="p-3 text-xs text-zinc-700">${batteryText}</td>
          <td class="p-3 text-right">
            <button onclick="dispatchDirectToDevice('${escapeHtml(d.device_id)}')" class="px-2.5 py-1 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded">Send Alert</button>
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
        const color = d.is_online ? '#10b981' : '#71717a';

        const popupHtml = `
          <div class="p-1 text-xs">
            <div class="font-bold text-zinc-900">${escapeHtml(d.technician_id)} &bull; ${d.is_online ? '<span class="text-emerald-600">ONLINE</span>' : '<span class="text-zinc-400">OFFLINE</span>'}</div>
            <div class="text-[11px] font-mono text-zinc-500 mt-0.5">${escapeHtml(d.device_id)}</div>
            <div class="text-[11px] text-zinc-600 mt-1">${escapeHtml(d.device_model || 'Android')} &bull; Battery: ${d.battery_level != null ? Math.round(d.battery_level*100)+'%' : 'N/A'}</div>
            <div class="mt-2 pt-2 border-t border-zinc-200">
              <button onclick="dispatchDirectToDevice('${escapeHtml(d.device_id)}')" class="w-full py-1 bg-zinc-900 text-white rounded text-center font-bold text-[11px]">Send Direct Alert</button>
            </div>
          </div>
        `;

        if (mapMarkers[key]) {
          mapMarkers[key].setLatLng([lat, lon]);
          mapMarkers[key].setPopupContent(popupHtml);
        } else {
          const marker = L.circleMarker([lat, lon], {
            radius: 8,
            fillColor: color,
            color: '#ffffff',
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
      document.getElementById('dir-target-id').value = deviceId;
      document.getElementById('dir-priority').value = 'URGENT';
      document.getElementById('dir-msg-type').value = 'ALERT';
      openDirectiveModal();
    }

    function renderDirectivesTable() {
      const tbody = document.getElementById('directives-table-body');
      if (allDirectives.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-zinc-400">No directives or alerts sent yet. Click "+ New Directive" to broadcast.</td></tr>';
        return;
      }

      tbody.innerHTML = allDirectives.map(d => {
        let pClass = 'bg-zinc-100 text-zinc-700';
        if (d.priority === 'CRITICAL') pClass = 'bg-red-50 text-red-700 border-red-200';
        else if (d.priority === 'URGENT') pClass = 'bg-amber-50 text-amber-700 border-amber-200';
        else if (d.priority === 'NORMAL') pClass = 'bg-sky-50 text-sky-700 border-sky-200';

        const createdStr = d.created_at ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
        const acks = d.acks || [];
        const actionedCount = acks.filter(a => a.status === 'ACTIONED').length;
        const deliveredCount = acks.filter(a => a.status === 'DELIVERED').length;

        let ackPill = `<span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded border bg-zinc-100 text-zinc-600">Pending Receipt (0)</span>`;
        if (actionedCount > 0) {
          ackPill = `<span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded border bg-emerald-50 text-emerald-700 border-emerald-200">✓✓ Actioned (${actionedCount})</span>`;
        } else if (deliveredCount > 0) {
          ackPill = `<span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded border bg-blue-50 text-blue-700 border-blue-200">✓ Delivered (${deliveredCount})</span>`;
        }

        const acksDetail = acks.map(a => 
          `<div class="text-[11px] font-mono text-zinc-600 mt-1 bg-zinc-50 p-1.5 rounded border border-zinc-200">
             <div class="font-bold text-zinc-800">[${escapeHtml(a.status)}] ${escapeHtml(a.technician_id)} (${escapeHtml(a.device_id)}) @ ${new Date(a.ack_at).toLocaleTimeString()}</div>
             ${a.client_notes ? '<div class="text-zinc-600 mt-0.5 italic">"' + escapeHtml(a.client_notes) + '"</div>' : ''}
           </div>`
        ).join('');

        return `<tr class="hover:bg-zinc-50 transition">
          <td class="p-3 text-xs font-mono text-zinc-500">${createdStr}</td>
          <td class="p-3 text-xs">
            <span class="inline-flex px-2 py-0.5 rounded border text-[11px] font-semibold ${pClass}">${escapeHtml(d.priority)}</span>
            <span class="text-zinc-500 font-mono text-[11px] ml-1">${escapeHtml(d.message_type)}</span>
          </td>
          <td class="p-3 text-xs font-mono font-medium text-zinc-900">${escapeHtml(d.target_type)}: ${escapeHtml(d.target_id)}</td>
          <td class="p-3 text-xs">
            <div class="font-bold text-zinc-900">${escapeHtml(d.title)}</div>
            <div class="text-zinc-600 text-xs mt-0.5">${escapeHtml(d.body)}</div>
          </td>
          <td class="p-3 text-xs">
            ${ackPill}
            ${acksDetail}
          </td>
        </tr>`;
      }).join('');
    }

    function openDetailModal(id) {
      const item = allData.find(d => d.id === id);
      if (!item) return;

      document.getElementById('modal-meter-title').textContent = `${item.meter_serial_number || 'UNKNOWN METER'} &bull; ${item.id}`;
      document.getElementById('modal-meta-subtitle').textContent = `Ingested: ${item.ingested_at || item.timestamp_utc || '—'}`;

      const photo = item.photos && item.photos.length > 0 ? item.photos[0].file_path : null;
      const imgElem = document.getElementById('detail-modal-img');
      if (photo) {
        imgElem.src = photo;
        imgElem.style.display = 'block';
        document.getElementById('detail-photo-caption').textContent = photo.split('/').pop();
      } else {
        imgElem.style.display = 'none';
        document.getElementById('detail-photo-caption').textContent = 'No photo uploaded for this inspection';
      }

      document.getElementById('detail-edge-kwh').textContent = item.kwh_reading != null ? `${Number(item.kwh_reading).toFixed(1)} kWh` : 'null (Missing)';
      document.getElementById('detail-vlm-kwh').textContent = item.vlm_kwh != null ? `${Number(item.vlm_kwh).toFixed(1)} kWh (${Math.round((item.vlm_confidence || 0) * 100)}% conf)` : 'None detected';

      let rBadge = '<span class="text-zinc-400">Not Reconciled</span>';
      if (item.audit_stage === 'VLM_VERIFIED') {
        rBadge = '<span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded bg-teal-50 text-teal-700 border border-teal-200">✓✓ Match & Reconciled</span>';
      } else if (item.audit_stage === 'MISMATCH_FLAGGED') {
        rBadge = '<span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded bg-amber-50 text-amber-700 border border-amber-200">⚠ Discrepancy Flagged</span>';
      } else if (item.audit_stage === 'IMAGE_RECEIVED') {
        rBadge = '<span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded bg-sky-50 text-sky-700 border border-sky-200">✓ Image Received</span>';
      }
      document.getElementById('detail-reconcile-badge').innerHTML = rBadge;

      let stClass = 'text-zinc-700 font-bold';
      if (item.qa_status === 'PASS') stClass = 'text-emerald-600 font-bold';
      else if (item.qa_status === 'WARNING') stClass = 'text-amber-600 font-bold';
      else if (item.qa_status === 'CRITICAL_HAZARD') stClass = 'text-red-600 font-bold';
      document.getElementById('detail-edge-status').innerHTML = `<span class="${stClass}">${escapeHtml(item.qa_status)}</span> ${item.hazard_reason ? '(' + escapeHtml(item.hazard_reason) + ')' : ''}`;

      document.getElementById('detail-vlm-summary').textContent = item.vlm_summary || 'No AI summary generated for this record.';
      document.getElementById('detail-vlm-notes').textContent = item.vlm_notes ? `Notes: ${item.vlm_notes}` : '';

      const tagsElem = document.getElementById('detail-vlm-tags');
      tagsElem.innerHTML = '';
      if (item.vlm_tags) {
        item.vlm_tags.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
          const span = document.createElement('span');
          span.className = 'px-2 py-0.5 text-[11px] font-medium bg-zinc-200 text-zinc-800 rounded';
          span.textContent = tag;
          tagsElem.appendChild(span);
        });
      }

      document.getElementById('detail-attr-tech').textContent = item.technician_id || 'UNKNOWN';
      document.getElementById('detail-attr-device').textContent = item.device_id || 'UNKNOWN';
      document.getElementById('detail-attr-model').textContent = item.device_model || 'Android Field Device';
      document.getElementById('detail-attr-ver').textContent = item.app_version || '1.0.0';

      const lat = item.latitude != null ? Number(item.latitude).toFixed(5) : null;
      const lon = item.longitude != null ? Number(item.longitude).toFixed(5) : null;
      if (lat && lon) {
        document.getElementById('detail-attr-geo').innerHTML = `<a href="https://maps.google.com/?q=${lat},${lon}" target="_blank" class="text-blue-600 hover:underline">${lat}, ${lon} ↗</a>`;
      } else {
        document.getElementById('detail-attr-geo').textContent = '—';
      }

      document.getElementById('detail-modal').classList.remove('hidden');
    }

    function closeDetailModal() { document.getElementById('detail-modal').classList.add('hidden'); }
    function openDirectiveModal() { document.getElementById('directive-modal').classList.remove('hidden'); }
    function closeDirectiveModal() { document.getElementById('directive-modal').classList.add('hidden'); }

    function updateTargetInput() {
      const type = document.getElementById('dir-target-type').value;
      const input = document.getElementById('dir-target-id');
      if (type === 'BROADCAST') input.value = 'ALL';
      else if (type === 'TECHNICIAN' && input.value === 'ALL') input.value = 'TECH-01';
      else if (type === 'DEVICE' && input.value === 'ALL') input.value = 'dev_android_01';
    }

    async function submitDirective(e) {
      e.preventDefault();
      const btn = document.getElementById('dir-submit-btn');
      btn.disabled = true;
      btn.textContent = 'Dispatching...';

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
        alert('Failed to dispatch directive: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Dispatch Now';
      }
    }

    async function confirmResetData() {
      if (!confirm("Are you sure you want to purge all dummy/test inspection records, messages, and device telemetry?")) return;
      try {
        const res = await fetch('/api/v1/admin/reset-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: 'RESET_ALL_DATA' })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        alert('All server data reset cleanly!');
        await refreshAll();
      } catch (err) {
        alert('Reset failed: ' + err.message);
      }
    }

    // Connect admin WebSocket for real-time fleet & ACK events
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
      }
    });

    setupAdminWebSocket();
    refreshAll();
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
