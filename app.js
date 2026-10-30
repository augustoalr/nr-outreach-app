const $=s=>document.querySelector(s), A=document.getElementById('app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ST=['No enviado','Enviado','Seguimiento enviado','Respondió','Pidió CV','Vacante disponible','Aplicar por portal','Sin vacantes','Email inválido','No contactar'];
const VER={V:'Verificado',S:'Índice de búsqueda',U:'No verificado',N:'Sin email',X:'No contactar'};
const PK='nr_progress_v1', today=()=>new Date().toISOString().slice(0,10);
const addDays=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
let D=null, P=JSON.parse(localStorage.getItem(PK)||'{}'), view={tab:'home',f:{q:'',pri:'',zone:'',dist:'',st:'',lote:0},id:null,lic:1};
const save=()=>localStorage.setItem(PK,JSON.stringify(P));
const pg=id=>P[id]||(P[id]={s:'No enviado',sent:'',fu:'',notes:''});
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),1600)}
async function copy(t,m){try{await navigator.clipboard.writeText(t)}catch{const a=document.createElement('textarea');a.value=t;document.body.append(a);a.select();document.execCommand('copy');a.remove()}toast(m||'Copiado')}

// ---------- crypto / lock ----------
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function idb(){return new Promise((ok,ko)=>{const r=indexedDB.open('nr_keys',1);r.onupgradeneeded=()=>r.result.createObjectStore('k');r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)})}
async function kget(){try{const db=await idb();return await new Promise(ok=>{const r=db.transaction('k').objectStore('k').get('key');r.onsuccess=()=>ok(r.result);r.onerror=()=>ok(null)})}catch{return null}}
async function kset(v){const db=await idb();await new Promise(ok=>{const t=db.transaction('k','readwrite');v?t.objectStore('k').put(v,'key'):t.objectStore('k').delete('key');t.oncomplete=ok})}
let ENC;
async function loadEnc(){ENC=ENC||await (await fetch('data.enc.json',{cache:'no-cache'})).json();return ENC}
async function decryptWith(key){const e=await loadEnc();const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(e.iv)},key,b64(e.ct));return JSON.parse(new TextDecoder().decode(pt))}
async function derive(pin){const e=await loadEnc();const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(e.salt),iterations:e.iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt'])}
function lockScreen(msg){
 A.innerHTML=`<div class="lock"><img src="icon-180.png" alt=""><h1 style="margin:0">Outreach</h1><p class="muted">Introduce tu PIN para abrir los datos cifrados.</p>
 <form id="lf" style="width:100%;max-width:300px"><input id="pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="PIN" aria-label="PIN" style="text-align:center;font-size:24px;letter-spacing:6px">
 <label class="row muted" style="justify-content:center;margin:12px 0"><input id="rem" type="checkbox" checked style="width:auto"> Recordar en este dispositivo</label>
 <button class="btn" id="ub">Desbloquear</button><p id="lm" class="muted" role="alert">${esc(msg||'')}</p></form></div>`;
 $('#lf').onsubmit=async ev=>{ev.preventDefault();const b=$('#ub');b.disabled=true;b.textContent='Descifrando…';
  try{const k=await derive($('#pin').value);D=await decryptWith(k);if($('#rem').checked)await kset(k);start()}
  catch{b.disabled=false;b.textContent='Desbloquear';$('#lm').textContent='PIN incorrecto';$('#lf').classList.add('shake');setTimeout(()=>$('#lf').classList.remove('shake'),400);$('#pin').value=''}};
}
async function lock(){await kset(null);D=null;lockScreen('Bloqueado')}

// ---------- helpers ----------
const rowById=id=>D.rows.find(r=>r.id===id);
const isDNC=r=>r.st==='X'||pg(r.id).s==='No contactar';
const canMail=r=>!!r.email&&(r.st==='V'||r.st==='S')&&!isDNC(r);
function body(r){const b=view.lic?r.b1:r.b2;return b}
function mailto(r,subj,b){return `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(b)}`}
function fuText(r){const p=D.profile,s=pg(r.id);return `Dear Recruitment Team,

I hope you are well. I am following up on my email of ${s.sent||'last week'} regarding a General Dentist position at ${r.name}.

I remain very interested and would be glad to share my CV or arrange a brief call at your convenience. If there are no openings at the moment, I would be grateful if you could keep my details on file.

Thank you for your time.

Kind regards,
${p.name}
General Dentist
${p.email} | ${p.phone}`}
const fuSubj=r=>'Follow-up: '+r.subj;
const pendingFU=()=>D.rows.filter(r=>{const s=pg(r.id);return s.s==='Enviado'&&s.fu&&s.fu<=today()});
function setStatus(r,s){const p=pg(r.id);p.s=s;if(s==='Enviado'&&!p.sent){p.sent=today();p.fu=addDays(p.sent,7)}if(s==='Seguimiento enviado')p.fu='';save()}
function badges(r){const s=pg(r.id).s;return `<span class="badge b-${r.st}">${VER[r.st]}</span><span class="badge ${r.pri==='A'?'b-A':''}">Prioridad ${r.pri}</span>${r.lote?`<span class="badge">Lote ${r.lote}</span>`:''}${s!=='No enviado'?`<span class="badge b-st">${esc(s)}</span>`:''}`}
function item(r){return `<button class="item" data-id="${r.id}"><div class="row"><div class="grow"><div class="t">${esc(r.name)}</div><div class="muted">${esc(r.zone)}${r.geo&&r.geo!=='building'?' · ubicación aprox.':''}</div><div>${badges(r)}</div></div>
<div class="min">${r.min??'–'}<small>min${r.km!=null?' · '+r.km+' km':''}</small></div></div></button>`}
function shell(title,inner,right=''){const t=view.tab;
 A.innerHTML=`<header>${view.id?`<button class="icon" id="back">‹ Atrás</button>`:''}<h1 style="${view.id?'font-size:20px':''}">${esc(title)}</h1>${right}</header><main>${inner}</main>
 <nav class="tabs">${[['home','⌂','Inicio'],['list','☰','Lista'],['fu','↻','Seguimientos'],['more','⚙︎','Ajustes']].map(([k,i,l])=>`<button data-tab="${k}" class="${t===k?'on':''}"><span class="i">${i}</span>${l}${k==='fu'&&pendingFU().length?` (${pendingFU().length})`:''}</button>`).join('')}</nav>`;
 A.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{view.tab=b.dataset.tab;view.id=null;render();scrollTo(0,0)});
 A.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{view.id=b.dataset.id;view.from=scrollY;render();scrollTo(0,0)});
 const bk=$('#back');if(bk)bk.onclick=()=>{view.id=null;render();scrollTo(0,view.from||0)};
}

// ---------- views ----------
function home(){const v=Object.values(P),c=s=>v.filter(x=>x.s===s).length;
 const sent=v.filter(x=>x.s!=='No enviado'&&x.sent).length, resp=v.filter(x=>['Respondió','Pidió CV','Vacante disponible','Aplicar por portal','Sin vacantes'].includes(x.s)).length;
 const lotes=[1,2,3,4,5,6].map(n=>({n,rows:D.rows.filter(r=>r.lote===n)})).filter(l=>l.rows.length);
 const next=lotes.find(l=>l.rows.some(r=>pg(r.id).s==='No enviado'&&canMail(r)));
 const nr=next?next.rows.filter(r=>pg(r.id).s==='No enviado'&&canMail(r)):[];
 shell('Inicio',`<div class="grid" style="margin-top:6px"><div class="stat"><b>${sent}</b><span>Enviados</span></div><div class="stat"><b>${resp}</b><span>Respondieron</span></div>
 <div class="stat"><b>${c('Pidió CV')}</b><span>Pidieron CV</span></div><div class="stat" data-go="fu"><b>${pendingFU().length}</b><span>Seguimientos hoy</span></div></div>
 <h2>Siguiente lote${next?' · Lote '+next.n:''}</h2>${next?`<p class="muted" style="margin:0 4px">${nr.length} pendientes de ${next.rows.length}. Envía 10–15 al día.</p>${nr.map(item).join('')}`:'<div class="empty">¡Todos los lotes verificados enviados!</div>'}
 <h2>Lotes</h2><div class="chips">${lotes.map(l=>{const d=l.rows.filter(r=>pg(r.id).s!=='No enviado').length;return `<button class="chip" data-lote="${l.n}">Lote ${l.n} · ${d}/${l.rows.length}</button>`}).join('')}</div>`);
 A.querySelectorAll('[data-lote]').forEach(b=>b.onclick=()=>{view.tab='list';view.f={q:'',pri:'',zone:'',dist:'',st:'',lote:+b.dataset.lote};render()});
 const g=A.querySelector('[data-go]');g.onclick=()=>{view.tab='fu';render()};
}
function list(){const f=view.f;const zones=[...new Set(D.rows.map(r=>r.zone).filter(Boolean))].sort();
 let rs=D.rows.filter(r=>{const s=pg(r.id).s,q=f.q.toLowerCase();
  return (!q||(r.name+' '+r.zone+' '+r.parent+' '+r.email).toLowerCase().includes(q))&&(!f.pri||r.pri===f.pri)&&(!f.zone||r.zone===f.zone)&&(!f.dist||(r.min!=null&&r.min<=+f.dist))&&(!f.st||s===f.st||(f.st==='_v'&&r.st==='V'))&&(!f.lote||r.lote===f.lote)});
 const ch=(k,v,l)=>`<button class="chip ${f[k]===v?'on':''}" data-f="${k}" data-v="${v}">${l}</button>`;
 shell(f.lote?'Lote '+f.lote:'Lista',`<input id="q" type="search" placeholder="Buscar clínica, zona…" value="${esc(f.q)}" style="margin:6px 0 8px">
 <div class="chips">${ch('lote',0,'Todos')}${[1,2,3,4,5,6].map(n=>ch('lote',n,'Lote '+n)).join('')}</div>
 <div class="chips">${ch('pri','','Toda prioridad')}${ch('pri','A','A')}${ch('pri','B','B')}${ch('pri','C','C')}${ch('dist','','Toda distancia')}${ch('dist','10','≤10 min')}${ch('dist','20','≤20 min')}${ch('dist','30','≤30 min')}</div>
 <div class="row" style="gap:8px"><select id="zone"><option value="">Todas las zonas</option>${zones.map(z=>`<option ${f.zone===z?'selected':''}>${esc(z)}</option>`).join('')}</select>
 <select id="st"><option value="">Todo estado</option><option value="_v" ${f.st==='_v'?'selected':''}>Solo verificados</option>${ST.map(s=>`<option ${f.st===s?'selected':''}>${s}</option>`).join('')}</select></div>
 <p class="muted" style="margin:10px 4px 0">${rs.length} empleadores · ordenados por minutos en coche</p>${rs.map(item).join('')||'<div class="empty">Sin resultados</div>'}`);
 A.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{const k=b.dataset.f;f[k]=k==='lote'?+b.dataset.v:b.dataset.v;render()});
 $('#zone').onchange=e=>{f.zone=e.target.value;render()};$('#st').onchange=e=>{f.st=e.target.value;render()};
 const q=$('#q');q.oninput=()=>{f.q=q.value;clearTimeout(q._t);q._t=setTimeout(()=>{render();const n=$('#q');n.focus();n.setSelectionRange(n.value.length,n.value.length)},250)};
}
function link(l,u,t){return u?`<div class="kv"><span>${l}</span><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t||u.replace(/^https?:\/\/(www\.)?/,''))}</a></div>`:''}
function detail(){const r=rowById(view.id),p=pg(r.id),dnc=isDNC(r),ok=canMail(r),b=body(r);
 const warn=r.st==='X'?'<div class="note bad">No contactar.</div>':r.st==='U'?'<div class="note">Email no verificado: no se envía desde la app. Confirma por teléfono o web.</div>':r.st==='N'?'<div class="note">Sin email público. Usa teléfono, portal de empleo o LinkedIn.</div>':r.st==='S'?'<div class="note">Email encontrado solo en índice de búsqueda: verifica antes de enviar si puedes.</div>':'';
 shell(r.name,`<div style="margin:2px 0 8px">${badges(r)}</div>${warn}
 <div class="card"><div class="kv"><span>Dirección</span><div>${esc(r.addr)}</div></div><div class="kv"><span>Distancia</span><div>${r.min??'–'} min · ${r.km??'–'} km${r.geo&&r.geo!=='building'?' (aprox.)':''}</div></div>
 ${r.email?`<div class="kv"><span>Email</span><div>${esc(r.email)}</div></div>`:''}${r.phone?`<div class="kv"><span>Teléfono</span><a href="tel:${esc(r.phone.replace(/[^+\d]/g,''))}">${esc(r.phone)}</a></div>`:''}
 ${link('Web',r.web)}${link('Empleo',r.careers)}${link('Instagram',r.ig)}${link('LinkedIn',r.li)}${link('Fuente',r.src)}<div class="kv"><span>Verificación</span><div>${VER[r.st]}</div></div></div>
 ${r.lat?`<a class="btn sec" href="https://maps.apple.com/?daddr=${r.lat},${r.lng}&dirflg=d">Cómo llegar</a>`:''}${r.phone?`<a class="btn sec" href="tel:${esc(r.phone.replace(/[^+\d]/g,''))}">Llamar</a>`:''}
 <h2>Estado</h2><div class="card"><select id="sts">${ST.map(s=>`<option ${p.s===s?'selected':''}>${s}</option>`).join('')}</select>
 ${p.sent?`<p class="muted">Enviado: ${p.sent}${p.fu?' · Seguimiento: '+p.fu:''}</p>`:''}<textarea id="notes" placeholder="Notas…" style="margin-top:8px;background:var(--bg)">${esc(p.notes)}</textarea></div>
 ${dnc||!r.email?'':`<h2>Email</h2><div class="seg"><button data-lic="1" class="${view.lic?'on':''}">Licencia DHA activa</button><button data-lic="0" class="${view.lic?'':'on'}">Eligibility Letter</button></div>
 <div class="card"><div class="muted">Para: ${esc(r.email)}</div><div style="font-weight:600;margin-top:4px">${esc(r.subj)}</div><pre class="mail">${esc(b)}</pre></div>
 <div class="note info">📎 Adjunta tu CV desde Archivos antes de enviar.</div>
 ${ok?`<a class="btn" id="mail" href="${mailto(r,r.subj,b)}">Abrir en Mail</a>`:''}
 <div class="grid"><button class="btn sec small" data-c="e">Copiar email</button><button class="btn sec small" data-c="s">Copiar asunto</button></div><button class="btn sec small" data-c="b">Copiar texto</button>
 ${ok&&p.s==='No enviado'?'<button class="btn sec" id="mk">Marcar como enviado</button>':''}`}`);
 $('#sts').onchange=e=>{setStatus(r,e.target.value);render()};$('#notes').onchange=e=>{p.notes=e.target.value;save();toast('Nota guardada')};
 A.querySelectorAll('[data-lic]').forEach(x=>x.onclick=()=>{view.lic=+x.dataset.lic;render()});
 A.querySelectorAll('[data-c]').forEach(x=>x.onclick=()=>copy({e:r.email,s:r.subj,b}[x.dataset.c]));
 const mk=$('#mk');if(mk)mk.onclick=()=>{setStatus(r,'Enviado');toast('Marcado como enviado');render()};
 const m=$('#mail');if(m)m.onclick=()=>setTimeout(()=>{if(pg(r.id).s==='No enviado'&&confirm('¿Lo enviaste? Marcar como "Enviado".')){setStatus(r,'Enviado');render()}},1500);
}
function fu(){const rs=pendingFU(),up=D.rows.filter(r=>{const s=pg(r.id);return s.s==='Enviado'&&s.fu>today()}).sort((a,b)=>pg(a.id).fu.localeCompare(pg(b.id).fu));
 shell('Seguimientos',`${rs.length?rs.map(r=>{const t=fuText(r);return `<div class="card"><div class="row"><div class="grow"><b>${esc(r.name)}</b><div class="muted">Enviado ${pg(r.id).sent} · vence ${pg(r.id).fu}</div></div></div>
 <pre class="mail">${esc(t)}</pre><a class="btn small" href="${mailto(r,fuSubj(r),t)}">Abrir en Mail</a><div class="grid"><button class="btn sec small" data-cp="${r.id}">Copiar texto</button><button class="btn sec small" data-done="${r.id}">Marcar enviado</button></div></div>`}).join(''):'<div class="empty">No hay seguimientos pendientes hoy 🎉</div>'}
 ${up.length?`<h2>Próximos</h2>${up.map(r=>`<button class="item" data-id="${r.id}"><div class="t">${esc(r.name)}</div><div class="muted">Seguimiento el ${pg(r.id).fu}</div></button>`).join('')}`:''}`);
 A.querySelectorAll('[data-cp]').forEach(b=>b.onclick=()=>copy(fuText(rowById(b.dataset.cp))));
 A.querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>{setStatus(rowById(b.dataset.done),'Seguimiento enviado');toast('Seguimiento marcado');render()});
}
function more(){shell('Ajustes',`<div class="card"><b>Copia de seguridad</b><p class="muted">Tu progreso solo se guarda en este dispositivo. Exporta un JSON de vez en cuando (p. ej. a Archivos).</p>
 <button class="btn" id="ex">Exportar progreso</button><label class="btn sec">Importar progreso<input id="im" type="file" accept="application/json,.json" hidden></label></div>
 <div class="card"><b>Seguridad</b><p class="muted">Los datos están cifrados (AES-GCM, PBKDF2). “Bloquear” olvida la clave en este dispositivo.</p><button class="btn sec" id="lk" style="color:var(--bad)">Bloquear</button></div>
 <p class="muted" style="text-align:center">${D.rows.length} empleadores · progreso: ${Object.values(P).filter(x=>x.s!=='No enviado').length} actualizados</p>`);
 $('#ex').onclick=async()=>{const t=JSON.stringify({v:1,exported:new Date().toISOString(),progress:P},null,1),f=new File([t],`outreach-progreso-${today()}.json`,{type:'application/json'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f]});return}catch{}}const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;a.click()};
 $('#im').onchange=async e=>{try{const j=JSON.parse(await e.target.files[0].text());const pr=j.progress||j;if(typeof pr!=='object')throw 0;if(confirm(`Importar ${Object.keys(pr).length} registros y reemplazar el progreso actual?`)){P=pr;save();toast('Progreso importado');render()}}catch{alert('Archivo no válido')}};
 $('#lk').onclick=lock;
}
function render(){if(view.id)return detail();({home,list,fu,more})[view.tab]()}
function start(){render()}
(async()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
 const k=await kget();if(k){try{D=await decryptWith(k);return start()}catch{await kset(null)}}lockScreen()})().catch(()=>lockScreen('No se pudieron cargar los datos (¿sin conexión en la primera visita?)'));
