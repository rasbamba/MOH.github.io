'use strict';
const $ = (id) => document.getElementById(id);
const st = {token:'',me:null,page:'daily',month:'',currentRecord:null,currentDailyRecord:null,users:[],signatureUrl:'',busy:false};
const esc = (value) => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const call = (fn,...args) => window.MohCleanBridge.call(fn,...args);
function today_(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function minutes_(start,end,breakM){if(!start||!end)return 0;const time=s=>{const [h,m]=s.split(':').map(Number);return h*60+m;};return Math.max(0,((time(end)-time(start)+1440)%1440)-Number(breakM||0));}
function fmt_(min){const m=Math.max(0,Number(min||0));return `${Math.floor(m/60)} ${tr_('Std.')} ${String(m%60).padStart(2,'0')} ${tr_('Min.')}`;}
function shortFmt_(min){const m=Number(min||0);return `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`;}
function dateLabel_(m,d){return String(d).padStart(2,'0')+'.'+m.slice(5,7)+'.'+m.slice(0,4);}
function numberOfDays_(month){const [y,m]=month.split('-').map(Number);return new Date(y,m,0).getDate();}
function toast_(message,isError=false){const el=$('toast');el.textContent=message;el.className='toast show'+(isError?' bad':'');clearTimeout(toast_.timer);toast_.timer=setTimeout(()=>el.className='toast',5400);}
function error_(err){console.error(err);toast_(tr_(err && err.message || String(err)),true);if(/Session expired|Session revoked/.test(err?.message||''))signOut_();}
async function task_(fn){if(st.busy)return;st.busy=true;try{await fn();}catch(e){error_(e);}finally{st.busy=false;}}
function persist_(){try{sessionStorage.setItem('an_session',st.token);}catch(e){}}
function clearSession_(){try{sessionStorage.removeItem('an_session');}catch(e){}}
function showLogin_(){$('loginScreen').classList.remove('hidden');$('appScreen').classList.add('hidden');}
function showApp_(){$('loginScreen').classList.add('hidden');$('appScreen').classList.remove('hidden');}
async function signOut_(){const old=st.token;st.token='';st.me=null;st.currentRecord=null;clearSession_();showLogin_();if(old)try{await call('apiLogout',old);}catch(e){}}
function roleLabel_(role){return tr_({EMPLOYEE:'MITARBEITER',ADMIN:'ADMINISTRATOR',IT_ADMIN:'IT ADMIN'}[role]||role);}
function personTag_(user){return `<span class="person-tag"><span class="person-dot" style="background:${esc(user.color)}"></span>${esc(user.name)}</span>`;}
function notifyState_(){
  const role=st.me.role;document.querySelectorAll('.role-admin').forEach(el=>el.classList.toggle('hidden',!['ADMIN','IT_ADMIN'].includes(role)));
  document.querySelectorAll('.role-it').forEach(el=>el.classList.toggle('hidden',role!=='IT_ADMIN'));
  document.querySelectorAll('.it-edit-col').forEach(el=>el.classList.toggle('hidden',role!=='IT_ADMIN'));
  $('roleTag').textContent=roleLabel_(role);
  $('identityChip').innerHTML=`<span class="avatar" style="color:${esc(st.me.color)}">${esc(st.me.name.slice(0,1).toUpperCase())}</span><span class="identity-name">${esc(st.me.name)}</span>`;
  $('myProfile').innerHTML=`<div class="profile-line"><span class="profile-avatar" style="background:${esc(st.me.color)}">${esc(st.me.name.slice(0,1).toUpperCase())}</span><div><strong>${esc(st.me.name)}</strong><small>${esc(st.me.email)}</small></div></div><div class="profile-meta"><div><small>UNTERNEHMEN</small><b>${esc(st.me.company)}</b></div><div><small>ROLLE</small><b>${esc(roleLabel_(role))}</b></div></div>`;
  $('signatureState').textContent=tr_(st.me.hasSignature?'GESPEICHERT':'NICHT HINTERLEGT');
  const nav=$('mobileNav');nav.innerHTML='';document.querySelectorAll('#nav [data-page]').forEach(btn=>{
    if(btn.classList.contains('hidden'))return;
    const b=document.createElement('button');b.textContent=btn.textContent.trim();b.dataset.page=btn.dataset.page;b.className=st.page===btn.dataset.page?'active':'';nav.appendChild(b);
  });
}
async function initialize_(loginResult){st.token=loginResult.token;st.me=loginResult.user;st.month=today_().slice(0,7);persist_();showApp_();
  $('dailyDate').value=today_();['monthlyMonth','recordsMonth','adminMonth'].forEach(id=>$(id).value=st.month);
  notifyState_();
  if(st.me.mustChange){showChangePassword_(true);}else{await showPage_('daily');}
}
async function restore_(){try{st.token=sessionStorage.getItem('an_session')||'';}catch(e){}if(!st.token)return;
  try{const data=await call('apiBootstrap',st.token);await initialize_({token:st.token,user:data.user});}
  catch(e){clearSession_();st.token='';showLogin_();}
}
async function showPage_(page){if(!st.me)return;
  if(page==='admin'&&!['ADMIN','IT_ADMIN'].includes(st.me.role))return;
  if(page==='users'&&st.me.role!=='IT_ADMIN')return;
  st.page=page;
  document.querySelectorAll('.page').forEach(el=>el.classList.toggle('hidden',el.id!==`page-${page}`));
  document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
  $('crumb').textContent=tr_({daily:'Zeiterfassung / Täglich',monthly:'Zeiterfassung / Monat',records:'Archiv / Monat abfragen',admin:'Verwaltung / Dashboard',users:'IT / Benutzerverwaltung'}[page]);
  if(page==='daily')await loadDaily_();
  if(page==='monthly')await loadMonthly_();
  if(page==='records')await loadRecords_();
  if(page==='admin')await loadDashboard_();
  if(page==='users')await loadUsers_();
}
function refreshDailyTotal_(){const code=$('dailyCode').value;const n=code?0:minutes_($('dailyStart').value,$('dailyEnd').value,$('dailyBreak').value);$('dailyCalc').textContent=fmt_(n);}
async function loadDaily_(){const date=$('dailyDate').value;if(!date)return;const month=date.slice(0,7);const day=Number(date.slice(8,10));
  const data=await call('apiGetMonth',st.token,st.me.id,month);st.currentDailyRecord=data;
  const d=data.days.find(x=>x.day===day)||{start:'',end:'',breakMinutes:0,code:'',notes:''};
  $('dailyStart').value=d.start;$('dailyEnd').value=d.end;$('dailyBreak').value=d.breakMinutes;$('dailyCode').value=d.code;$('dailyNotes').value=d.notes;refreshDailyTotal_();
  if(data.signature){st.signatureUrl=data.signature;$('signaturePreview').innerHTML=`<img src="${data.signature}" alt="Gespeicherte Unterschrift">`;}
  else $('signaturePreview').innerHTML=`<span>${esc(tr_('Keine Unterschrift gespeichert'))}</span>`;
}
function dailyEntry_(){return {day:Number($('dailyDate').value.slice(8,10)),start:$('dailyStart').value,end:$('dailyEnd').value,breakMinutes:Number($('dailyBreak').value||0),code:$('dailyCode').value,notes:$('dailyNotes').value};}
async function saveDaily_(){const date=$('dailyDate').value;if(!date)throw Error(tr_('Select a date.'));const result=await call('apiSaveDays',st.token,date.slice(0,7),[dailyEntry_()]);
  toast_(tr_('Saved: {created} new · {pending} pending approval · {unchanged} unchanged',result));await loadDaily_();}
async function deleteDaily_(){const date=$('dailyDate').value;if(!date)return;if(!confirm(tr_('Delete the entry for {date} and request approval?',{date})))return;
  const result=await call('apiRequestDeleteDay',st.token,date.slice(0,7),Number(date.slice(8,10)));toast_(tr_('Deletion requests: {pending}.',result));await loadDaily_();}
function monthlyRow_(day,entry,month){const e=entry||{},valid=day<=numberOfDays_(month),attrs=valid?'':'disabled';
  return `<tr data-day="${day}" class="${entry?'is-saved ':''}${valid?'':'is-invalid'}"><td>${String(day).padStart(2,'0')}</td>
  <td><input type="time" class="start" value="${esc(e.start||'')}" ${attrs}></td>
  <td><input type="number" class="break" value="${esc(e.breakMinutes||0)}" min="0" max="1440" ${attrs}></td>
  <td><input type="time" class="end" value="${esc(e.end||'')}" ${attrs}></td>
  <td class="duration-cell">${shortFmt_(e.minutes||0)}</td>
  <td><select class="code" ${attrs}><option value="">—</option>${['K','U','F'].map(x=>`<option value="${x}" ${e.code===x?'selected':''}>${x}</option>`).join('')}</select></td>
  <td><input type="text" class="notes" maxlength="500" placeholder="Notiz" value="${esc(e.notes||'')}" ${attrs}></td></tr>`;
}
async function loadMonthly_(){const month=$('monthlyMonth').value;if(!month)return;const result=await call('apiGetMonth',st.token,st.me.id,month);
  $('monthlyBody').innerHTML=Array.from({length:31},(_,i)=>monthlyRow_(i+1,result.days.find(d=>d.day===i+1),month)).join('');
  refreshMonthTotals_();}
function readMonthlyRows_(){const rows=[];document.querySelectorAll('#monthlyBody tr').forEach(tr=>{
  if(tr.classList.contains('is-invalid'))return;
  const val=cls=>tr.querySelector('.'+cls).value;
  const e={day:Number(tr.dataset.day),start:val('start'),end:val('end'),breakMinutes:Number(val('break')||0),code:val('code'),notes:val('notes')};
  if(e.start||e.end||e.code||e.notes)rows.push(e);
});return rows;}
function refreshMonthTotals_(){let total=0;document.querySelectorAll('#monthlyBody tr:not(.is-invalid)').forEach(tr=>{
  const v=cls=>tr.querySelector('.'+cls).value;
  const minutes=v('code')?0:minutes_(v('start'),v('end'),v('break'));
  tr.querySelector('.duration-cell').textContent=shortFmt_(minutes);total+=minutes;
});$('monthTotal').textContent=fmt_(total);}
async function saveMonthly_(){const month=$('monthlyMonth').value,entries=readMonthlyRows_();if(!entries.length)throw Error(tr_('Enter at least one day.'));
  const result=await call('apiSaveDays',st.token,month,entries);
  toast_(tr_('Month processed: {created} new · {pending} pending approval · {unchanged} unchanged',result));await loadMonthly_();}

async function fillEmployeeSelect_(){const m=$('recordsMonth').value;const wrap=$('recordsEmployeeWrap');
  if(!['ADMIN','IT_ADMIN'].includes(st.me.role)){wrap.classList.add('hidden');return;}
  wrap.classList.remove('hidden');const overview=await call('apiAdminDashboard',st.token,m);const select=$('recordsEmployee');const current=select.value||st.me.id;
  select.innerHTML=`<option value="${esc(st.me.id)}">${esc(st.me.name)} (${esc(tr_('me'))})</option>`+overview.rows.filter(r=>r.user.id!==st.me.id).map(r=>`<option value="${esc(r.user.id)}">${esc(r.user.name)}</option>`).join('');
  select.value=Array.from(select.options).some(o=>o.value===current)?current:st.me.id;
}
async function loadRecords_(keepSelection=false){const m=$('recordsMonth').value;if(!m)return;
  if(!keepSelection)await fillEmployeeSelect_();
  const employeeId=['ADMIN','IT_ADMIN'].includes(st.me.role)?$('recordsEmployee').value:st.me.id;
  const d=await call('apiGetMonth',st.token,employeeId,m);st.currentRecord=d;renderRecords_(d);
  $('documentPreviewPanel').classList.add('hidden');$('previewRecordBtn').textContent=tr_('Formular-Vorschau');}
function renderRecords_(d){
  $('recordsPersonTag').innerHTML=personTag_(d.user);
  const total=fmt_(d.sumMinutes);const pending=d.pending.length;const status=d.status;
  $('recordsStats').innerHTML=`<div class="stat"><span>GESPEICHERTE TAGE</span><b>${d.days.length}</b><small>${esc(tr_('von {total} Kalendertagen',{total:d.daysInMonth}))}</small></div><div class="stat"><span>GESAMTE ARBEITSZEIT</span><b>${total}</b><small>Pause bereits abgezogen</small></div><div class="stat"><span>MONATSSTATUS</span><b style="font-size:20px">${esc(tr_(({SUBMITTED:'EINGEREICHT',DRAFT:'ENTWURF'})[status]||status))}</b><small>${d.submittedAt?esc(d.submittedAt.slice(0,10)):'Noch nicht eingereicht'}</small></div><div class="stat"><span>ÄNDERUNGEN OFFEN</span><b>${pending}</b><small>Admin-Freigabe erforderlich</small></div>`;
  $('submitMonthBtn').classList.toggle('hidden',d.user.id!==st.me.id);
  $('recordsBody').innerHTML=Array.from({length:d.daysInMonth},(_,i)=>{
    const r=d.days.find(x=>x.day===i+1);return `<tr><td><b>${String(i+1).padStart(2,'0')}</b></td><td>${esc(r?.start||'—')}</td><td>${r?`${r.breakMinutes} Min.`:'—'}</td><td>${esc(r?.end||'—')}</td><td>${r?esc(shortFmt_(r.minutes)):'—'}</td><td>${esc(r?.code||'—')}</td><td>${esc(r?.notes||'')}</td>${st.me.role==='IT_ADMIN'?`<td><button class="btn secondary small-btn" data-edit-day="${i+1}">Bearbeiten</button></td>`:''}</tr>`;
  }).join('');
}
async function openRecord_(uid,print){await showPage_('records');if(['ADMIN','IT_ADMIN'].includes(st.me.role)){$('recordsEmployee').value=uid;}
  await loadRecords_(true);if(print)await printRecord_();}
async function togglePreview_(){
  const panel=$('documentPreviewPanel');
  if(!panel.classList.contains('hidden')){panel.classList.add('hidden');$('previewRecordBtn').textContent=tr_('Formular-Vorschau');return;}
  if(!st.currentRecord)throw Error(tr_('Query a month first.'));
  const d=await call('apiGetMonth',st.token,st.currentRecord.user.id,st.currentRecord.month);
  st.currentRecord=d;renderRecords_(d);renderPrint_(d);
  const copy=$('printSheet').cloneNode(true);copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));
  $('documentPreviewContent').replaceChildren(copy);panel.classList.remove('hidden');$('previewRecordBtn').textContent=tr_('Vorschau schließen');
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function printRecord_(){const prev=st.currentRecord;if(!prev)throw Error(tr_('Load a month first.'));
  const fresh=await call('apiGetMonth',st.token,prev.user.id,prev.month);st.currentRecord=fresh;renderRecords_(fresh);renderPrint_(fresh);window.print();}
function renderPrint_(d){$('printCompany').textContent=d.user.company;$('printName').textContent=d.user.name;
  $('printMonth').textContent=d.month.slice(5,7)+'/'+d.month.slice(0,4);
  $('printDays').innerHTML=Array.from({length:31},(_,i)=>{
    const day=i+1,x=d.days.find(z=>z.day===day);return `<tr><td>${day}</td><td>${esc(x?.start||'')}</td><td>${x&&x.breakMinutes?esc(shortFmt_(x.breakMinutes)):''}</td><td>${esc(x?.end||'')}</td><td>${x&&x.minutes?esc(shortFmt_(x.minutes)):''}</td><td>${esc(x?.code||'')}</td><td>${esc(x?.notes||'')}</td></tr>`;
  }).join('');
  $('printTotal').textContent=shortFmt_(d.sumMinutes);
  $('printSignature').src=d.signature||'';$('printSignature').style.visibility=d.signature?'visible':'hidden';
}
async function submitMonth_(){const d=st.currentRecord;if(!d||d.user.id!==st.me.id)throw Error(tr_('Only your own month can be submitted.'));
  if(!confirm(tr_('Submit this month and attach your saved signature?')))return;
  const result=await call('apiSubmitMonth',st.token,d.month);toast_(tr_('Month submitted: {count} days.',result));await loadRecords_(true);}

async function loadDashboard_(){const month=$('adminMonth').value;if(!month)return;
  const [data,requests]=await Promise.all([call('apiAdminDashboard',st.token,month),call('apiListRequests',st.token,month)]);
  const rows=data.rows,completed=rows.filter(x=>x.status==='SUBMITTED').length,minutes=rows.reduce((n,r)=>n+r.minutes,0);
  $('adminStats').innerHTML=`<div class="stat"><span>TEAMMITGLIEDER</span><b>${rows.length}</b><small>registrierte Teammitglieder</small></div><div class="stat"><span>MONATE EINGEREICHT</span><b>${completed}</b><small>${esc(tr_('{percent}% abgeschlossen',{percent:rows.length?Math.round(100*completed/rows.length):0}))}</small></div><div class="stat"><span>ARBEITSSTUNDEN</span><b>${Math.round(minutes/60*10)/10}</b><small>aufgezeichnete Stunden</small></div><div class="stat"><span>ÄNDERUNGEN OFFEN</span><b>${data.totalPending}</b><small>Freigaben erforderlich</small></div>`;
  $('teamBody').innerHTML=rows.map(row=>`<tr><td>${personTag_(row.user)}<small class="mini">${esc(row.user.email)}</small></td><td><span class="pill ${row.status==='SUBMITTED'?'submitted':'draft'}">${row.status==='SUBMITTED'?'EINGEREICHT':'ENTWURF'}</span></td><td>${row.days}</td><td>${esc(shortFmt_(row.minutes))}</td><td>${row.pending?`<span class="pill pending">${esc(tr_('{count} OFFEN',{count:row.pending}))}</span>`:'—'}</td><td><div class="user-action-btns"><button class="btn secondary small-btn" data-view-uid="${esc(row.user.id)}">Anzeigen</button><button class="btn secondary small-btn" data-print-uid="${esc(row.user.id)}">Drucken</button></div></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Keine Mitarbeiter vorhanden.</td></tr>';
  $('requestCount').textContent=tr_('{count} OFFEN',{count:requests.length});
  $('requestsContainer').innerHTML=requests.map(r=>`<div class="request-card"><div class="request-head"><strong>${personTag_(r.employee)} — ${dateLabel_(r.month,r.day)}</strong><small class="muted">${esc(r.requestedAt.slice(0,16).replace('T',' '))} UTC</small></div>
    <div class="request-columns"><div class="request-column"><b>AKTUELLER EINTRAG</b>${diffText_(r.old)}</div><div class="request-column after"><b>BEANTRAGTE ÄNDERUNG</b>${diffText_(r.proposed)}</div></div>
    <div class="request-actions"><button class="btn secondary small-btn" data-reject-req="${esc(r.id)}">Ablehnen</button><button class="btn primary small-btn" data-approve-req="${esc(r.id)}">Genehmigen</button></div></div>`).join('')||'<div class="empty">Keine offenen Änderungsanträge in diesem Monat.</div>';
}
function diffText_(d){if(d?.remove)return 'Eintrag löschen';
  return `Beginn: ${esc(d?.start||'—')} · Ende: ${esc(d?.end||'—')} · Pause: ${Number(d?.breakMinutes||0)} Min.<br>Arbeitszeit: ${esc(shortFmt_(d?.minutes||0))} · Kürzel: ${esc(d?.code||'—')}<br>Bemerkung: ${esc(d?.notes||'—')}`;}
async function decide_(id,yes){if(!confirm(tr_(yes?'Approve change and update the record?':'Reject change?')))return;
  const note=yes?'':prompt(tr_('Rejection reason (optional):'))||'';
  await call('apiDecideRequest',st.token,id,yes,note);toast_(tr_(yes?'Änderung genehmigt.':'Änderung abgelehnt.'));await loadDashboard_();}

async function loadUsers_(){st.users=await call('apiListUsers',st.token);
  $('usersBody').innerHTML=st.users.map(u=>`<tr><td>${personTag_(u)}<small class="mini">${esc(u.email)}</small></td><td>${esc(roleLabel_(u.role))}</td><td><span class="pill ${u.active?'submitted':'pending'}">${u.active?'AKTIV':'INAKTIV'}</span></td><td><div class="user-action-btns"><button class="btn secondary small-btn" data-user-edit="${esc(u.id)}">Bearbeiten</button><button class="btn secondary small-btn" data-user-reset="${esc(u.id)}">Passwort zurücksetzen</button></div></td></tr>`).join('');}
async function createUser_(form){const data=Object.fromEntries(new FormData(form).entries());const result=await call('apiCreateUser',st.token,data);
  form.reset();showTempPassword_('Benutzer erstellt',result.user.email,result.temporaryPassword);await loadUsers_();}
function showTempPassword_(title,email,password){openModal_(title,`<div class="hint-box"><b>${esc(email)}</b><br>Einmaliges temporäres Passwort. Kopieren und sicher an den Benutzer übermitteln. Es wird nicht erneut angezeigt; bei Verlust erneut zurücksetzen.</div><div class="temp-password" id="tempPass">${esc(password)}</div><button id="copyTemp" class="btn primary wide">Passwort kopieren</button>`);
  $('copyTemp').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(password);toast_(tr_('Passwort kopiert.'));}catch(e){toast_(tr_('Markieren und kopieren Sie das Passwort manuell.'),true);}});}
async function resetUser_(id){const user=st.users.find(u=>u.id===id);if(!confirm(tr_('Reset password for {name}? Existing sessions will be invalidated.',{name:user.name})))return;
  const result=await call('apiItResetPassword',st.token,id);showTempPassword_('Passwort zurückgesetzt',result.email,result.temporaryPassword);}
function editUserModal_(id){const u=st.users.find(x=>x.id===id);if(!u)return;
  openModal_('Benutzer bearbeiten',`<form id="editUserForm" class="stack"><label>Name<input name="name" value="${esc(u.name)}" required></label><label>Firma<input name="company" value="${esc(u.company)}" required></label><label>Rolle<select name="role">${['EMPLOYEE','ADMIN','IT_ADMIN'].map(v=>`<option value="${v}" ${u.role===v?'selected':''}>${esc(roleLabel_(v))}</option>`).join('')}</select></label><label>Farbmarkierung<input name="color" type="color" value="${esc(u.color)}"></label><label style="flex-direction:row;align-items:center"><input name="active" type="checkbox" ${u.active?'checked':''} style="width:auto;min-height:0"> Benutzer aktiv</label><button type="submit" class="btn primary wide">Änderungen speichern</button></form>`);
  $('editUserForm').onsubmit=e=>{e.preventDefault();task_(async()=>{const f=e.target,data=Object.fromEntries(new FormData(f).entries());data.active=f.elements.active.checked;
    await call('apiItUpdateUser',st.token,id,data);closeModal_();toast_(tr_('Benutzerprofil aktualisiert.'));await loadUsers_();});};
}
function itEditDayModal_(day){const d=st.currentRecord;if(!d)return;const e=d.days.find(x=>x.day===day)||{day,start:'',end:'',breakMinutes:0,code:'',notes:''};
  openModal_('IT-Korrektur · '+dateLabel_(d.month,day),`<div class="hint-box">Nur IT-Administratoren dürfen Arbeitszeiten direkt korrigieren. Änderungen werden im AuditLog erfasst. Mitarbeiteränderungen erfordern weiterhin Admin-Genehmigung.</div>
  <form id="itEditForm" class="stack" style="margin-top:15px"><div class="form-grid"><label>Beginn<input name="start" type="time" value="${esc(e.start||'')}"></label><label>Ende<input name="end" type="time" value="${esc(e.end||'')}"></label><label>Pause (Min.)<input name="breakMinutes" type="number" min="0" value="${Number(e.breakMinutes||0)}"></label><label>Kürzel<select name="code">${['','K','U','F'].map(c=>`<option value="${c}" ${e.code===c?'selected':''}>${c||'—'}</option>`).join('')}</select></label></div><label>Bemerkungen<input name="notes" maxlength="500" value="${esc(e.notes||'')}"></label><label style="flex-direction:row;align-items:center"><input type="checkbox" name="remove" style="width:auto;min-height:0"> Bestehenden Eintrag löschen</label><button class="btn primary wide">Korrektur speichern</button></form>`);
  $('itEditForm').onsubmit=ev=>{ev.preventDefault();task_(async()=>{const f=ev.target,fields=Object.fromEntries(new FormData(f).entries());fields.day=day;fields.breakMinutes=Number(fields.breakMinutes||0);fields.remove=f.elements.remove.checked;
    await call('apiItEditDay',st.token,d.user.id,d.month,fields);closeModal_();toast_(tr_('IT-Korrektur protokolliert.'));await loadRecords_(true);});};
}

function openModal_(title,body){$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modalBackdrop').classList.remove('hidden');}
function closeModal_(){if(st.me?.mustChange)return toast_(tr_('Bitte zuerst Ihr temporäres Passwort ändern.'),true);$('modalBackdrop').classList.add('hidden');$('modalBody').innerHTML='';}
function showChangePassword_(forced){openModal_(forced?'Erstpasswort ändern':'Passwort ändern',`<p class="muted">${forced?'Aus Sicherheitsgründen muss das vorläufige Passwort geändert werden.':'Geben Sie Ihr aktuelles Passwort und ein neues Passwort ein.'}</p>
  <form id="changePasswordForm" class="stack"><label>Aktuelles Passwort<input name="old" type="password" required autocomplete="current-password"></label><label>Neues Passwort<input name="next" type="password" required minlength="12" autocomplete="new-password" placeholder="Mindestens 12 Zeichen mit Buchstaben und Zahlen"></label><button type="submit" class="btn primary wide">Passwort aktualisieren</button></form>`);
  $('modalClose').classList.toggle('hidden',Boolean(forced));
  $('changePasswordForm').onsubmit=e=>{e.preventDefault();task_(async()=>{const f=e.target;const result=await call('apiChangePassword',st.token,f.elements.old.value,f.elements.next.value);st.me=result.user;notifyState_();$('modalClose').classList.remove('hidden');closeModal_();toast_(tr_('Passwort aktualisiert.'));await showPage_('daily');});};
}
function signatureModal_(){openModal_('Unterschrift hinterlegen',`<p class="muted">Mit dem Finger oder der Maus unterschreiben oder eine Bilddatei hochladen. Die Unterschrift wird geschützt gespeichert und kann später automatisch für den Monatsdruck geladen werden.</p>
    <div class="tabs"><button class="btn primary" type="button" id="drawTab">Unterschreiben</button><button class="btn secondary" type="button" id="uploadTab">Bild hochladen</button></div>
    <div id="drawPanel"><canvas class="signature-pad" width="600" height="180" id="sigCanvas"></canvas><button type="button" class="btn ghost" id="clearSig">Zeichnung löschen</button></div>
    <div id="uploadPanel" class="hidden"><label>Unterschriftsbild (PNG/JPG/WebP)<input type="file" id="sigFile" accept="image/png,image/jpeg,image/webp"></label><div class="signature-preview" id="uploadPreview"><span>Keine Datei ausgewählt</span></div></div>
    <label style="margin-top:15px">Passwort zur Bestätigung<input id="sigPassword" type="password" required></label>
    <div class="modal-footer"><button id="saveSignature" class="btn primary">Unterschrift speichern</button></div>`);
  let mode='draw',uploaded='';const canvas=$('sigCanvas');const ctx=canvas.getContext('2d');ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#142f48';
  let drawing=false,hasDrawing=false;
  const coords=ev=>{const rect=canvas.getBoundingClientRect();return {x:(ev.clientX-rect.left)*canvas.width/rect.width,y:(ev.clientY-rect.top)*canvas.height/rect.height};};
  canvas.addEventListener('pointerdown',ev=>{ev.preventDefault();drawing=true;hasDrawing=true;canvas.setPointerCapture(ev.pointerId);const p=coords(ev);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.01,p.y+.01);ctx.stroke();});
  canvas.addEventListener('pointermove',ev=>{if(!drawing)return;ev.preventDefault();const p=coords(ev);ctx.lineTo(p.x,p.y);ctx.stroke();});
  ['pointerup','pointercancel','pointerleave'].forEach(name=>canvas.addEventListener(name,()=>drawing=false));
  $('clearSig').onclick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);hasDrawing=false;};
  function tab(next){mode=next;$('drawPanel').classList.toggle('hidden',next!=='draw');$('uploadPanel').classList.toggle('hidden',next!=='upload');$('drawTab').className='btn '+(next==='draw'?'primary':'secondary');$('uploadTab').className='btn '+(next==='upload'?'primary':'secondary');}
  $('drawTab').onclick=()=>tab('draw');$('uploadTab').onclick=()=>tab('upload');
  $('sigFile').onchange=async(ev)=>{const file=ev.target.files?.[0];if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>3000000)return toast_('PNG/JPG/WebP bis 3 MB auswählen.',true);
    try{uploaded=await imageScaled_(file);$('uploadPreview').innerHTML=`<img src="${uploaded}" alt="Unterschriftvorschau">`;}catch(e){error_(e);}
  };
  $('saveSignature').onclick=()=>task_(async()=>{const password=$('sigPassword').value;if(!password)throw Error(tr_('Enter your password.'));
    const data=mode==='draw'?(hasDrawing?canvas.toDataURL('image/png'):''):uploaded;
    if(!data)throw Error(tr_('Draw a signature or select a file.'));
    await call('apiSetSignature',st.token,password,data);st.me.hasSignature=true;notifyState_();closeModal_();toast_(tr_('Unterschrift gespeichert.'));await loadDaily_();
  });
}
function imageScaled_(file){return new Promise((resolve,reject)=>{const img=new Image(),reader=new FileReader();reader.onload=()=>img.src=reader.result;
  reader.onerror=()=>reject(Error('File could not be read.'));img.onerror=()=>reject(Error('Invalid image.'));
  img.onload=()=>{const c=document.createElement('canvas');c.width=600;c.height=180;const x=c.getContext('2d');
    const s=Math.min(c.width/img.width,c.height/img.height,1);x.drawImage(img,(c.width-img.width*s)/2,(c.height-img.height*s)/2,img.width*s,img.height*s);
    resolve(c.toDataURL('image/png'));};reader.readAsDataURL(file);});}

// All privileged actions call server-side role-checked functions. Hiding UI alone is not authorization.
$('loginForm').onsubmit=e=>{e.preventDefault();task_(async()=>{const result=await call('apiLogin',$('loginEmail').value,$('loginPassword').value);$('loginPassword').value='';await initialize_(result);});};
$('logoutBtn').onclick=()=>task_(signOut_);
$('changePasswordBtn').onclick=()=>showChangePassword_(false);
$('modalClose').onclick=closeModal_;
$('modalBackdrop').onclick=e=>{if(e.target===$('modalBackdrop'))closeModal_();};
document.querySelectorAll('#nav').forEach(nav=>nav.onclick=e=>{const btn=e.target.closest('[data-page]');if(btn)task_(()=>showPage_(btn.dataset.page));});
$('mobileNav').onclick=e=>{const btn=e.target.closest('[data-page]');if(btn)task_(()=>showPage_(btn.dataset.page));};
$('dailyDate').onchange=()=>task_(loadDaily_);
['dailyStart','dailyEnd','dailyBreak','dailyCode'].forEach(id=>$(id).oninput=refreshDailyTotal_);
$('dailyCode').onchange=()=>{const inactive=Boolean($('dailyCode').value);if(inactive){$('dailyStart').value='';$('dailyEnd').value='';$('dailyBreak').value=0;}refreshDailyTotal_();};
$('dailyForm').onsubmit=e=>{e.preventDefault();task_(saveDaily_);};
$('dailyDeleteBtn').onclick=()=>task_(deleteDaily_);
$('signatureBtn').onclick=signatureModal_;
$('monthlyLoadBtn').onclick=()=>task_(loadMonthly_);
$('monthlyBody').oninput=refreshMonthTotals_;
$('monthlyBody').onchange=e=>{if(e.target.classList.contains('code')&&e.target.value){const tr=e.target.closest('tr');tr.querySelector('.start').value='';tr.querySelector('.end').value='';tr.querySelector('.break').value='0';refreshMonthTotals_();}};
$('monthlySaveBtn').onclick=()=>task_(saveMonthly_);
$('recordsLoadBtn').onclick=()=>task_(loadRecords_);
$('recordsEmployee').onchange=()=>task_(()=>loadRecords_(true));
$('printBtn').onclick=()=>task_(printRecord_);
$('previewRecordBtn').onclick=()=>task_(togglePreview_);
$('submitMonthBtn').onclick=()=>task_(submitMonth_);
$('recordsBody').onclick=e=>{const btn=e.target.closest('[data-edit-day]');if(btn&&st.me.role==='IT_ADMIN')itEditDayModal_(Number(btn.dataset.editDay));};
$('adminRefreshBtn').onclick=()=>task_(loadDashboard_);
$('teamBody').onclick=e=>{const a=e.target.closest('[data-view-uid],[data-print-uid]');if(!a)return;
  const isPrint=a.hasAttribute('data-print-uid');const id=a.dataset.viewUid||a.dataset.printUid;
  $('recordsMonth').value=$('adminMonth').value;task_(()=>openRecord_(id,isPrint));};
$('requestsContainer').onclick=e=>{const yes=e.target.closest('[data-approve-req]');const no=e.target.closest('[data-reject-req]');if(yes||no)task_(()=>decide_((yes||no).dataset.approveReq||no.dataset.rejectReq,!!yes));};
$('createUserForm').onsubmit=e=>{e.preventDefault();task_(()=>createUser_(e.target));};
$('usersBody').onclick=e=>{const edit=e.target.closest('[data-user-edit]'),reset=e.target.closest('[data-user-reset]');if(edit)editUserModal_(edit.dataset.userEdit);if(reset)task_(()=>resetUser_(reset.dataset.userReset));};
translateDom_();
restore_();
