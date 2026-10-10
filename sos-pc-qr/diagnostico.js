/**
 * SOS PC QR — Módulo Diagnóstico del Sistema
 * diagnostico.js  |  ES Module, cargado desde app.js
 *
 * Responsabilidades:
 *  - Mostrar instrucciones de uso de la herramienta local
 *  - Importar y validar el JSON generado por DiagnosticoTool.exe
 *  - Renderizar tarjetas de hardware (CPU, RAM, Almacenamiento, OS,
 *    Placa madre, GPU, Temperaturas)
 *  - Guardar diagnóstico en Supabase
 *  - Cargar historial de diagnósticos del equipo
 *  - Generar informe PDF con jsPDF
 */

// ──────────────────────────────────────────────────────────────
// Umbrales de alerta (°C)
// ──────────────────────────────────────────────────────────────
const THRESHOLDS = {
  cpu_temp:  { warn: 75, hot: 90 },
  gpu_temp:  { warn: 80, hot: 95 },
  disk_temp: { warn: 45, hot: 55 },
  cpu_load:  { warn: 80, hot: 95 },
  ram_pct:   { warn: 80, hot: 92 },
};

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const na = v => (v === null || v === undefined || v === '' || v === 'N/A')
  ? `<span class="diag-row-value na">No disponible</span>`
  : `<span class="diag-row-value">${esc(v)}</span>`;

function tempClass(val, key) {
  if (val === null || val === undefined) return 'ok';
  const t = THRESHOLDS[key];
  if (val >= t.hot)  return 'hot';
  if (val >= t.warn) return 'warn';
  return 'ok';
}

function pctClass(val, key) {
  if (val === null || val === undefined) return 'ok';
  const t = THRESHOLDS[key];
  if (val >= t.hot)  return 'hot';
  if (val >= t.warn) return 'warn';
  return 'ok';
}

function barHtml(label, pct, cssClass, unit = '%') {
  const p = Math.min(Math.max(pct ?? 0, 0), 100).toFixed(1);
  return `
    <div class="diag-bar-wrap">
      <div class="diag-bar-label"><span>${esc(label)}</span><span>${p}${unit}</span></div>
      <div class="diag-bar"><div class="diag-bar-fill ${cssClass}" style="width:${p}%"></div></div>
    </div>`;
}

function alertHtml(cls, icon, text) {
  return `<div class="diag-alert ${cls}">${icon} ${esc(text)}</div>`;
}

function badgeHtml(cls, icon, text) {
  return `<span class="diag-badge ${cls}">${icon} ${esc(text)}</span>`;
}

function fmtBytes(gb) {
  if (gb === null || gb === undefined) return null;
  return gb >= 1000 ? `${(gb / 1000).toFixed(1)} TB` : `${gb.toFixed(0)} GB`;
}

// ──────────────────────────────────────────────────────────────
// Renderizar tarjeta CPU
// ──────────────────────────────────────────────────────────────
function renderCPU(cpu) {
  if (!cpu) return '';
  const loadCls = pctClass(cpu.load_pct, 'cpu_load');
  const tempCls = tempClass(cpu.temp_c, 'cpu_temp');
  let alerts = '';
  if (cpu.load_pct >= THRESHOLDS.cpu_load.hot)
    alerts += alertHtml('hot', '🔥', `Utilización de CPU crítica: ${cpu.load_pct}%`);
  else if (cpu.load_pct >= THRESHOLDS.cpu_load.warn)
    alerts += alertHtml('warn', '⚠️', `Utilización de CPU elevada: ${cpu.load_pct}%`);
  if (cpu.temp_c >= THRESHOLDS.cpu_temp.hot)
    alerts += alertHtml('hot', '🌡️', `Temperatura de CPU crítica: ${cpu.temp_c}°C`);
  else if (cpu.temp_c >= THRESHOLDS.cpu_temp.warn)
    alerts += alertHtml('warn', '⚠️', `Temperatura de CPU elevada: ${cpu.temp_c}°C`);

  return `
  <div class="diag-card cpu">
    <div class="diag-card-header">
      <div class="diag-card-icon">🖥️</div>
      <div>
        <div class="diag-card-title">Procesador</div>
        <div class="diag-card-subtitle">${esc(cpu.name ?? 'CPU')}</div>
      </div>
    </div>
    <div class="diag-rows">
      <div class="diag-row"><span class="diag-row-label">Fabricante</span>${na(cpu.manufacturer)}</div>
      <div class="diag-row"><span class="diag-row-label">Modelo</span>${na(cpu.name)}</div>
      <div class="diag-row"><span class="diag-row-label">Núcleos / Hilos</span>${na(cpu.cores !== null ? `${cpu.cores}C / ${cpu.threads ?? '?'}T` : null)}</div>
      <div class="diag-row"><span class="diag-row-label">Frecuencia base</span>${na(cpu.freq_ghz !== null ? `${cpu.freq_ghz} GHz` : null)}</div>
      <div class="diag-row"><span class="diag-row-label">Temperatura</span>${na(cpu.temp_c !== null ? `${cpu.temp_c} °C` : null)}</div>
    </div>
    ${barHtml('Utilización', cpu.load_pct, loadCls)}
    ${barHtml('Temperatura', cpu.temp_c, tempCls, ' °C')}
    ${alerts}
  </div>`;
}

// ──────────────────────────────────────────────────────────────
// Renderizar tarjeta RAM
// ──────────────────────────────────────────────────────────────
function renderRAM(ram) {
  if (!ram) return '';
  const usedPct = ram.total_gb > 0 ? ((ram.used_gb / ram.total_gb) * 100) : 0;
  const cls = pctClass(usedPct, 'ram_pct');
  let alerts = '';
  if (usedPct >= THRESHOLDS.ram_pct.hot)
    alerts += alertHtml('hot', '🔥', `Memoria RAM casi agotada: ${usedPct.toFixed(0)}%`);
  else if (usedPct >= THRESHOLDS.ram_pct.warn)
    alerts += alertHtml('warn', '⚠️', `Uso de RAM elevado: ${usedPct.toFixed(0)}%`);

  const slots = (ram.modules ?? []).map(m =>
    `<span class="diag-ram-slot">${esc(m.capacity_gb ?? '?')} GB ${esc(m.type ?? '')} ${esc(m.speed_mhz ? m.speed_mhz + ' MHz' : '')}</span>`
  ).join('');

  return `
  <div class="diag-card ram">
    <div class="diag-card-header">
      <div class="diag-card-icon">🧮</div>
      <div>
        <div class="diag-card-title">Memoria RAM</div>
        <div class="diag-card-subtitle">${fmtBytes(ram.total_gb) ?? 'N/D'} total</div>
      </div>
    </div>
    <div class="diag-rows">
      <div class="diag-row"><span class="diag-row-label">Total</span>${na(fmtBytes(ram.total_gb))}</div>
      <div class="diag-row"><span class="diag-row-label">Usada</span>${na(fmtBytes(ram.used_gb))}</div>
      <div class="diag-row"><span class="diag-row-label">Disponible</span>${na(fmtBytes(ram.available_gb))}</div>
      <div class="diag-row"><span class="diag-row-label">Tipo</span>${na(ram.type)}</div>
      <div class="diag-row"><span class="diag-row-label">Velocidad</span>${na(ram.speed_mhz ? `${ram.speed_mhz} MHz` : null)}</div>
      <div class="diag-row"><span class="diag-row-label">Módulos</span>${na(ram.modules?.length ?? null)}</div>
    </div>
    ${barHtml('Uso de RAM', usedPct, cls)}
    ${slots ? `<div class="diag-ram-modules">${slots}</div>` : ''}
    ${alerts}
  </div>`;
}

// ──────────────────────────────────────────────────────────────
// Renderizar tarjeta Almacenamiento
// ──────────────────────────────────────────────────────────────
function renderStorage(disks) {
  if (!disks || disks.length === 0) return '';
  const diskCards = disks.map(d => {
    const usedPct = d.total_gb > 0 ? ((d.used_gb / d.total_gb) * 100) : 0;
    const tempCls = tempClass(d.temp_c, 'disk_temp');
    let smart = '';
    if (d.smart_status === 'OK')
      smart = badgeHtml('ok', '✅', 'S.M.A.R.T. OK');
    else if (d.smart_status === 'WARN')
      smart = badgeHtml('warn', '⚠️', 'S.M.A.R.T. Advertencia');
    else if (d.smart_status === 'FAIL')
      smart = badgeHtml('bad', '❌', 'S.M.A.R.T. Fallo');
    else
      smart = badgeHtml('na', 'ℹ️', 'S.M.A.R.T. N/D');

    const diskTypeIcon = d.type === 'NVMe' ? '⚡' : d.type === 'SSD' ? '💾' : '🖴';

    return `
    <div class="diag-disk">
      <div class="diag-disk-name">${diskTypeIcon} ${esc(d.model ?? d.name ?? 'Disco')}</div>
      <div class="diag-rows">
        <div class="diag-row"><span class="diag-row-label">Tipo</span>${na(d.type)}</div>
        <div class="diag-row"><span class="diag-row-label">Capacidad</span>${na(fmtBytes(d.total_gb))}</div>
        <div class="diag-row"><span class="diag-row-label">Usado</span>${na(fmtBytes(d.used_gb))}</div>
        <div class="diag-row"><span class="diag-row-label">Libre</span>${na(fmtBytes(d.free_gb))}</div>
        <div class="diag-row"><span class="diag-row-label">Temperatura</span>${na(d.temp_c !== null ? `${d.temp_c} °C` : null)}</div>
        <div class="diag-row"><span class="diag-row-label">Estado</span>${smart}</div>
      </div>
      ${barHtml('Espacio usado', usedPct, pctClass(usedPct, 'ram_pct'))}
      ${d.temp_c !== null ? barHtml('Temperatura', d.temp_c, tempCls, ' °C') : ''}
    </div>`;
  }).join('');

  return `
  <div class="diag-card storage">
    <div class="diag-card-header">
      <div class="diag-card-icon">💽</div>
      <div>
        <div class="diag-card-title">Almacenamiento</div>
        <div class="diag-card-subtitle">${disks.length} disco(s) detectado(s)</div>
      </div>
    </div>
    ${diskCards}
  </div>`;
}

// ──────────────────────────────────────────────────────────────
// Renderizar tarjeta Sistema Operativo
// ──────────────────────────────────────────────────────────────
function renderOS(os) {
  if (!os) return '';
  return `
  <div class="diag-card os">
    <div class="diag-card-header">
      <div class="diag-card-icon">🪟</div>
      <div>
        <div class="diag-card-title">Sistema Operativo</div>
        <div class="diag-card-subtitle">${esc(os.name ?? '')}</div>
      </div>
    </div>
    <div class="diag-rows">
      <div class="diag-row"><span class="diag-row-label">Nombre</span>${na(os.name)}</div>
      <div class="diag-row"><span class="diag-row-label">Versión</span>${na(os.version)}</div>
      <div class="diag-row"><span class="diag-row-label">Build</span>${na(os.build)}</div>
      <div class="diag-row"><span class="diag-row-label">Arquitectura</span>${na(os.arch)}</div>
      <div class="diag-row"><span class="diag-row-label">Nombre del equipo</span>${na(os.hostname)}</div>
      <div class="diag-row"><span class="diag-row-label">Último arranque</span>${na(os.last_boot)}</div>
      <div class="diag-row"><span class="diag-row-label">Tiempo encendido</span>${na(os.uptime)}</div>
    </div>
  </div>`;
}

// ──────────────────────────────────────────────────────────────
// Renderizar tarjeta Placa madre
// ──────────────────────────────────────────────────────────────
function renderMotherboard(mb) {
  if (!mb) return '';
  return `
  <div class="diag-card mobo">
    <div class="diag-card-header">
      <div class="diag-card-icon">🔌</div>
      <div>
        <div class="diag-card-title">Placa Madre</div>
        <div class="diag-card-subtitle">${esc(mb.manufacturer ?? '')} ${esc(mb.model ?? '')}</div>
      </div>
    </div>
    <div class="diag-rows">
      <div class="diag-row"><span class="diag-row-label">Fabricante</span>${na(mb.manufacturer)}</div>
      <div class="diag-row"><span class="diag-row-label">Modelo</span>${na(mb.model)}</div>
      <div class="diag-row"><span class="diag-row-label">Versión</span>${na(mb.version)}</div>
      <div class="diag-row"><span class="diag-row-label">Versión BIOS</span>${na(mb.bios_version)}</div>
      <div class="diag-row"><span class="diag-row-label">Fecha BIOS</span>${na(mb.bios_date)}</div>
      <div class="diag-row"><span class="diag-row-label">Fabricante BIOS</span>${na(mb.bios_manufacturer)}</div>
    </div>
  </div>`;
}

// ──────────────────────────────────────────────────────────────
// Renderizar tarjeta GPU
// ──────────────────────────────────────────────────────────────
function renderGPU(gpus) {
  if (!gpus || gpus.length === 0) return '';
  const gpuRows = gpus.map(g => {
    const tempCls = tempClass(g.temp_c, 'gpu_temp');
    let alerts = '';
    if (g.temp_c !== null && g.temp_c >= THRESHOLDS.gpu_temp.hot)
      alerts += alertHtml('hot', '🔥', `Temperatura GPU crítica: ${g.temp_c}°C`);
    else if (g.temp_c !== null && g.temp_c >= THRESHOLDS.gpu_temp.warn)
      alerts += alertHtml('warn', '⚠️', `Temperatura GPU elevada: ${g.temp_c}°C`);

    return `
    <div class="diag-rows" style="margin-bottom:12px;">
      <div class="diag-row"><span class="diag-row-label">Modelo</span>${na(g.name)}</div>
      <div class="diag-row"><span class="diag-row-label">Controlador</span>${na(g.driver_version)}</div>
      <div class="diag-row"><span class="diag-row-label">VRAM</span>${na(g.vram_mb ? `${g.vram_mb} MB` : null)}</div>
      <div class="diag-row"><span class="diag-row-label">Temperatura</span>${na(g.temp_c !== null ? `${g.temp_c} °C` : null)}</div>
    </div>
    ${g.temp_c !== null ? barHtml('Temperatura GPU', g.temp_c, tempCls, ' °C') : ''}
    ${alerts}`;
  }).join('<hr style="border:none;border-top:1px solid #f1f5f9;margin:12px 0;">');

  return `
  <div class="diag-card gpu">
    <div class="diag-card-header">
      <div class="diag-card-icon">🎮</div>
      <div>
        <div class="diag-card-title">Tarjeta Gráfica</div>
        <div class="diag-card-subtitle">${gpus.length} GPU(s) detectada(s)</div>
      </div>
    </div>
    ${gpuRows}
  </div>`;
}

// ──────────────────────────────────────────────────────────────
// Renderizar tarjeta Temperaturas (resumen de todos los sensores)
// ──────────────────────────────────────────────────────────────
function renderTemps(sensors) {
  if (!sensors || sensors.length === 0) return '';
  const rows = sensors.map(s => {
    const max = s.key?.includes('cpu') ? 90 : s.key?.includes('disk') ? 55 : 95;
    const warn = s.key?.includes('cpu') ? 75 : s.key?.includes('disk') ? 45 : 80;
    const cls = s.value >= max ? 'hot' : s.value >= warn ? 'warn' : 'ok';
    return `
    <div class="diag-row">
      <span class="diag-row-label">${esc(s.label)}</span>
      <span class="diag-row-value">${s.value} °C</span>
    </div>
    ${barHtml(s.label, s.value, cls, ' °C')}`;
  }).join('');

  return `
  <div class="diag-card temps">
    <div class="diag-card-header">
      <div class="diag-card-icon">🌡️</div>
      <div>
        <div class="diag-card-title">Temperaturas</div>
        <div class="diag-card-subtitle">Todos los sensores disponibles</div>
      </div>
    </div>
    <div class="diag-rows">${rows}</div>
  </div>`;
}

// ──────────────────────────────────────────────────────────────
// Validar JSON importado
// ──────────────────────────────────────────────────────────────
function validateDiagJSON(data) {
  if (typeof data !== 'object' || data === null)
    throw new Error('El archivo no es un objeto JSON válido.');
  if (!data.tool_version || !data.timestamp)
    throw new Error('El JSON no tiene campos requeridos (tool_version, timestamp). ¿Es un archivo de DiagnosticoTool?');
  if (typeof data.timestamp !== 'string')
    throw new Error('El campo "timestamp" debe ser una cadena ISO 8601.');
  // Verificar estructura mínima
  const knownKeys = ['tool_version','timestamp','cpu','ram','disks','os','motherboard','gpus','sensors'];
  const hasAny = knownKeys.some(k => k in data);
  if (!hasAny) throw new Error('El JSON no contiene datos de hardware reconocidos.');
  return true;
}

// ──────────────────────────────────────────────────────────────
// Exportar módulo
// ──────────────────────────────────────────────────────────────
export function initDiagnostico(db, getSession, getRole, getEquipos) {
  // Referencias DOM
  const diagEquipoSel  = document.getElementById('diagEquipoSelect');
  const diagTicketSel  = document.getElementById('diagTicketSelect');
  const diagFileInput  = document.getElementById('diagFileInput');
  const btnImport      = document.getElementById('diagBtnImport');
  const btnSave        = document.getElementById('diagBtnSave');
  const btnPdf         = document.getElementById('diagBtnPdf');
  const diagResults    = document.getElementById('diagResults');
  const diagInstr      = document.getElementById('diagInstructions');
  const diagHistList   = document.getElementById('diagHistoryList');
  const diagMsg        = document.getElementById('diagMsg');

  let currentDiag = null; // datos JSON importados

  // ── Poblar selector de equipos ────────────────────────────
  function populateEquipos() {
    const equips = getEquipos();
    diagEquipoSel.innerHTML = '<option value="">— Seleccionar equipo —</option>'
      + equips.map(e =>
          `<option value="${esc(e.id)}">${esc(e.codigo)} · ${esc(e.nombre)}</option>`
        ).join('');
  }

  // ── Poblar selector de tickets para el equipo elegido ─────
  async function populateTickets(equipoId) {
    diagTicketSel.innerHTML = '<option value="">Sin ticket asociado</option>';
    if (!db || !equipoId) return;
    const { data } = await db.from('tickets')
      .select('id,numero,estado,descripcion')
      .eq('equipo_id', equipoId)
      .in('estado', ['Asignado','En diagnóstico','En atención'])
      .order('creado_en', { ascending: false })
      .limit(20);
    if (data?.length) {
      diagTicketSel.innerHTML += data.map(t =>
        `<option value="${esc(t.id)}">#${t.numero} · ${esc(t.estado)} · ${esc(t.descripcion.slice(0,50))}</option>`
      ).join('');
    }
  }

  // ── Cargar historial del equipo seleccionado ──────────────
  async function loadHistory(equipoId) {
    diagHistList.innerHTML = '<div class="diag-spinner">Cargando historial…</div>';
    if (!db || !equipoId) {
      diagHistList.innerHTML = '<div class="diag-empty"><span>📋</span>Selecciona un equipo para ver su historial.</div>';
      return;
    }
    const { data, error } = await db
      .from('diagnosticos')
      .select('id,fecha_diagnostico,observaciones,tecnico_id,profiles(nombre)')
      .eq('equipo_id', equipoId)
      .order('fecha_diagnostico', { ascending: false })
      .limit(20);
    if (error || !data?.length) {
      diagHistList.innerHTML = '<div class="diag-empty"><span>🔍</span>No hay diagnósticos anteriores para este equipo.</div>';
      return;
    }
    diagHistList.innerHTML = data.map(d => `
      <div class="diag-history-item" data-id="${esc(d.id)}">
        <div class="diag-history-dot"></div>
        <div class="diag-history-info">
          <div class="diag-history-date">${new Date(d.fecha_diagnostico).toLocaleString('es-PE')}</div>
          <div class="diag-history-tech">Técnico: ${esc(d.profiles?.nombre ?? 'Desconocido')}</div>
          ${d.observaciones ? `<div class="diag-history-tech">${esc(d.observaciones.slice(0,80))}…</div>` : ''}
        </div>
        <button class="diag-history-btn" data-load="${esc(d.id)}">Ver</button>
      </div>`).join('');

    // Botón "Ver": recargar datos de ese diagnóstico
    diagHistList.querySelectorAll('[data-load]').forEach(btn => {
      btn.addEventListener('click', () => loadDiagById(btn.dataset.load));
    });
  }

  // ── Cargar diagnóstico del historial ─────────────────────
  async function loadDiagById(id) {
    if (!db) return;
    const { data, error } = await db.from('diagnosticos')
      .select('datos_json,fecha_diagnostico,observaciones')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return;
    currentDiag = data.datos_json;
    renderDiag(currentDiag, new Date(data.fecha_diagnostico));
    showMsg('Diagnóstico cargado del historial.', false);
    document.getElementById('diagnostico').scrollIntoView({ behavior: 'smooth' });
  }

  // ── Importar JSON ─────────────────────────────────────────
  btnImport.addEventListener('click', () => diagFileInput.click());
  diagFileInput.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      validateDiagJSON(json);
      currentDiag = json;
      renderDiag(json, new Date(json.timestamp));
      showMsg('Diagnóstico importado correctamente. Revisa los datos y guarda.', false);
    } catch (err) {
      showMsg('Error al importar: ' + err.message, true);
    }
    diagFileInput.value = '';
  });

  // ── Guardar diagnóstico en Supabase ───────────────────────
  btnSave.addEventListener('click', async () => {
    const session = getSession();
    if (!session) return showMsg('Debes iniciar sesión para guardar.', true);
    if (!currentDiag) return showMsg('Primero importa un diagnóstico.', true);
    const equipoId = diagEquipoSel.value;
    if (!equipoId) return showMsg('Selecciona el equipo al que corresponde este diagnóstico.', true);

    btnSave.disabled = true;
    const { error } = await db.from('diagnosticos').insert({
      equipo_id:         equipoId,
      tecnico_id:        session.user.id,
      ticket_id:         diagTicketSel.value || null,
      fecha_diagnostico: currentDiag.timestamp,
      datos_json:        currentDiag,
      observaciones:     document.getElementById('diagObservaciones')?.value?.trim() || null,
    });
    btnSave.disabled = false;
    if (error) return showMsg('Error al guardar: ' + error.message, true);
    showMsg('Diagnóstico guardado correctamente.', false);
    await loadHistory(equipoId);
  });

  // ── Generar PDF ───────────────────────────────────────────
  btnPdf.addEventListener('click', () => {
    if (!currentDiag) return showMsg('Primero importa o carga un diagnóstico.', true);
    generatePDF(currentDiag);
  });

  // ── Evento: cambio de equipo ──────────────────────────────
  diagEquipoSel.addEventListener('change', async () => {
    const id = diagEquipoSel.value;
    await Promise.all([populateTickets(id), loadHistory(id)]);
  });

  // ── Renderizar diagnóstico ────────────────────────────────
  function renderDiag(d, ts) {
    diagInstr.hidden = true;
    diagResults.hidden = false;

    // Fecha y equipo en cabecera
    const metaEl = document.getElementById('diagMeta');
    if (metaEl) {
      const equip = getEquipos().find(e => e.id === diagEquipoSel.value);
      metaEl.innerHTML = `
        <strong>${ts.toLocaleString('es-PE')}</strong>
        ${equip ? ` · Equipo: <strong>${esc(equip.codigo)} ${esc(equip.nombre)}</strong>` : ''}
        · Herramienta v${esc(d.tool_version ?? '?')}`;
    }

    const grid = document.getElementById('diagGrid');
    grid.innerHTML =
      renderCPU(d.cpu) +
      renderRAM(d.ram) +
      renderStorage(d.disks) +
      renderOS(d.os) +
      renderMotherboard(d.motherboard) +
      renderGPU(d.gpus) +
      renderTemps(d.sensors);
  }

  // ── Mensaje de estado ─────────────────────────────────────
  function showMsg(text, isError) {
    diagMsg.innerHTML = `<p class="${isError ? 'error' : 'success'}">${esc(text)}</p>`;
    setTimeout(() => { diagMsg.innerHTML = ''; }, 6000);
  }

  // ── API pública para inicializar desde app.js ─────────────
  return {
    onPanelOpen() {
      populateEquipos();
    },
  };
}

// ──────────────────────────────────────────────────────────────
// Generación de PDF con jsPDF (cargado via CDN)
// ──────────────────────────────────────────────────────────────
function generatePDF(d) {
  if (!window.jspdf) {
    // Cargar jsPDF dinámicamente si no está presente
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => buildPDF(d);
    document.head.appendChild(script);
    return;
  }
  buildPDF(d);
}

function buildPDF(d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const W = 210;
  const M = 18; // margen
  let y = 20;

  // ── Encabezado ────────────────────────────────────────────
  doc.setFillColor(19, 135, 92);
  doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SOS PC QR — Informe de Diagnóstico', M, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('IESTP Luis Negreiros Vega · Computación e Informática', M, 22);
  y = 38;

  // ── Fecha ────────────────────────────────────────────────
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.text(`Fecha del diagnóstico: ${new Date(d.timestamp).toLocaleString('es-PE')}`, M, y);
  doc.text(`Herramienta: DiagnosticoTool v${d.tool_version ?? '?'}`, M, y + 6);
  y += 16;

  function section(title) {
    doc.setFillColor(240, 247, 255);
    doc.rect(M, y, W - M * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 40, 61);
    doc.text(title, M + 2, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    y += 12;
  }

  function row(label, value) {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', M + 2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value ?? 'No disponible'), M + 55, y);
    y += 7;
  }

  // ── CPU ───────────────────────────────────────────────────
  if (d.cpu) {
    section('Procesador');
    row('Fabricante', d.cpu.manufacturer);
    row('Modelo', d.cpu.name);
    row('Núcleos / Hilos', d.cpu.cores !== null ? `${d.cpu.cores} / ${d.cpu.threads ?? '?'}` : null);
    row('Frecuencia', d.cpu.freq_ghz ? `${d.cpu.freq_ghz} GHz` : null);
    row('Temperatura', d.cpu.temp_c !== null ? `${d.cpu.temp_c} °C` : null);
    row('Utilización', d.cpu.load_pct !== null ? `${d.cpu.load_pct} %` : null);
    y += 4;
  }

  // ── RAM ───────────────────────────────────────────────────
  if (d.ram) {
    section('Memoria RAM');
    row('Total', fmtBytes(d.ram.total_gb));
    row('Usada', fmtBytes(d.ram.used_gb));
    row('Disponible', fmtBytes(d.ram.available_gb));
    row('Tipo', d.ram.type);
    row('Velocidad', d.ram.speed_mhz ? `${d.ram.speed_mhz} MHz` : null);
    row('Módulos', d.ram.modules?.length);
    y += 4;
  }

  // ── Almacenamiento ────────────────────────────────────────
  if (d.disks?.length) {
    section('Almacenamiento');
    d.disks.forEach((disk, i) => {
      if (i > 0) y += 3;
      row(`Disco ${i + 1}`, disk.model ?? disk.name);
      row('  Tipo', disk.type);
      row('  Capacidad', fmtBytes(disk.total_gb));
      row('  Libre', fmtBytes(disk.free_gb));
      row('  S.M.A.R.T.', disk.smart_status);
      row('  Temperatura', disk.temp_c !== null ? `${disk.temp_c} °C` : null);
    });
    y += 4;
  }

  // ── Sistema Operativo ─────────────────────────────────────
  if (d.os) {
    section('Sistema Operativo');
    row('Nombre', d.os.name);
    row('Versión', d.os.version);
    row('Build', d.os.build);
    row('Arquitectura', d.os.arch);
    row('Nombre del equipo', d.os.hostname);
    row('Último arranque', d.os.last_boot);
    y += 4;
  }

  // ── Placa madre ───────────────────────────────────────────
  if (d.motherboard) {
    section('Placa Madre');
    row('Fabricante', d.motherboard.manufacturer);
    row('Modelo', d.motherboard.model);
    row('BIOS versión', d.motherboard.bios_version);
    row('Fecha BIOS', d.motherboard.bios_date);
    y += 4;
  }

  // ── GPU ───────────────────────────────────────────────────
  if (d.gpus?.length) {
    section('Tarjeta Gráfica');
    d.gpus.forEach((g, i) => {
      row(`GPU ${i + 1}`, g.name);
      row('  Controlador', g.driver_version);
      row('  VRAM', g.vram_mb ? `${g.vram_mb} MB` : null);
      row('  Temperatura', g.temp_c !== null ? `${g.temp_c} °C` : null);
    });
    y += 4;
  }

  // ── Pie de página ─────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`SOS PC QR · Diagnóstico generado el ${new Date().toLocaleString('es-PE')} · Página ${p} de ${pageCount}`, M, 290);
  }

  doc.save(`diagnostico_${new Date().toISOString().slice(0,10)}.pdf`);
}
