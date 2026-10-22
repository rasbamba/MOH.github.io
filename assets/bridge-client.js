/* GitHub Pages -> Apps Script authenticated message bridge (no CORS/JSONP). */
(() => {
  'use strict';
  const cfg = window.MOH_CLEAN_CONFIG || {};
  const status = document.getElementById('connectionBanner');
  const label = document.getElementById('connectionText');
  const directLink = document.getElementById('fallbackAppLink');
  const messages = {
    de: { connecting:'Sichere Verbindung zu Google Sheets wird hergestellt…', ready:'Mit Google Sheets verbunden.', missing:'Konfiguration fehlt. Tragen Sie die Apps-Script-/exec-URL in config.js ein.', failed:'Verbindung fehlgeschlagen. Die Apps-Script-Bereitstellung und GITHUB_ORIGIN prüfen.', direct:'Direkte App öffnen' },
    en: { connecting:'Connecting securely to Google Sheets…', ready:'Connected to Google Sheets.', missing:'Configuration missing. Add your Apps Script /exec URL to config.js.', failed:'Backend connection failed. Check the Apps Script deployment and GITHUB_ORIGIN.', direct:'Open the direct app' },
    ar: { connecting:'جارٍ الاتصال الآمن بجداول بيانات Google…', ready:'تم الاتصال بجداول بيانات Google.', missing:'الإعداد غير مكتمل. أضف رابط Apps Script المنتهي بـ /exec إلى config.js.', failed:'فشل الاتصال بالخادم. تحقق من النشر وإعداد GITHUB_ORIGIN.', direct:'فتح التطبيق مباشرةً' },
    fr: { connecting:'Connexion sécurisée à Google Sheets…', ready:'Connecté à Google Sheets.', missing:'Configuration manquante. Ajoutez l’URL Apps Script /exec dans config.js.', failed:'Connexion impossible. Vérifiez le déploiement Apps Script et GITHUB_ORIGIN.', direct:'Ouvrir l’application directe' },
    it: { connecting:'Connessione sicura a Google Sheets…', ready:'Connesso a Google Sheets.', missing:'Configurazione mancante. Inserisci l’URL Apps Script /exec in config.js.', failed:'Connessione non riuscita. Verifica la distribuzione Apps Script e GITHUB_ORIGIN.', direct:'Apri l’app diretta' }
  };
  function language(){let l='de';try{l=localStorage.getItem('moh_clean_language')||'de';}catch(e){}return messages[l]?l:'de';}
  let state='connecting';
  function announce(next){state=next;const words=messages[language()];
    status.hidden=next==='ready';status.classList.toggle('bad',next==='failed'||next==='missing');
    label.textContent=words[next]||words.failed; directLink.textContent=words.direct;
    directLink.hidden=!(next==='failed');
  }
  document.addEventListener('change',e=>{if(e.target.matches('.ui-language-select')){
    // Locales saves its choice in localStorage in the same change event.
    queueMicrotask(()=>announce(state));
  }});
  let u;
  try {
    u=new URL(String(cfg.appsScriptUrl||''));
    if(u.protocol!=='https:'||u.hostname!=='script.google.com'||!/^\/macros\/s\/[^/]+\/exec\/?$/.test(u.pathname))throw Error('Invalid backend URL');
  } catch(e){announce('missing');window.MohCleanBridge={call:()=>Promise.reject(new Error('Configure the Apps Script /exec URL in docs/config.js first.'))};return;}
  directLink.href=u.href;
  announce('connecting');
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
  const frame=document.createElement('iframe');
  frame.title='Moh-clean secure Google Sheets API bridge';frame.setAttribute('aria-hidden','true');
  frame.style.cssText='position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;border:0;';
  u.searchParams.set('mode','bridge');u.searchParams.set('bridgeNonce',nonce);
  frame.src=u.href;
  const allowedMethods=new Set([
    'apiLogin','apiLogout','apiBootstrap','apiChangePassword','apiSetSignature','apiGetMonth','apiSaveDays',
    'apiRequestDeleteDay','apiSubmitMonth','apiAdminDashboard','apiListRequests','apiDecideRequest',
    'apiListUsers','apiCreateUser','apiItUpdateUser','apiItResetPassword','apiItEditDay'
  ]);
  let peer=null,peerOrigin='',resolveReady,rejectReady;
  const pending=new Map(); let sequence=0;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  // Prevent an unhandled rejection if setup fails before a user attempts login.
  ready.catch(()=>{});
  const startupTimer=setTimeout(()=>{
    if(peer)return;
    const err=new Error('Google Apps Script bridge did not respond. Check web app access and GITHUB_ORIGIN.');
    announce('failed');rejectReady(err);
  },25000);
  const trustedGoogleOrigin=(origin)=>{
    try{const h=new URL(origin).hostname.toLowerCase();return origin.startsWith('https://') &&
      (h==='script.google.com'||h==='script.googleusercontent.com'||h.endsWith('.googleusercontent.com'));}catch(e){return false;}
  };
  window.addEventListener('message',event=>{
    const m=event.data;
    if(!m||typeof m!=='object'||m.app!=='moh-clean-v1'||m.nonce!==nonce||!trustedGoogleOrigin(event.origin))return;
    if(m.type==='ready'&&!peer){
      peer=event.source;peerOrigin=event.origin;clearTimeout(startupTimer);announce('ready');resolveReady();return;
    }
    if(event.source!==peer||event.origin!==peerOrigin||m.type!=='response')return;
    const p=pending.get(m.id);if(!p)return;
    clearTimeout(p.timer);pending.delete(m.id);
    if(m.ok)p.resolve(m.value);else p.reject(new Error(String(m.error||'Backend request failed.')));
  });
  window.MohCleanBridge={
    call:async(method,...args)=>{
      if(!allowedMethods.has(method))throw Error('Backend method not allowed.');
      await ready;
      return new Promise((resolve,reject)=>{
        const id=String(++sequence);
        const timer=setTimeout(()=>{pending.delete(id);reject(Error('Backend request timed out.'));},45000);
        pending.set(id,{resolve,reject,timer});
        try{peer.postMessage({app:'moh-clean-v1',type:'request',nonce,id,method,args},peerOrigin);}
        catch(e){clearTimeout(timer);pending.delete(id);reject(e);}
      });
    },
    status:()=>state
  };
  document.body.appendChild(frame);
})();
