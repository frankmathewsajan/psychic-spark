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
# Live Web Admin Dashboard (Shadcn-inspired minimalist styling)
# ---------------------------------------------------------------------------
ADMIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo Admin &bull; Inspections</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            border: '#e4e4e7',
            background: '#ffffff',
            foreground: '#09090b',
            muted: '#71717a',
            card: '#ffffff',
            pass: '#16a34a',
            warn: '#d97706',
            crit: '#dc2626'
          }
        }
      }
    }
  </script>
</head>
<body class="bg-zinc-50 text-zinc-950 font-sans antialiased min-h-screen">
  <div class="max-w-6xl mx-auto px-4 py-8">
    
    <!-- HEADER -->
    <header class="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-200 gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Inspections Dashboard</h1>
        <p class="text-sm text-zinc-500 mt-1">Live field audit verification SSOT</p>
      </div>
      <div class="flex items-center gap-3">
        <span id="live-indicator" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Live (5s)
        </span>
        <button onclick="fetchData()" class="px-3 py-1.5 text-xs font-medium bg-white hover:bg-zinc-100 text-zinc-800 rounded-md border border-zinc-200 transition">
          Refresh
        </button>
      </div>
    </header>

    <!-- METRICS CARDS -->
    <section class="grid grid-cols-2 md:grid-cols-5 gap-4 my-6">
      <div class="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
        <div class="text-xs font-medium text-zinc-500 uppercase tracking-wide">Total</div>
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
        <div class="text-xs font-medium text-amber-600 uppercase tracking-wide">Warnings</div>
        <div id="stat-warn" class="text-2xl font-bold text-amber-600 mt-1">0</div>
      </div>
      <div class="bg-white p-4 rounded-lg border border-zinc-200 shadow-sm">
        <div class="text-xs font-medium text-red-600 uppercase tracking-wide">Hazards</div>
        <div id="stat-crit" class="text-2xl font-bold text-red-600 mt-1">0</div>
      </div>
    </section>

    <!-- CONTROLS ROW -->
    <div class="flex flex-col sm:flex-row gap-3 mb-4 items-center justify-between">
      <input id="search-input" type="text" placeholder="Search Meter S/N..." oninput="renderTable()"
        class="w-full sm:w-72 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-900 placeholder-zinc-400">
      
      <div class="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto">
        <button onclick="setFilter('ALL')" id="filter-ALL" class="filter-btn px-3 py-1 text-xs font-medium rounded-md bg-zinc-900 text-white">All</button>
        <button onclick="setFilter('PASS')" id="filter-PASS" class="filter-btn px-3 py-1 text-xs font-medium rounded-md bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100">Pass</button>
        <button onclick="setFilter('VLM_VERIFIED')" id="filter-VLM_VERIFIED" class="filter-btn px-3 py-1 text-xs font-medium rounded-md bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100">VLM Verified</button>
        <button onclick="setFilter('WARNING')" id="filter-WARNING" class="filter-btn px-3 py-1 text-xs font-medium rounded-md bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100">Warning</button>
        <button onclick="setFilter('CRITICAL_HAZARD')" id="filter-CRITICAL_HAZARD" class="filter-btn px-3 py-1 text-xs font-medium rounded-md bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100">Hazard</button>
      </div>
    </div>

    <!-- TABLE -->
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
              <th class="p-3">Timestamp</th>
            </tr>
          </thead>
          <tbody id="table-body" class="divide-y divide-zinc-200 font-normal">
            <tr><td colspan="7" class="p-8 text-center text-zinc-400">Loading inspection records...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- MODAL FOR FULL IMAGE -->
  <div id="image-modal" class="hidden fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onclick="closeModal()">
    <div class="relative max-w-2xl max-h-[90vh] bg-zinc-900 rounded-lg overflow-hidden p-2" onclick="event.stopPropagation()">
      <img id="modal-img" src="" alt="Full inspection audit" class="max-h-[80vh] w-auto rounded object-contain mx-auto">
      <div class="text-right mt-2">
        <button onclick="closeModal()" class="px-3 py-1 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 rounded">Close</button>
      </div>
    </div>
  </div>

  <script>
    let allData = [];
    let activeFilter = 'ALL';

    function setFilter(filter) {
      activeFilter = filter;
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.className = 'filter-btn px-3 py-1 text-xs font-medium rounded-md bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100';
      });
      document.getElementById('filter-' + filter).className = 'filter-btn px-3 py-1 text-xs font-medium rounded-md bg-zinc-900 text-white';
      renderTable();
    }

    async function fetchData() {
      try {
        const res = await fetch('/api/v1/inspections');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        allData = await res.json();
        updateStats();
        renderTable();
      } catch (e) {
        console.error('Fetch error:', e);
      }
    }

    function updateStats() {
      document.getElementById('stat-total').textContent = allData.length;
      document.getElementById('stat-pass').textContent = allData.filter(d => d.qa_status === 'PASS').length;
      document.getElementById('stat-vlm').textContent = allData.filter(d => d.audit_stage === 'VLM_VERIFIED').length;
      document.getElementById('stat-warn').textContent = allData.filter(d => d.qa_status === 'WARNING' || d.audit_stage === 'MISMATCH_FLAGGED').length;
      document.getElementById('stat-crit').textContent = allData.filter(d => d.qa_status === 'CRITICAL_HAZARD').length;
    }

    function renderTable() {
      const q = (document.getElementById('search-input').value || '').toLowerCase().trim();
      const filtered = allData.filter(item => {
        let matchesFilter = true;
        if (activeFilter === 'VLM_VERIFIED') {
          matchesFilter = item.audit_stage === 'VLM_VERIFIED';
        } else if (activeFilter !== 'ALL') {
          matchesFilter = item.qa_status === activeFilter;
        }
        const matchesQuery = !q || (item.meter_serial_number || '').toLowerCase().includes(q) || (item.id || '').toLowerCase().includes(q);
        return matchesFilter && matchesQuery;
      });

      const tbody = document.getElementById('table-body');
      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-zinc-400">No records found.</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(item => {
        const photo = item.photos && item.photos.length > 0 ? item.photos[0].file_path : null;
        const photoHtml = photo 
          ? `<img src="${photo}" onclick="openModal('${photo}')" onerror="this.outerHTML='<div class=\\'w-10 h-10 rounded bg-zinc-100 flex items-center justify-center text-zinc-400 text-xs font-mono\\'>N/A</div>'" class="w-10 h-10 object-cover rounded border border-zinc-200 cursor-pointer hover:opacity-80 transition">`
          : `<div class="w-10 h-10 rounded bg-zinc-100 flex items-center justify-center text-zinc-400 text-xs font-mono">N/A</div>`;

        let statusClass = 'bg-zinc-100 text-zinc-700 border-zinc-200';
        if (item.qa_status === 'PASS') statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        else if (item.qa_status === 'WARNING') statusClass = 'bg-amber-50 text-amber-700 border-amber-200';
        else if (item.qa_status === 'CRITICAL_HAZARD') statusClass = 'bg-red-50 text-red-700 border-red-200';

        let auditHtml = '<span class="text-zinc-400 text-xs">—</span>';
        if (item.audit_stage === 'VLM_VERIFIED') {
          auditHtml = `<span class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded border bg-teal-50 text-teal-700 border-teal-200" title="${item.vlm_notes || 'Verified'}">✓✓ VLM Verified</span>`;
        } else if (item.audit_stage === 'MISMATCH_FLAGGED') {
          auditHtml = `<span class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded border bg-amber-50 text-amber-700 border-amber-200 cursor-help" title="${item.vlm_notes || 'Mismatch'}">⚠ Mismatch</span>`;
        } else if (item.audit_stage === 'IMAGE_RECEIVED') {
          auditHtml = '<span class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded border bg-sky-50 text-sky-700 border-sky-200">✓ Received</span>';
        } else if (item.audit_stage === 'VLM_SKIPPED') {
          auditHtml = `<span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border bg-zinc-100 text-zinc-500 border-zinc-200" title="${item.vlm_notes || ''}">Skipped</span>`;
        }

        const edgeKwhText = item.kwh_reading != null ? `${Number(item.kwh_reading).toFixed(1)} kWh` : '<span class="text-zinc-400">—</span>';
        const vlmKwhText = item.vlm_kwh != null 
          ? `<span class="font-medium text-teal-700" title="${item.vlm_summary || ''}">${Number(item.vlm_kwh).toFixed(1)} kWh</span>`
          : '<span class="text-zinc-400">—</span>';
        const timeText = item.ingested_at ? new Date(item.ingested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (item.timestamp_utc || '—');

        return `<tr class="hover:bg-zinc-50 transition">
          <td class="p-3">${photoHtml}</td>
          <td class="p-3 font-mono font-medium text-zinc-900">${item.meter_serial_number || 'UNKNOWN'}</td>
          <td class="p-3 font-medium">${edgeKwhText}</td>
          <td class="p-3">${vlmKwhText}</td>
          <td class="p-3">${auditHtml}</td>
          <td class="p-3">
            <span class="inline-flex px-2 py-0.5 text-xs font-semibold rounded border ${statusClass}">
              ${item.qa_status}
            </span>
          </td>
          <td class="p-3 text-zinc-500 text-xs font-mono">${timeText}</td>
        </tr>`;
      }).join('');
    }

    function openModal(url) {
      document.getElementById('modal-img').src = url;
      document.getElementById('image-modal').classList.remove('hidden');
    }

    function closeModal() {
      document.getElementById('image-modal').classList.add('hidden');
    }

    fetchData();
    setInterval(fetchData, 5000);
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
