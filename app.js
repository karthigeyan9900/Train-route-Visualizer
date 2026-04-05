// ===== MAP SETUP =====
const map = L.map('map', { center: [22, 80], zoom: 5, zoomControl: false });

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CartoDB',
  subdomains: 'abcd', maxZoom: 19
}).addTo(map);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// ===== STATE =====
let activeRegion = 'All';
let selectedIdx = null;
let routeLayers = [];   // { line, fromMarker, toMarker, idx }
let visibleIndices = [];

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

function makeMarker(latlng, color, label) {
  return L.circleMarker(latlng, {
    radius: 5, color: '#fff', weight: 1.5,
    fillColor: color, fillOpacity: 1,
    zIndexOffset: 100
  }).bindTooltip(`<b>${label}</b>`, { direction: 'top', offset: [0, -6] });
}

// ===== BUILD ROUTES =====
const layerGroup = L.layerGroup().addTo(map);

function buildLayers(indices) {
  layerGroup.clearLayers();
  routeLayers = [];

  indices.forEach(idx => {
    const t = trains[idx];
    const fc = stationCoords[t.from];
    const tc = stationCoords[t.to];
    if (!fc || !tc) return;

    const color = regionColors[t.region];
    const isSelected = (idx === selectedIdx);

    const line = L.polyline(arc(fc, tc), {
      color, weight: isSelected ? 3.5 : 1.8,
      opacity: isSelected ? 1 : 0.45,
      smoothFactor: 1
    });

    const fm = makeMarker(fc, color, t.from);
    const tm = makeMarker(tc, color, t.to);

    line.on('click', () => selectTrain(idx));
    fm.on('click', () => selectTrain(idx));
    tm.on('click', () => selectTrain(idx));

    line.on('mouseover', function() {
      if (idx !== selectedIdx) this.setStyle({ weight: 2.8, opacity: 0.85 });
    });
    line.on('mouseout', function() {
      if (idx !== selectedIdx) this.setStyle({ weight: 1.8, opacity: 0.45 });
    });

    layerGroup.addLayer(line);
    layerGroup.addLayer(fm);
    layerGroup.addLayer(tm);

    routeLayers.push({ line, fm, tm, idx });
  });
}

// ===== SIDEBAR RENDER =====
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
    const isSel = idx === selectedIdx;
    return `
      <div class="tc ${isSel ? 'sel' : ''}" data-idx="${idx}"
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
          <span class="tc-dist">${t.region} · ${t.dist} km · ${duration(t.dep, t.arr)}</span>
        </div>
      </div>`;
  }).join('');

  // attach click
  listEl.querySelectorAll('.tc').forEach(el => {
    el.addEventListener('click', () => selectTrain(+el.dataset.idx));
  });
}

// ===== SELECT =====
function selectTrain(idx) {
  if (selectedIdx === idx) {
    // deselect
    selectedIdx = null;
    document.getElementById('info').classList.remove('show');
    refresh();
    return;
  }
  selectedIdx = idx;
  refresh();

  // scroll card into view
  const card = listEl.querySelector(`[data-idx="${idx}"]`);
  if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  // zoom to route
  const t = trains[idx];
  const fc = stationCoords[t.from];
  const tc = stationCoords[t.to];
  if (fc && tc) {
    const bounds = L.latLngBounds([fc, tc]).pad(0.25);
    map.fitBounds(bounds, { animate: true, duration: 0.6 });
  }

  // fill info panel
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
  document.getElementById('info').classList.add('show');
}

// ===== FILTER =====
function getFiltered(query, region) {
  const q = query.toLowerCase();
  return trains.reduce((acc, t, i) => {
    const matchR = region === 'All' || t.region === region;
    const matchQ = !q || t.name.toLowerCase().includes(q)
                       || t.no.includes(q)
                       || t.from.toLowerCase().includes(q)
                       || t.to.toLowerCase().includes(q);
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
  refresh();
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeRegion = chip.dataset.r;
    selectedIdx = null;
    document.getElementById('info').classList.remove('show');
    refresh();
  });
});

document.getElementById('xbtn').addEventListener('click', () => {
  selectedIdx = null;
  document.getElementById('info').classList.remove('show');
  refresh();
});

// ===== INIT =====
refresh();
