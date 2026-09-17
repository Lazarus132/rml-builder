(() => {
  "use strict";
  const VERSION = "1.20.32-universal-presentation-dev170-console-noise-cleanup";
  const STORAGE_KEY = "rml-builder-language-v1";
  const state = { language: localStorage.getItem(STORAGE_KEY) || "en", fallback: {}, active: {}, manifest: null, ready: null, catalogs: new Map() };
  const norm = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const textSources = new WeakMap();
  const attrSources = new WeakMap();
  function lookup(value) {
    const raw=String(value ?? "");
    const explicit=raw.match(/^\{\{i18n:([A-Za-z0-9_.-]+)\}\}$/);
    if(explicit){ const key=explicit[1]; return state.active[key] ?? state.fallback[key] ?? raw; }
    const key=norm(raw); return state.active[key] ?? state.fallback[key] ?? value;
  }
  function sourceText(node) {
    if (!textSources.has(node)) textSources.set(node, node.nodeValue || "");
    return textSources.get(node);
  }
  function translateTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const raw=sourceText(node), key=norm(raw); if (!key || !/[A-Za-z]/.test(key)) return;
    const translated=lookup(key);
    const lead=(raw.match(/^\s*/) || [""])[0], tail=(raw.match(/\s*$/) || [""])[0];
    node.nodeValue=lead+String(translated)+tail;
  }
  const ATTRS=["title","aria-label","placeholder","data-help"];
  function sourceAttr(el, attr) {
    let values=attrSources.get(el); if(!values){ values=new Map(); attrSources.set(el,values); }
    if(!values.has(attr)) values.set(attr,el.getAttribute(attr));
    return values.get(attr);
  }
  function translateElement(el) {
    if (!(el instanceof Element) || el.closest?.('[data-rml-i18n-skip]')) return;
    for (const attr of ATTRS) if (el.hasAttribute(attr)) { const raw=sourceAttr(el,attr); el.setAttribute(attr,lookup(raw)); }
    for (const n of el.childNodes) if(n.nodeType===Node.TEXT_NODE) translateTextNode(n);
  }
  function translateTree(root=document) {
    if (root.nodeType===Node.TEXT_NODE) return translateTextNode(root);
    if (root instanceof Element) translateElement(root);
    root.querySelectorAll?.('*').forEach(translateElement);
  }
  async function getCatalog(lang) {
    if (state.catalogs.has(lang)) return state.catalogs.get(lang);
    const fetchJson=async url=>{ const r=await fetch(url,{cache:"no-store"}); if(!r.ok) throw new Error(`HTTP ${r.status} for ${url}`); return r.json(); };
    const promise=(async()=>{
      const base=await fetchJson(`assets/i18n/${lang}.json?v=${VERSION}`);
      const catalogs=Array.isArray(state.manifest?.catalogs)?state.manifest.catalogs:["base"];
      if(!catalogs.includes("templates")) return base;
      try {
        const templates=await fetchJson(`assets/i18n/templates/${lang}.json?v=${VERSION}`);
        return Object.assign({},base,templates);
      } catch(error) {
        // A language may intentionally have no template overlay yet. English is canonical.
        if(lang==="en") throw error;
        return base;
      }
    })();
    state.catalogs.set(lang,promise);
    try { const catalog=await promise; state.catalogs.set(lang,catalog); return catalog; }
    catch(error) { state.catalogs.delete(lang); throw error; }
  }
  async function loadLanguage(lang) {
    const safe = state.manifest?.languages?.[lang] ? lang : (state.manifest?.default || "en");
    const previous=state.language;
    // Commit the requested language immediately. UI selection must never depend on
    // the popover remaining open while network/cache reads complete.
    state.language=safe; localStorage.setItem(STORAGE_KEY,safe); document.documentElement.lang=safe; syncLanguageControl();
    try {
      const [fallback,active]=await Promise.all([getCatalog("en"),getCatalog(safe)]);
      // Ignore a stale completion when the user selected another language meanwhile.
      if(state.language!==safe) return state.language;
      state.fallback=fallback; state.active=active; translateTree(document); syncLanguageControl();
      window.dispatchEvent(new CustomEvent("rml-language-changed",{detail:{language:safe}}));
      return safe;
    } catch(error) {
      if(state.language===safe){ state.language=previous; localStorage.setItem(STORAGE_KEY,previous); document.documentElement.lang=previous; syncLanguageControl(); }
      throw error;
    }
  }
  function languageMeta(code=state.language) {
    return state.manifest?.languages?.[code] || { label:code, tooltip:code, flag:"" };
  }
  function syncLanguageControl() {
    const button=document.getElementById('builder-language-open'); if(!button) return;
    const meta=languageMeta(); const tip=meta.tooltip || meta.label || state.language;
    button.title=tip; button.setAttribute('aria-label',tip);
    const img=document.getElementById('builder-language-flag'); if(img && meta.flag) img.src=meta.flag;
    document.querySelectorAll('#rml-language-menu [data-language]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.language===state.language)));
  }
  function closeLanguageMenu() {
    const menu=document.getElementById('rml-language-menu'), button=document.getElementById('builder-language-open');
    if(menu){ try { if(menu.matches(':popover-open')) menu.hidePopover(); } catch(_) {} menu.hidden=true; } if(button) button.setAttribute('aria-expanded','false');
  }
  function installLanguageControl() {
    document.querySelector('.builder-settings-language')?.remove();
    const button=document.getElementById('builder-language-open'); if(!button || !state.manifest) return;
    let menu=document.getElementById('rml-language-menu');
    if(!menu){
      menu=document.createElement('div'); menu.id='rml-language-menu'; menu.className='rml-language-menu'; menu.setAttribute('role','menu'); menu.setAttribute('popover','manual'); menu.hidden=true;
      for(const [code,meta] of Object.entries(state.manifest.languages || {})){
        const item=document.createElement('button'); item.type='button'; item.dataset.language=code; item.setAttribute('role','menuitemradio');
        item.title=meta.tooltip || meta.label || code;
        const img=document.createElement('img'); img.src=meta.flag || ''; img.alt='';
        const label=document.createElement('span'); label.textContent=meta.label || code;
        item.append(img,label); menu.appendChild(item);
      }
      // A modal <dialog> makes nodes outside its subtree inert. The popover must
      // therefore belong to the same modal dialog; otherwise it can be visible
      // in the top layer while receiving no hover/pointer/click events.
      const modalHost=button.closest('dialog[open]') || button.closest('dialog') || document.body;
      modalHost.appendChild(menu);
      // Use normal click activation. The popover is top-layer now, so there is no
      // need to hide it on pointerdown. Keeping it alive through pointerup/click
      // prevents retargeting and makes mouse, touch and pen selection identical.
      let selecting=false;
      menu.addEventListener('click',async e=>{
        const item=e.target?.closest?.('[data-language]');
        if(!item || !menu.contains(item) || selecting) return;
        e.preventDefault(); e.stopPropagation();
        const code=item.dataset.language;
        if(!state.manifest?.languages?.[code]) return;
        selecting=true;
        // loadLanguage commits the selected code synchronously before its first await.
        // Close only after that commit, then let the catalog application finish.
        const switching=loadLanguage(code);
        closeLanguageMenu();
        try { await switching; button.focus(); }
        catch(error) { console.error('[RML i18n] Could not switch language.',code,error); }
        finally { selecting=false; }
      });
      document.addEventListener('pointerdown',e=>{ if(!menu.hidden && !menu.contains(e.target) && e.target!==button && !button.contains(e.target)) closeLanguageMenu(); });
      document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeLanguageMenu(); });
    }
    if(!button.dataset.languageBound){ button.dataset.languageBound='1'; button.addEventListener('click',(event)=>{
      event.preventDefault(); event.stopPropagation();
      const open=menu.hidden; if(!open){ closeLanguageMenu(); return; }
      const r=button.getBoundingClientRect(); menu.hidden=false; try { menu.showPopover(); } catch(_) {}
      const mw=menu.offsetWidth||170, mh=menu.offsetHeight||80;
      menu.style.top=`${Math.max(8,Math.min(innerHeight-mh-8,r.bottom+6))}px`;
      menu.style.left=`${Math.max(8,Math.min(innerWidth-mw-8,r.right-mw))}px`;
      button.setAttribute('aria-expanded','true');
    }); }
    syncLanguageControl();
  }
  const observer=new MutationObserver(records=>{ for(const r of records) for(const n of r.addedNodes) translateTree(n); installLanguageControl(); });
  const nativeAlert=window.alert.bind(window), nativeConfirm=window.confirm.bind(window), nativePrompt=window.prompt.bind(window);
  window.alert=(m)=>nativeAlert(lookup(m)); window.confirm=(m)=>nativeConfirm(lookup(m)); window.prompt=(m,d)=>nativePrompt(lookup(m),d);
  window.RMLI18n=Object.freeze({ version:VERSION, t:lookup, get language(){return state.language;}, setLanguage:loadLanguage, translate:translateTree });
  state.ready=(async()=>{ try { state.manifest=await fetch(`assets/i18n/manifest.json?v=${VERSION}`).then(r=>r.json()); const wanted=state.manifest.languages?.[state.language]?state.language:(state.manifest.default||'en'); await loadLanguage(wanted); } catch(e) { console.warn('[RML i18n] language catalog unavailable; English source text remains active.',e); } installLanguageControl(); observer.observe(document.documentElement,{subtree:true,childList:true}); })();
})();
