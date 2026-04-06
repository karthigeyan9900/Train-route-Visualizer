// ===== MAP SETUP =====
const map = L.map('map', { center: [22, 80], zoom: 5, zoomControl: false });

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CartoDB',
  subdomains: 'abcd', maxZoom: 19
}).addTo(map);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// ===== STATE =====
let activeRegion = 'All';
let selectedIdx  = null;
let routeLayers  = [];
let stopLayers   = [];
let visibleIndices = [];

const layerGroup = L.layerGroup().addTo(map);

// ===== HELPERS =====
function arc(a, b, n = 60, curve = 0.22) {
  const pts = [];
  const dx = b[1] - a[1], dy = b[0] - a[0];
  const mx = (a[0] + b[0]) / 2 - dx * curve * 0.5;
  const my = (a[1] + b[1]) / 2 + dy * curve * 0.5;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([(1-t)*(1-t)*a[0] + 2*(1-t)*t*mx + t*t*b[0],
              (1-t)*(1-t)*a[1] + 2*(1-t)*t*my + t*t*b[1]]);
  }
  return pts;
}

function duration(dep, arr) {
  const [dh, dm] = dep.split(':').map(Number);
  let [ah, am] = arr.split(':').map(Number);
  let mins = (ah * 60 + am) - (dh * 60 + dm);
  if (mins < 0) mins += 24 * 60;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function makeEndMarker(latlng, color, label) {
  return L.circleMarker(latlng, {
    radius: 5, color: '#fff', weight: 1.5,
    fillColor: color, fillOpacity: 1, zIndexOffset: 100
  }).bindTooltip(`<b>${label}</b>`, { direction: 'top', offset: [0, -6] });
}

function makeStopMarker(latlng, color, stop) {
  return L.circleMarker(latlng, {
    radius: 4, color: color, weight: 1.5,
    fillColor: color, fillOpacity: 0.65, zIndexOffset: 80
  }).bindTooltip(
    `<b>${stop.name}</b><br>Arr: ${stop.arr} &nbsp;·&nbsp; Dep: ${stop.dep}`,
    { direction: 'top', offset: [0, -5] }
  );
}

// ===== CLEAR STOP MARKERS =====
function clearStopLayers() {
  stopLayers.forEach(l => layerGroup.removeLayer(l));
  stopLayers = [];
}

// ===== DRAW STOP MARKERS =====
function drawStopMarkers(train) {
  clearStopLayers();
  if (!train.stops || !train.stops.length) return;
  const color = regionColors[train.region];
  train.stops.forEach(stop => {
    const coords = stationCoords[stop.name];
    if (!coords) return;
    const m = makeStopMarker(coords, color, stop);
    layerGroup.addLayer(m);
    stopLayers.push(m);
  });
}

// ===== BUILD ROUTE LAYERS =====
function buildLayers(indices) {
  layerGroup.clearLayers();
  routeLayers = [];
  stopLayers  = [];

  indices.forEach(idx => {
    const t = trains[idx];
    const fc = stationCoords[t.from];
    const tc = stationCoords[t.to];
    if (!fc || !tc) return;

    const color = regionColors[t.region];
    const isSel = (idx === selectedIdx);

    let line;

    if (t.stops && t.stops.length) {
      const waypoints = [fc];
      t.stops.forEach(s => { const c = stationCoords[s.name]; if (c) waypoints.push(c); });
      waypoints.push(tc);
      line = L.polyline(waypoints, {
        color, weight: isSel ? 3.5 : 1.8, opacity: isSel ? 1 : 0.4, smoothFactor: 1
      });
    } else {
      line = L.polyline(arc(fc, tc), {
        color, weight: isSel ? 3.5 : 1.8, opacity: isSel ? 1 : 0.4, smoothFactor: 1
      });
    }

    const fm = makeEndMarker(fc, color, t.from);
    const tm = makeEndMarker(tc, color, t.to);

    line.on('click', () => selectTrain(idx));
    fm.on('click',   () => selectTrain(idx));
    tm.on('click',   () => selectTrain(idx));
    line.on('mouseover', function() { if (idx !== selectedIdx) this.setStyle({ weight: 2.8, opacity: 0.8 }); });
    line.on('mouseout',  function() { if (idx !== selectedIdx) this.setStyle({ weight: 1.8, opacity: 0.4 }); });

    layerGroup.addLayer(line);
    layerGroup.addLayer(fm);
    layerGroup.addLayer(tm);
    routeLayers.push({ line, fm, tm, idx });
  });

  // Draw stop markers on top for selected train
  if (selectedIdx !== null && indices.includes(selectedIdx)) {
    drawStopMarkers(trains[selectedIdx]);
  }
}


// ===== SIDEBAR =====
const listEl = document.getElementById('train-list');
const vcEl   = document.getElementById('vc');
const cnEl   = document.getElementById('cn');

function renderList(indices) {
  vcEl.textContent = indices.length;
  cnEl.textContent = indices.length;

  if (!indices.length) {
    listEl.innerHTML = '<div class="no-res">No trains found</div>';
    return;
  }

  listEl.innerHTML = indices.map(idx => {
    const t = trains[idx];
    const color = regionColors[t.region];
    const stopCount = (t.stops || []).length;
    return `
      <div class="tc ${idx === selectedIdx ? 'sel' : ''}" data-idx="${idx}"
           style="border-left-color:${color}">
        <div class="tc-top">
          <div class="tc-name">${t.name}</div>
          <div class="tc-no">#${t.no}</div>
        </div>
        <div class="tc-route">
          <span class="tc-st">${t.from}</span>
          <span class="tc-arr">→</span>
          <span class="tc-st">${t.to}</span>
        </div>
        <div class="tc-meta">
          <div class="dot" style="background:${color}"></div>
          <span class="tc-dist">${t.region} · ${t.dist} km · ${duration(t.dep, t.arr)}${stopCount ? ' · '+stopCount+' stops' : ''}</span>
        </div>
      </div>`;
  }).join('');

  listEl.querySelectorAll('.tc').forEach(el => {
    el.addEventListener('click', () => selectTrain(+el.dataset.idx));
  });
}

// ===== INFO PANEL =====
function fillInfoPanel(t) {
  document.getElementById('i-name').textContent = t.name;
  document.getElementById('i-no').textContent   = `Train #${t.no}`;
  document.getElementById('i-fs').textContent   = t.from;
  document.getElementById('i-fd').textContent   = `Dep: ${t.dep}`;
  document.getElementById('i-ts').textContent   = t.to;
  document.getElementById('i-td').textContent   = `Arr: ${t.arr}`;
  document.getElementById('i-dist').textContent = `${t.dist} km`;
  document.getElementById('i-dur').textContent  = duration(t.dep, t.arr);
  document.getElementById('i-reg').textContent  = t.region;
  document.getElementById('i-tn').textContent   = t.no;

  // Stops list
  const stopsSection = document.getElementById('stops-section');
  const stopsList    = document.getElementById('stops-list');
  const color        = regionColors[t.region];

  if (t.stops && t.stops.length) {
    stopsSection.style.display = 'block';
    document.getElementById('stops-count').textContent = `Stops (${t.stops.length})`;
    stopsList.innerHTML = t.stops.map(s => `
      <div class="stop-row">
        <div class="stop-dot" style="background:${color}"></div>
        <div class="stop-info">
          <div class="stop-name">${s.name}</div>
          <div class="stop-time">${s.arr} → ${s.dep}</div>
        </div>
      </div>`).join('');
  } else {
    stopsSection.style.display = 'none';
  }

  document.getElementById('info').classList.add('show');
}

// ===== SELECT =====
function selectTrain(idx) {
  if (selectedIdx === idx) {
    selectedIdx = null;
    document.getElementById('info').classList.remove('show');
    clearStopLayers();
    refresh();
    return;
  }
  selectedIdx = idx;
  refresh();

  const card = listEl.querySelector(`[data-idx="${idx}"]`);
  if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  const t  = trains[idx];
  const fc = stationCoords[t.from];
  const tc = stationCoords[t.to];
  if (fc && tc) map.fitBounds(L.latLngBounds([fc, tc]).pad(0.25), { animate: true, duration: 0.6 });

  fillInfoPanel(t);
}

// ===== FILTER =====
function getFiltered(query, region) {
  const q = query.toLowerCase();
  return trains.reduce((acc, t, i) => {
    const matchR = region === 'All' || t.region === region;
    const matchQ = !q ||
      t.name.toLowerCase().includes(q) ||
      t.no.includes(q) ||
      t.from.toLowerCase().includes(q) ||
      t.to.toLowerCase().includes(q);
    if (matchR && matchQ) acc.push(i);
    return acc;
  }, []);
}

function refresh() {
  visibleIndices = getFiltered(document.getElementById('q').value, activeRegion);
  buildLayers(visibleIndices);
  renderList(visibleIndices);
}

// ===== EVENTS =====
document.getElementById('q').addEventListener('input', () => {
  selectedIdx = null;
  document.getElementById('info').classList.remove('show');
  clearStopLayers();
  refresh();
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeRegion = chip.dataset.r;
    selectedIdx  = null;
    document.getElementById('info').classList.remove('show');
    clearStopLayers();
    refresh();
  });
});

document.getElementById('xbtn').addEventListener('click', () => {
  selectedIdx = null;
  document.getElementById('info').classList.remove('show');
  clearStopLayers();
  refresh();
});

// ===== INIT =====
refresh();
