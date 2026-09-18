/* FlushStar Quantum 25 — companion app demo.
 *
 * Everything here talks to a simulated unit. The point of the demo is to settle
 * how the app should look and behave before anyone spends money on putting a
 * radio in the machine. When real hardware exists, only `Unit` below gets
 * replaced — it is deliberately the single seam between the interface and the
 * device, so the screens do not need rewriting.
 *
 * Cycle timings, stage order, pressure/flow/current figures and the fault
 * behaviours are plausible placeholders. They need checking against the real
 * Quantum 25 before any of this is presented as accurate.
 */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ─── persisted demo state ────────────────────────────────────── */
const STORE = 'flushstar.demo.v1';
const defaults = () => ({
  engines: 4,
  cycles: 127,
  runtimeMin: 5240,
  history: [
    { t: Date.now() - 864e5 * 2,  dur: 248, engines: 4, result: 'ok' },
    { t: Date.now() - 864e5 * 5,  dur: 251, engines: 4, result: 'ok' },
    { t: Date.now() - 864e5 * 9,  dur: 96,  engines: 4, result: 'abort' },
    { t: Date.now() - 864e5 * 12, dur: 244, engines: 4, result: 'ok' },
  ],
});

let state = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch { return defaults(); }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {}
}

/* ─── the seam: swap this for real BLE ────────────────────────── */
const Unit = {
  // Stage lengths in seconds. Real figures TBC against the hardware.
  stages: [
    { key: 'purge', label: 'Purge', secs: 45 },
    { key: 'flush', label: 'Flush', secs: 150 },
    { key: 'drain', label: 'Drain', secs: 55 },
  ],
  totalSecs() { return this.stages.reduce((n, s) => n + s.secs, 0); },
};

/* ─── helpers ─────────────────────────────────────────────────── */
const pad = n => String(n).padStart(2, '0');
const mmss = s => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;

function ago(t) {
  const m = Math.round((Date.now() - t) / 6e4);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
function dateLabel(t) {
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
       + ' · ' + new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
const jitter = (base, spread) => (base + (Math.random() - 0.5) * spread);

/* ─── connect screen ──────────────────────────────────────────── */
function startScan() {
  const list = $('#deviceList');
  const radar = $('#radar');
  const label = $('#scanLabel');
  list.innerHTML = '';
  radar.classList.remove('found');
  label.classList.remove('done');
  label.textContent = 'Searching for nearby systems';
  $('#rescanBtn').hidden = true;

  setTimeout(() => {
    radar.classList.add('found');
    label.classList.add('done');
    label.textContent = '1 system found';
    list.innerHTML = `
      <button class="device" id="devBtn">
        <span class="device-ico">&#9678;</span>
        <span>
          <b>QUANTUM 25</b>
          <small>QS-0442 · paired</small>
        </span>
        <span class="rssi"><i></i><i></i><i></i><i></i></span>
      </button>`;
    $('#devBtn').addEventListener('click', connect);
    $('#rescanBtn').hidden = false;
  }, 2200);
}

function connect() {
  $('#s-connect').classList.remove('is-active');
  $('#s-main').classList.add('is-active');
  render();
}

function disconnect() {
  if (running) abortCycle(true);
  $('#s-main').classList.remove('is-active');
  $('#s-connect').classList.add('is-active');
  startScan();
}

/* ─── dashboard render ────────────────────────────────────────── */
function render() {
  const n = state.engines;

  $('#engines').innerHTML = Array.from({ length: n }, (_, i) => {
    const bad = i === faultEngine;
    return `<div class="eng ${bad ? 'err' : 'ok'}"><b>${bad ? '&#10005;' : '&#10003;'}</b>`
         + `<small>ENG ${i + 1}</small></div>`;
  }).join('');

  const last = state.history[0];
  $('#lastFlush').textContent   = last ? ago(last.t) : '—';
  $('#totalCycles').textContent = state.cycles.toLocaleString();
  $('#runtime').textContent     = `${Math.round(state.runtimeMin / 60)}h`;

  const due = $('#simService').checked;
  $('#nextService').textContent = due ? 'Due now' : `${900 - (state.cycles % 900)} cycles`;

  $('#sysEngines').textContent = n;
  $('#sysCycles').textContent  = state.cycles.toLocaleString();
  $('#sysRuntime').textContent = `${Math.round(state.runtimeMin / 60)}h`;

  const box = $('#alertBox');
  if (due) {
    box.hidden = false;
    box.className = 'alert';
    box.innerHTML = '<b>Service due</b>Inspect the inlet filter and check hose seals. Clear this from the unit once done.';
  } else {
    box.hidden = true;
  }

  renderHistory();
  setStatus('ready');
}

function setStatus(mode, sub) {
  const card = $('#statusCard'), val = $('#statusValue'), dot = $('#linkDot');
  card.classList.remove('busy', 'fault');
  dot.classList.remove('busy', 'fault');
  if (mode === 'ready') {
    val.textContent = 'READY';
    $('#statusSub').textContent = sub || `${state.engines} engines detected · water supply OK`;
  } else if (mode === 'busy') {
    card.classList.add('busy'); dot.classList.add('busy');
    val.textContent = 'FLUSHING';
    $('#statusSub').textContent = sub || 'Cycle in progress';
  } else {
    card.classList.add('fault'); dot.classList.add('fault');
    val.textContent = 'FAULT';
    $('#statusSub').textContent = sub || 'Cycle stopped';
  }
}

function renderHistory() {
  const el = $('#history');
  if (!state.history.length) { el.innerHTML = '<p class="empty">No cycles recorded yet.</p>'; return; }
  el.innerHTML = state.history.map(h => {
    const cls = h.result === 'ok' ? '' : (h.result === 'abort' ? 'abort' : 'err');
    const tag = h.result === 'ok' ? 'Complete' : (h.result === 'abort' ? 'Aborted' : 'Fault');
    return `<div class="h-row ${cls}">
      <span class="h-main"><b>${dateLabel(h.t)}</b><small>${mmss(h.dur)} · ${h.engines} engines</small></span>
      <span class="h-res">${tag}</span>
    </div>`;
  }).join('');
}

/* ─── the cycle ───────────────────────────────────────────────── */
let running = false, timer = null, t0 = 0, speed = 1;
// Which engine failed on the last cycle, so the dashboard strip agrees with
// the fault message. -1 means all good.
let faultEngine = -1;

function startCycle() {
  const n = state.engines;
  const outcome = $('#simOutcome').value;
  const failAt = outcome === 'ok' ? -1 : Math.floor(Math.random() * n);

  faultEngine = -1;
  running = true;
  t0 = Date.now();
  // A real cycle is over four minutes and the engines run one after another, so
  // a fault on engine 4 would not surface for two of them. Nobody watches that
  // in a demo, hence the speed multiplier. It only scales the clock — the stage
  // order, the sequencing and the failure points are unchanged.
  speed = +($('#simSpeed')?.value || 1);
  showTab('t-run', false);
  $('.tabbar').classList.add('hidden');
  setStatus('busy');

  $('#runEngines').innerHTML = Array.from({ length: n }, (_, i) =>
    `<div class="re" id="re${i}">
       <div class="re-top"><b>Engine ${i + 1}</b><small>waiting</small></div>
       <div class="re-bar"><span class="re-fill"></span></div>
     </div>`).join('');

  // "No water supply" is caught before anything opens, which is what the real
  // unit should do — it is a pre-flight check, not a mid-cycle failure.
  if (outcome === 'nowater') {
    setTimeout(() => failCycle('No water supply detected. Check the hose is connected and the tap is on.', -1), 1800 / speed);
    return;
  }

  const total = Unit.totalSecs();
  timer = setInterval(() => {
    const el = ((Date.now() - t0) / 1000) * speed;
    if (el >= total) return finishCycle();

    $('#runElapsed').textContent = mmss(el);
    $('#runRemain').textContent  = `~${mmss(total - el)} left`;

    // stage rail
    let acc = 0, current = Unit.stages[0];
    for (const s of Unit.stages) {
      const within = el >= acc && el < acc + s.secs;
      const done = el >= acc + s.secs;
      const node = $(`.stage[data-stage="${s.key}"]`);
      node.classList.toggle('on', within);
      node.classList.toggle('done', done);
      if (within) current = s;
      acc += s.secs;
    }
    $('#runStage').textContent = current.label;

    // gauges — idle during purge, working during flush, falling away in drain
    const phase = current.key;
    $('#pressure').textContent = (phase === 'flush' ? jitter(2.6, .3) : phase === 'purge' ? jitter(1.1, .2) : jitter(0.4, .2)).toFixed(1);
    $('#flow').textContent     = (phase === 'flush' ? jitter(11.5, 1.2) : phase === 'purge' ? jitter(6, 1) : jitter(1.5, .6)).toFixed(1);
    $('#draw').textContent     = (phase === 'drain' ? jitter(1.2, .2) : jitter(3.4, .4)).toFixed(1);

    // engines run in sequence, not together — one water supply
    const per = total / n;
    for (let i = 0; i < n; i++) {
      const re = $(`#re${i}`), fill = $('.re-fill', re), lab = $('small', re);
      const p = Math.max(0, Math.min(1, (el - i * per) / per));

      if (i === failAt && p > 0.45) {
        clearInterval(timer);
        return failCycle(`Engine ${i + 1} is not taking water. Likely a blocked inlet or a kinked hose on that engine.`, i);
      }
      fill.style.width = (p * 100).toFixed(1) + '%';
      re.classList.toggle('done', p >= 1);
      lab.textContent = p >= 1 ? 'done' : p > 0 ? `${Math.round(p * 100)}%` : 'waiting';
    }
  }, 250);
}

function stopTimer() { clearInterval(timer); timer = null; running = false; }

function finishCycle() {
  stopTimer();
  const dur = Math.round(Unit.totalSecs());
  state.cycles += 1;
  state.runtimeMin += Math.round(dur / 60);
  state.history.unshift({ t: Date.now(), dur, engines: state.engines, result: 'ok' });
  state.history = state.history.slice(0, 25);
  save();
  $('.tabbar').classList.remove('hidden');
  showTab('t-dash');
  render();
  setStatus('ready', 'Cycle complete · system flushed and drained');
}

function failCycle(msg, engIdx) {
  stopTimer();
  faultEngine = engIdx;
  const dur = Math.round(((Date.now() - t0) / 1000) * speed);
  state.history.unshift({ t: Date.now(), dur, engines: state.engines, result: 'fault' });
  state.history = state.history.slice(0, 25);
  save();

  if (engIdx >= 0) {
    const re = $(`#re${engIdx}`);
    if (re) { re.classList.add('err'); $('small', re).textContent = 'no flow'; }
  }

  $('.tabbar').classList.remove('hidden');
  showTab('t-dash');
  render();
  setStatus('fault', 'Cycle stopped before completion');

  const box = $('#alertBox');
  box.hidden = false;
  box.className = 'alert bad';
  box.innerHTML = `<b>Cycle failed</b>${msg}`;
}

function abortCycle(silent) {
  if (!running) return;
  stopTimer();
  const dur = Math.round(((Date.now() - t0) / 1000) * speed);
  state.history.unshift({ t: Date.now(), dur, engines: state.engines, result: 'abort' });
  state.history = state.history.slice(0, 25);
  save();
  $('.tabbar').classList.remove('hidden');
  if (!silent) {
    showTab('t-dash');
    render();
    setStatus('ready', 'Cycle aborted · system drained');
  }
}

/* ─── navigation ──────────────────────────────────────────────── */
function showTab(id, markBtn = true) {
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.id === id));
  if (markBtn) $$('.tab-btn').forEach(b => b.classList.toggle('is-active', b.dataset.tab === id));
}

/* ─── wiring ──────────────────────────────────────────────────── */
$$('.tab-btn').forEach(b => b.addEventListener('click', () => {
  if (running) return;           // don't let them wander off mid-cycle
  showTab(b.dataset.tab);
}));

$('#startBtn').addEventListener('click', startCycle);
$('#abortBtn').addEventListener('click', () => abortCycle(false));
$('#disconnectBtn').addEventListener('click', disconnect);
$('#rescanBtn').addEventListener('click', startScan);
$('#bannerHide').addEventListener('click', () => $('#demoBanner').remove());

$('#simEngines').addEventListener('change', e => {
  state.engines = +e.target.value; save(); render();
});
$('#simService').addEventListener('change', render);
$('#simReset').addEventListener('click', () => {
  state = defaults(); save();
  $('#simEngines').value = String(state.engines);
  $('#simService').checked = false;
  $('#simOutcome').value = 'ok';
  render();
  showTab('t-dash');
});

// Voltage wanders a little, the way a real 12V boat supply does.
setInterval(() => {
  const v = jitter(12.6, .25).toFixed(1) + 'V';
  $('#voltage').textContent = v;
  $('#sysVolt').textContent = v;
}, 3000);

$('#simEngines').value = String(state.engines);
startScan();
