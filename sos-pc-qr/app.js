import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';
import {initDiagnostico} from './diagnostico.js';
const configured=!SUPABASE_URL.includes('TU-PROYECTO')&&!SUPABASE_ANON_KEY.startsWith('TU_');
const db=configured?createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clean=s=>String(s??'');
const esc=s=>clean(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const message=(sel,text,error=false)=>{$(sel).innerHTML=`<p class="${error?'error':'success'}">${esc(text)}</p>`};
const url=new URL(location.href);let equipos=[],ubicaciones=[],tickets=[],profiles=[],session=null,role='';
let diagModule=null;
function show(view){$$('.view').forEach(e=>e.classList.toggle('active',e.id===view));window.scrollTo(0,0);if(view==='panel')refreshAuth();}
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
function showSupportImage(target,size=180){const image=document.createElement('img');image.src='img1.jpg';image.alt='Técnico reparando una laptop';image.width=size;image.height=size;image.className='support-image';target.replaceChildren(image);}
async function loadCatalog(){if(!db)return;const [e,u]=await Promise.all([db.from('equipos').select('id,codigo,nombre,tipo,ubicacion_id,ubicaciones(nombre)').order('codigo'),db.from('ubicaciones').select('*').order('nombre')]);if(e.error||u.error){console.warn(e.error||u.error);return;}equipos=e.data||[];ubicaciones=u.data||[];const select=$('#equipoSelect');select.innerHTML='<option value="">Otro equipo / sin registrar</option>'+equipos.map(x=>`<option value="${esc(x.id)}">${esc(x.codigo)} · ${esc(x.nombre)}</option>`).join('');$('#ubicacionSelect').innerHTML='<option value="">Sin ubicación</option>'+ubicaciones.map(x=>`<option value="${esc(x.id)}">${esc(x.nombre)}</option>`).join('');const id=url.searchParams.get('equipo');if(id&&equipos.some(x=>x.id===id)){select.value=id;fillEquipo();}}
function fillEquipo(){const e=equipos.find(x=>x.id===$('#equipoSelect').value);$('#codigoEquipo').value=e?.codigo||'';$('#ubicacion').value=e?.ubicaciones?.nombre||'';$('#codigoEquipo').readOnly=!!e;$('#ubicacion').readOnly=!!e;}
$('#equipoSelect').addEventListener('change',fillEquipo);
$('#reportForm').addEventListener('submit',async ev=>{ev.preventDefault();if(!db)return message('#reportResult','Configura primero Supabase en config.js',true);const b=ev.submitter;b.disabled=true;const f=new FormData(ev.target);const args={p_solicitante:f.get('solicitante'),p_contacto:f.get('contacto'),p_equipo_id:f.get('equipo_id')||null,p_codigo_equipo:f.get('codigo_equipo'),p_ubicacion:f.get('ubicacion'),p_dispositivo:f.get('dispositivo'),p_categoria:f.get('categoria'),p_descripcion:f.get('descripcion'),p_aparicion:f.get('aparicion'),p_urgencia:f.get('urgencia')};const {data,error}=await db.rpc('reportar_incidencia',args);b.disabled=false;if(error)return message('#reportResult',error.message,true);const t=data?.[0];if(!t)return message('#reportResult','No se recibió el ticket',true);const u=new URL(location.href);u.search='';u.searchParams.set('view','consultar');u.searchParams.set('numero',t.numero);u.searchParams.set('token',t.token);$('#reportResult').innerHTML=`<div class="result"><strong>¡Reporte registrado! Ticket #${esc(t.numero)}</strong><p>Guarda este enlace privado para consultar tu atención. No lo compartas públicamente.</p><a href="${esc(u.href)}">${esc(u.href)}</a><p><button type="button" id="copyLink">Copiar enlace</button></p></div>`;$('#copyLink').onclick=()=>navigator.clipboard.writeText(u.href);ev.target.reset();fillEquipo();});
$('#consultForm').addEventListener('submit',async ev=>{ev.preventDefault();if(!db)return message('#consultResult','Configura Supabase primero',true);const f=new FormData(ev.target);const {data,error}=await db.rpc('consultar_ticket',{p_numero:Number(f.get('numero')),p_token:f.get('token')});if(error)return message('#consultResult',error.message,true);const t=data?.[0];if(!t)return message('#consultResult','Ticket no encontrado. Revisa número y token.',true);$('#consultResult').innerHTML=`<div class="result"><h3>Ticket #${esc(t.numero)}</h3><p><b>Estado:</b> ${esc(t.estado)} · <b>Prioridad:</b> ${esc(t.prioridad)}</p><p><b>Equipo:</b> ${esc(t.codigo_equipo||'No registrado')} · ${esc(t.ubicacion)}</p><p><b>Categoría:</b> ${esc(t.categoria)}</p><p><b>Problema:</b> ${esc(t.descripcion)}</p><p><b>Solución:</b> ${esc(t.solucion||'Aún no registrada')}</p><p><b>Recomendaciones:</b> ${esc(t.recomendaciones||'Pendientes')}</p><small>Actualizado: ${new Date(t.actualizado_en).toLocaleString('es-PE')}</small></div>`;});
$('#loginForm').addEventListener('submit',async ev=>{ev.preventDefault();if(!db)return message('#loginMsg','Configura Supabase primero',true);const f=new FormData(ev.target);const {error}=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)return message('#loginMsg',error.message,true);await refreshAuth();});
async function refreshAuth(){if(!db)return;const {data:{session:s}}=await db.auth.getSession();session=s;let p=null;if(s){const r=await db.from('profiles').select('rol,nombre').eq('id',s.user.id).maybeSingle();p=r.data;}role=p?.rol||'';const ok=!!p;$('#loginBox').hidden=ok;$('#dashboard').hidden=!ok;const navDiag=$('#navDiag');if(navDiag)navDiag.style.display=ok?'':'none';if(s&&!p){message('#loginMsg','Tu cuenta aún no tiene un perfil de técnico o administrador.',true);}if(ok){$('#userLabel').textContent=`${p.nombre} · ${p.rol}`;$('#equipForm').hidden=role!=='admin';$('#locationForm').hidden=role!=='admin';await Promise.all([loadTickets(),loadCatalog()]);renderInventory();if(diagModule)diagModule.onPanelOpen();subscribeNewTickets();}}
$('#logout').onclick=async()=>{await db?.auth.signOut();unsubscribeTickets();session=null;role='';$('#loginBox').hidden=false;$('#dashboard').hidden=true;const navDiag=$('#navDiag');if(navDiag)navDiag.style.display='none';};
$('#refresh').onclick=loadTickets;
async function loadTickets(){if(!db||!session)return;const [t,p]=await Promise.all([db.from('tickets').select('*').order('creado_en',{ascending:false}).limit(500),db.from('profiles').select('id,nombre,rol')]);if(t.error)return alert(t.error.message);tickets=t.data||[];profiles=p.data||[];$('#tecnicoSelect').innerHTML='<option value="">Sin asignar</option>'+profiles.map(x=>`<option value="${esc(x.id)}">${esc(x.nombre)} (${esc(x.rol)})</option>`).join('');const count=state=>tickets.filter(t=>t.estado===state).length;$('#stats').innerHTML=[['Total',tickets.length],['Pendientes',count('Pendiente')],['En atención',tickets.filter(t=>['Asignado','En diagnóstico','En atención'].includes(t.estado)).length],['Cerrados',count('Cerrado')]].map(([n,v])=>`<article><strong>${v}</strong><small>${n}</small></article>`).join('');$('#ticketRows').innerHTML=tickets.map(t=>`<tr><td>#${t.numero}<br><small>${new Date(t.creado_en).toLocaleDateString('es-PE')}</small></td><td>${esc(t.codigo_equipo||t.dispositivo)}<br><small>${esc(t.ubicacion)}</small></td><td>${esc(t.descripcion.slice(0,95))}</td><td><span class="tag ${esc(t.prioridad)}">${esc(t.prioridad)}</span></td><td>${esc(t.estado)}</td><td><button data-edit="${esc(t.id)}">Atender</button></td></tr>`).join('')||'<tr><td colspan="6">No hay tickets.</td></tr>';$$('[data-edit]').forEach(b=>b.onclick=()=>editTicket(b.dataset.edit));}
async function editTicket(id){const t=tickets.find(x=>x.id===id);if(!t)return;$('#editBox').hidden=false;$('#editTicketNum').textContent='#'+t.numero;const f=$('#editForm');for(const key of ['id','estado','prioridad','tecnico_id','pruebas','diagnostico','solucion','recomendaciones'])f.elements[key].value=t[key]||'';f.elements.nota.value='';$('#editMsg').textContent='';const {data,error}=await db.from('ticket_historial').select('estado,nota,creado_en').eq('ticket_id',id).order('creado_en',{ascending:false});$('#history').innerHTML=error?esc(error.message):(data||[]).map(h=>`<div><b>${esc(h.estado)}</b> · <small>${new Date(h.creado_en).toLocaleString('es-PE')}</small><p>${esc(h.nota||'Sin nota')}</p></div>`).join('');$('#editBox').scrollIntoView({behavior:'smooth'});}
$('#editForm').addEventListener('submit',async ev=>{ev.preventDefault();const f=new FormData(ev.target);const id=f.get('id'),old=tickets.find(x=>x.id===id);const changes={estado:f.get('estado'),prioridad:f.get('prioridad'),tecnico_id:f.get('tecnico_id')||null,pruebas:f.get('pruebas'),diagnostico:f.get('diagnostico'),solucion:f.get('solucion'),recomendaciones:f.get('recomendaciones'),actualizado_en:new Date().toISOString()};if(changes.estado==='Cerrado'&&!changes.solucion.trim())return message('#editMsg','Registra la solución antes de cerrar.',true);if(changes.estado==='Cerrado'&&old.estado!=='Cerrado')changes.cerrado_en=new Date().toISOString();const {error}=await db.from('tickets').update(changes).eq('id',id);if(error)return message('#editMsg',error.message,true);const {error:historyError}=await db.from('ticket_historial').insert({ticket_id:id,autor_id:session.user.id,estado:changes.estado,nota:f.get('nota')||'Actualización técnica'});if(historyError)return message('#editMsg','Cambios guardados, pero falló el historial: '+historyError.message,true);message('#editMsg','Cambios guardados');await loadTickets();await editTicket(id);});
function renderInventory(){const root=$('#equipCards');root.innerHTML='';equipos.forEach(e=>{const div=document.createElement('div');div.className='qr-card';div.innerHTML=`<strong>${esc(e.codigo)}</strong><small>${esc(e.nombre)} · ${esc(e.ubicaciones?.nombre||'Sin ubicación')}</small><div class="qr-target"></div><small>Imagen de soporte técnico</small>`;root.append(div);showSupportImage(div.querySelector('.qr-target'),150);});}
$('#equipForm').addEventListener('submit',async ev=>{ev.preventDefault();if(role!=='admin')return;const f=new FormData(ev.target);const {error}=await db.from('equipos').insert({codigo:f.get('codigo').trim(),nombre:f.get('nombre').trim(),tipo:f.get('tipo'),ubicacion_id:f.get('ubicacion_id')||null});if(error)return message('#equipMsg',error.message,true);ev.target.reset();message('#equipMsg','Equipo agregado');await loadCatalog();renderInventory();});
$('#locationForm').addEventListener('submit',async ev=>{ev.preventDefault();if(role!=='admin')return;const {error}=await db.from('ubicaciones').insert({nombre:new FormData(ev.target).get('nombre').trim()});if(error)return alert(error.message);ev.target.reset();await loadCatalog();});
$('#printQrs').onclick=()=>window.print();
const initial=url.searchParams.get('view');if(['reportar','consultar','panel'].includes(initial))show(initial);if(initial==='consultar'){if(url.searchParams.get('numero'))$('#consultForm').elements.numero.value=url.searchParams.get('numero');if(url.searchParams.get('token'))$('#consultForm').elements.token.value=url.searchParams.get('token');}
// Botón de descarga de DiagnosticoTool
const btnDlTool=$('#diagBtnDownloadTool');
if(btnDlTool)btnDlTool.onclick=async()=>{
  if(!db) return showDiagToolModal();
  try {
    const { data } = db.storage.from('herramientas').getPublicUrl('DiagnosticoTool.exe');
    if (data && data.publicUrl) {
      const res = await fetch(data.publicUrl, { method: 'HEAD' });
      if(res.ok) {
        const a=document.createElement('a');a.href=data.publicUrl;a.download='DiagnosticoTool.exe';a.click();
        return;
      }
    }
  } catch(e) {}
  showDiagToolModal();
};
if(db)db.auth.onAuthStateChange(()=>{if($('#panel').classList.contains('active'))setTimeout(refreshAuth,0)});

/* ── Notificación de nuevo ticket ─────────────────────────── */
let _ticketChannel=null;

function playNotifSound(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    // Triple tono ascendente tipo notificación premium
    const notes=[523.25,659.25,783.99]; // Do-Mi-Sol
    notes.forEach((freq,i)=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.type='sine';
      osc.frequency.value=freq;
      const t=ctx.currentTime+i*0.12;
      gain.gain.setValueAtTime(0,t);
      gain.gain.linearRampToValueAtTime(0.28,t+0.02);
      gain.gain.exponentialRampToValueAtTime(0.001,t+0.38);
      osc.start(t);osc.stop(t+0.4);
    });
  }catch(e){console.warn('Audio no disponible',e);}
}

function showTicketNotif(ticket){
  // Eliminar modal previo si existe
  document.getElementById('ticketNotifOverlay')?.remove();

  const urgBadgeClass=ticket.prioridad||'Media';
  const overlay=document.createElement('div');
  overlay.id='ticketNotifOverlay';
  overlay.innerHTML=`
    <div id="ticketNotifBox">
      <div class="tn-pulse-ring">🎫</div>
      <div class="tn-header">
        <div class="tn-label">Nuevo ticket recibido</div>
        <h2 class="tn-title">Incidencia #${esc(String(ticket.numero))}</h2>
      </div>
      <div class="tn-body">
        <div class="tn-row"><strong>Solicitante</strong><span>${esc(ticket.solicitante||'—')}</span></div>
        <div class="tn-row"><strong>Equipo</strong><span>${esc(ticket.codigo_equipo||ticket.dispositivo||'—')}</span></div>
        <div class="tn-row"><strong>Ubicación</strong><span>${esc(ticket.ubicacion||'—')}</span></div>
        <div class="tn-row"><strong>Categoría</strong><span>${esc(ticket.categoria||'—')}</span></div>
        <div class="tn-row"><strong>Prioridad</strong><span><span class="tn-badge ${esc(urgBadgeClass)}">${esc(urgBadgeClass)}</span></span></div>
        <div class="tn-row"><strong>Descripción</strong><span>${esc((ticket.descripcion||'').slice(0,140))}</span></div>
      </div>
      <div class="tn-footer">
        <button class="tn-btn-primary" id="tnBtnAtender">🛠️ Atender ahora</button>
        <button class="tn-btn-secondary" id="tnBtnClose">Cerrar</button>
      </div>
    </div>`;

  function closeNotif(){
    overlay.classList.add('tn-hide');
    setTimeout(()=>overlay.remove(),280);
  }

  overlay.querySelector('#tnBtnAtender').onclick=()=>{
    closeNotif();
    show('panel');
    // Pequeño retraso para que el panel cargue antes de hacer scroll al ticket
    setTimeout(()=>loadTickets(),400);
  };
  overlay.querySelector('#tnBtnClose').onclick=closeNotif;
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeNotif();});

  document.body.appendChild(overlay);
  playNotifSound();
}

function subscribeNewTickets(){
  if(!db||_ticketChannel)return;
  _ticketChannel=db
    .channel('new-tickets-notif')
    .on('postgres_changes',
      {event:'INSERT',schema:'public',table:'tickets'},
      ({new:t})=>showTicketNotif(t)
    )
    .subscribe();
}

function unsubscribeTickets(){
  if(_ticketChannel){db.removeChannel(_ticketChannel);_ticketChannel=null;}
}
function showDiagToolModal(){
  // Crear modal si no existe aún
  if(!document.getElementById('diagToolModal')){
    const m=document.createElement('div');
    m.id='diagToolModal';
    m.style.cssText='position:fixed;inset:0;background:#0005;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    m.innerHTML=`<div style="background:white;border-radius:18px;max-width:560px;width:100%;padding:32px;box-shadow:0 20px 60px #0003;font-family:inherit">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <span style="font-size:32px">🔬</span>
        <div><strong style="font-size:18px;color:#14283d">DiagnosticoTool — Herramienta local</strong><br>
        <small style="color:#64758a">Herramienta de diagnóstico de hardware para Windows 10/11</small></div>
      </div>
      <div style="background:#f0f9f4;border:1px solid #a7f3d0;border-radius:10px;padding:14px 16px;margin-bottom:18px;font-size:13px;color:#065f46">
        <strong>El archivo ejecutable aún no se ha subido al servidor.</strong><br>
        El administrador debe compilar la herramienta y subirla al bucket <code>herramientas</code> en Supabase Storage.
      </div>
      <ol style="font-size:13px;line-height:2;color:#14283d;padding-left:20px;margin:0 0 18px">
        <li>Descarga e instala <a href="https://dotnet.microsoft.com/download/dotnet/8.0" target="_blank" rel="noopener" style="color:#13875c">**.NET 8 SDK**</a> en tu PC de trabajo</li>
        <li>Abre <strong>PowerShell</strong> como administrador en la carpeta <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">DiagnosticoTool/DiagnosticoTool/</code></li>
        <li>Ejecuta: <code style="background:#1e293b;color:#86efac;padding:6px 10px;border-radius:6px;display:block;margin:6px 0;font-size:12px">dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true</code></li>
        <li>El ejecutable queda en <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">bin/Release/net8.0-windows/win-x64/publish/<strong>DiagnosticoTool.exe</strong></code></li>
        <li>Sube ese archivo al bucket <strong>herramientas</strong> en tu proyecto de Supabase.</li>
      </ol>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 16px;font-size:12px;color:#1e40af;margin-bottom:20px">
        ℹ️ La herramienta es de <strong>solo lectura</strong>. No instala nada ni modifica Windows. Solo genera un archivo JSON con información del hardware.
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <a href="https://dotnet.microsoft.com/download/dotnet/8.0" target="_blank" rel="noopener"
           style="background:#1a6fcf;color:white;border:none;border-radius:9px;padding:10px 18px;font:inherit;font-size:13px;font-weight:650;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px">
          ⬇️ Descargar .NET 8 SDK
        </a>
        <button id="diagToolModalClose" style="background:white;border:1px solid #dce5ed;border-radius:9px;padding:10px 18px;font:inherit;font-size:13px;cursor:pointer;color:#14283d">
          Cerrar
        </button>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target===m)m.remove();});
    document.getElementById('diagToolModalClose').onclick=()=>m.remove();
  } else {
    document.getElementById('diagToolModal').style.display='flex';
  }
}
