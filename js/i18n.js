(() => {
  "use strict";
  const VERSION = "1.21.01-universal-presentation-dev398-source-comment-cleanup";
  const STORAGE_KEY = "rml-builder-language-v1";
  const state = { language: localStorage.getItem(STORAGE_KEY) || "en", fallback: {}, active: {}, previousCatalog: {}, manifest: null, ready: null, catalogs: new Map(), reverseCatalogs: new WeakMap() };
  const norm = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const textSources = new WeakMap();
  const attrSources = new WeakMap();
  function lookup(value) {
    const raw=String(value ?? "");
    const explicit=norm(raw).match(/^\{\{i18n:([A-Za-z0-9_.-]+)\}\}$/);
    if(explicit){ const key=explicit[1]; return state.active[key] ?? state.fallback[key] ?? raw; }
    const key=norm(raw); return state.active[key] ?? state.fallback[key] ?? value;
  }
  function catalogReverse(catalog) {
    if (!catalog || typeof catalog !== "object") return new Map();
    const cached=state.reverseCatalogs.get(catalog); if(cached) return cached;
    const reverse=new Map();
    for(const [key,value] of Object.entries(catalog)){
      if(typeof value!=="string") continue;
      const bucket=reverse.get(value) || [];
      bucket.push(key); reverse.set(value,bucket);
    }
    state.reverseCatalogs.set(catalog,reverse); return reverse;
  }
  function relocalizeValue(value) {
    if(typeof value!=="string" || !value) return value;
    const keys=catalogReverse(state.previousCatalog).get(value);
    if(!keys?.length) return value;
    const targets=[...new Set(keys.map(key=>state.active[key] ?? state.fallback[key]).filter(v=>typeof v==="string"))];
    return targets.length===1 ? targets[0] : value;
  }
  const TECHNICAL_RELOCALIZE_KEYS = new Set([
    "id","key","type","operatorId","nodeId","connectionId","fromNode","toNode",
    "fromPort","toPort","path","url","href","src","file","fileName","filename",
    "resource","resourcePath","storageKey","projectId","schemaVersion","version"
  ]);
  function isTechnicalRelocalizeString(key,value){
    const k=String(key||"");
    const v=String(value||"");
    if(TECHNICAL_RELOCALIZE_KEYS.has(k)) return true;
    if(/(?:Id|ID|Key|Path|Url|URL|Href|Src|File|Filename|Resource)$/.test(k)) return true;
    if(/^(?:https?:|file:|blob:|data:)/i.test(v)) return true;
    if(/[\\/]/.test(v) && /\.[A-Za-z0-9]{1,8}(?:[?#].*)?$/.test(v)) return true;
    if(/\.(?:json|js|css|html|svg|png|jpg|jpeg|webp|dll|cs|csproj|zip|gz)$/i.test(v)) return true;
    if(/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*){2,}$/.test(v)) return true;
    return false;
  }
  function relocalize(root) {
    const seen=new WeakSet();
    const stats={visited:0,strings:0,changed:0,frozen:0,ambiguousOrUnknown:0,technicalSkipped:0};
    const walk=value=>{
      if(!value || typeof value!=="object" || seen.has(value)) return;
      seen.add(value); stats.visited++;
      if(Object.isFrozen(value)){ stats.frozen++; return; }
      for(const key of Object.keys(value)){
        const current=value[key];
        if(typeof current==="string"){
          stats.strings++;
          if(isTechnicalRelocalizeString(key,current)){ stats.technicalSkipped++; continue; }
          const next=relocalizeValue(current);
          if(next!==current){ value[key]=next; stats.changed++; }
          else stats.ambiguousOrUnknown++;
        } else if(current && typeof current==="object") walk(current);
      }
    };
    walk(root); return stats;
  }
  function sourceText(node) {
    if (!textSources.has(node)) textSources.set(node, node.nodeValue || "");
    return textSources.get(node);
  }
  function translateTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const raw=sourceText(node), key=norm(raw); if (!key || !/[A-Za-z]/.test(key)) return;
    const translated=lookup(raw);
    if (translated === raw) return;
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
    state.language=safe; localStorage.setItem(STORAGE_KEY,safe); document.documentElement.lang=safe; syncLanguageControl();
    try {
      const [fallback,active]=await Promise.all([getCatalog("en"),getCatalog(safe)]);
      if(state.language!==safe) return state.language;
      state.previousCatalog=state.active && Object.keys(state.active).length ? state.active : (previous===safe ? active : await getCatalog(previous));
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
  function setFlagImage(img,source) {
    if(!img) return;
    const fallback=state.manifest?.fallbackFlag || "assets/i18n/flags/fallback.svg";
    img.onerror=()=>{
      img.onerror=null;
      if(img.src.endsWith(fallback)) { img.removeAttribute("src"); return; }
      img.src=fallback;
    };
    img.src=source || fallback;
  }
  function syncLanguageControl() {
    const button=document.getElementById('builder-language-open'); if(!button) return;
    const meta=languageMeta(); const tip=meta.tooltip || meta.label || state.language;
    button.title=tip; button.setAttribute('aria-label',tip);
    const img=document.getElementById('builder-language-flag'); setFlagImage(img,meta.flag);
    document.querySelectorAll('#rml-language-menu [data-language]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.language===state.language)));
  }
  function closeLanguageMenu() {
    const menu=document.getElementById('rml-language-menu'), button=document.getElementById('builder-language-open');
    if(menu){ try { if(menu.matches(':popover-open')) menu.hidePopover(); } catch(_) {} menu.hidden=true; menu.style.maxHeight=''; } if(button) button.setAttribute('aria-expanded','false');
  }
  function positionLanguageMenu(menu,button) {
    if(!menu || !button || menu.hidden) return;
    const r=button.getBoundingClientRect();
    const header=button.closest('.export-dialog-header');
    const hr=header?.getBoundingClientRect();
    const top=Math.max(8,r.bottom+6,Number.isFinite(hr?.bottom)?hr.bottom+6:0);
    const available=Math.max(0,innerHeight-top-8);
    menu.style.maxHeight=`${available}px`;
    const mw=menu.offsetWidth||170;
    menu.style.top=`${top}px`;
    menu.style.left=`${Math.max(8,Math.min(innerWidth-mw-8,r.right-mw))}px`;
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
        const img=document.createElement('img'); img.alt=''; setFlagImage(img,meta.flag);
        const label=document.createElement('span'); label.textContent=meta.label || code;
        item.append(img,label); menu.appendChild(item);
      }
      const modalHost=button.closest('dialog[open]') || button.closest('dialog') || document.body;
      modalHost.appendChild(menu);
      let selecting=false;
      menu.addEventListener('click',async e=>{
        const item=e.target?.closest?.('[data-language]');
        if(!item || !menu.contains(item) || selecting) return;
        e.preventDefault(); e.stopPropagation();
        const code=item.dataset.language;
        if(!state.manifest?.languages?.[code]) return;
        selecting=true;
        const switching=loadLanguage(code);
        closeLanguageMenu();
        try {
          await switching;
          button.focus();
        }
        catch(error) { console.error('[RML i18n] Could not switch language.',code,error); }
        finally { selecting=false; }
      });
      document.addEventListener('pointerdown',e=>{ if(!menu.hidden && !menu.contains(e.target) && e.target!==button && !button.contains(e.target)) closeLanguageMenu(); });
      window.addEventListener('resize',()=>{ if(!menu.hidden) positionLanguageMenu(menu,button); },{passive:true});
      document.addEventListener('keydown',e=>{
        if(e.key==='Escape'){ closeLanguageMenu(); return; }
        if(menu.hidden || !['ArrowDown','ArrowUp','Home','End'].includes(e.key)) return;
        const items=Array.from(menu.querySelectorAll('[data-language]:not([disabled])'));
        if(!items.length) return;
        const current=items.indexOf(document.activeElement);
        let next=0;
        if(e.key==='End') next=items.length-1;
        else if(e.key==='Home') next=0;
        else if(e.key==='ArrowDown') next=current<0?0:(current+1)%items.length;
        else next=current<0?items.length-1:(current-1+items.length)%items.length;
        e.preventDefault(); items[next].focus(); items[next].scrollIntoView({block:'nearest'});
      });
    }
    if(!button.dataset.languageBound){ button.dataset.languageBound='1'; button.addEventListener('click',(event)=>{
      event.preventDefault(); event.stopPropagation();
      const open=menu.hidden; if(!open){ closeLanguageMenu(); return; }
      menu.hidden=false; try { menu.showPopover(); } catch(_) {}
      positionLanguageMenu(menu,button);
      button.setAttribute('aria-expanded','true');
      const activeItem=menu.querySelector(`[data-language="${CSS.escape(state.language)}"]`) || menu.querySelector('[data-language]');
      activeItem?.scrollIntoView({block:'nearest'});
    }); }
    syncLanguageControl();
  }
  const observer=new MutationObserver(records=>{ for(const r of records) for(const n of r.addedNodes) translateTree(n); installLanguageControl(); });
  const nativeAlert=window.alert.bind(window), nativeConfirm=window.confirm.bind(window), nativePrompt=window.prompt.bind(window);
  window.alert=(m)=>nativeAlert(lookup(m)); window.confirm=(m)=>nativeConfirm(lookup(m)); window.prompt=(m,d)=>nativePrompt(lookup(m),d);
  function format(key, values = {}) {
    let text=String(lookup(key));
    for(const [name,value] of Object.entries(values || {})) text=text.replaceAll(`{${name}}`,String(value ?? ""));
    return text;
  }
  window.RMLI18n=Object.freeze({ version:VERSION, t:lookup, format, relocalize, relocalizeValue, get language(){return state.language;}, setLanguage:loadLanguage, translate:translateTree });
  state.ready=(async()=>{ try { state.manifest=await fetch(`assets/i18n/manifest.json?v=${VERSION}`).then(r=>r.json()); const wanted=state.manifest.languages?.[state.language]?state.language:(state.manifest.default||'en'); await loadLanguage(wanted); } catch(e) { console.warn('[RML i18n] language catalog unavailable; English source text remains active.',e); } installLanguageControl(); observer.observe(document.documentElement,{subtree:true,childList:true}); })();
})();
