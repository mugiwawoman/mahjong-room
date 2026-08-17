'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

function extractScript(file) {
  const s = fs.readFileSync(file, 'utf8');
  const m = s.match(/<script>([\s\S]*?)<\/script>/g) || [];
  return m.map(b => b.replace(/^<script>/, '').replace(/<\/script>$/, '')).join('\n');
}

class ClassList {
  constructor() { this.s = new Set(); }
  add(...c) { c.forEach(x => this.s.add(x)); }
  remove(...c) { c.forEach(x => this.s.delete(x)); }
  contains(c) { return this.s.has(c); }
  toggle(c, on) { if (on === undefined) on = !this.s.has(c); on ? this.s.add(c) : this.s.delete(c); return on; }
}

class El {
  constructor(id, tag) {
    this.id = id || ''; this.tagName = (tag || 'DIV').toUpperCase();
    this._html = ''; this.textContent = ''; this.value = '';
    this.hidden = false; this.disabled = false; this.checked = false;
    this.dataset = {}; this.classList = new ClassList(); this.style = {};
    this.handlers = {}; this.children = []; this.files = [];
    this.clientWidth = 720; this.offsetWidth = 100; this.href = '';
    this.attrs = {};
    this.options = [];
    this.selectedIndex = -1;
    this.kids = [];
    this.parent = null;
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) {
    this._html = String(v);
    this.kids = parseHTML(this._html);
    if (this._html.indexOf('<option') >= 0) {
      this.options = (this._html.match(/<option[^>]*>/g) || []).map(t => {
        const m = /value="([^"]*)"/.exec(t);
        return { value: m ? m[1] : '', selected: /\sselected/.test(t) };
      });
      this.selectedIndex = this.options.length ? 0 : -1;
    } else if (this._html === '') { this.options = []; this.selectedIndex = -1; }
  }
  addEventListener(t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); }
  removeEventListener() {}
  fire(t, ev) { (this.handlers[t] || []).forEach(fn => fn.call(this, ev || {})); }
  querySelector(sel) { return queryAll(this.kids, sel)[0] || null; }
  querySelectorAll(sel) { return queryAll(this.kids, sel); }
  appendChild(c) { this.children.push(c); return c; }
  closest(sel) { for (let c = this; c; c = c.parent) if (matches(c, sel)) return c; return null; }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  focus() {} select() {} click() {} scrollIntoView() {} remove() {} blur() {}
  insertBefore(c) { this.children.push(c); return c; }
  contains(n) { for (let c = n; c; c = c.parent) if (c === this) return true; return false; }
  matches() { return false; }
  get parentNode() { return this.parent || null; }
  get nextElementSibling() { return null; }
  get firstChild() { return null; }
  getBoundingClientRect() { return { top: 0, left: 0, width: 720, height: 240, right: 720, bottom: 240 }; }
  getContext() { return { measureText: () => ({ width: 40 }), font: '' }; }
}

/* ---- 最小のHTMLパーサ + セレクタ照合 ----
   ページが innerHTML に流し込んだタグ列を、querySelector が効く程度の木にする。
   目的は「ページ側のコードをそのまま走らせる」こと。完全なDOMは目指さない。 */
const VOID_TAGS = new Set(['input', 'br', 'hr', 'img', 'i', 'option']);
function parseHTML(html) {
  const roots = [], stack = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*?)?)\/?>/g;
  let m;
  while ((m = re.exec(html))) {
    const closing = m[0][1] === '/';
    const tag = m[1].toLowerCase();
    if (closing) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tagName.toLowerCase() === tag) { stack.length = i; break; }
      }
      continue;
    }
    const el = new El('', tag);
    const attrs = m[2] || '';
    let a;
    /* value 付き / 値なし(data-net, hidden …)どちらも拾う */
    const are = /([a-zA-Z][a-zA-Z0-9-]*)(?:\s*=\s*"([^"]*)")?/g;
    while ((a = are.exec(attrs))) {
      const k = a[1], v = a[2] === undefined ? '' : a[2];
      el.attrs[k] = v;
      if (k === 'class') v.split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
      else if (k === 'id') el.id = v;
      else if (k === 'value') el.value = v;
      else if (k === 'hidden') el.hidden = true;
      else if (k === 'disabled') el.disabled = true;
      else if (k.slice(0, 5) === 'data-') el.dataset[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v;
    }
    if ('hidden' in el.attrs) el.hidden = true;
    const parent = stack.length ? stack[stack.length - 1] : null;
    el.parent = parent;
    (parent ? parent.kids : roots).push(el);
    if (!VOID_TAGS.has(tag) && !/\/>$/.test(m[0])) stack.push(el);
  }
  return roots;
}
function matches(el, part) {
  const tag = (part.match(/^[a-zA-Z][a-zA-Z0-9]*/) || [''])[0];
  if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
  for (const c of part.match(/\.[A-Za-z0-9_-]+/g) || []) if (!el.classList.contains(c.slice(1))) return false;
  for (const i of part.match(/#[A-Za-z0-9_-]+/g) || []) if (el.id !== i.slice(1)) return false;
  for (const b of part.match(/\[[^\]]+\]/g) || []) {
    const kv = b.slice(1, -1).split('=');
    const k = kv[0];
    if (!(k in el.attrs)) return false;
    if (kv.length > 1 && el.attrs[k] !== kv[1].replace(/^["']|["']$/g, '')) return false;
  }
  return true;
}
function walk(nodes, out) { for (const n of nodes) { out.push(n); walk(n.kids, out); } return out; }
function queryAll(nodes, sel) {
  const res = [];
  for (const one of String(sel).split(',')) {
    const parts = one.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    let cur = walk(nodes, []);
    for (let i = 0; i < parts.length; i++) {
      const next = [];
      for (const el of cur) {
        if (i === 0) { if (matches(el, parts[i])) next.push(el); }
        else for (const d of walk(el.kids, [])) if (matches(d, parts[i])) next.push(d);
      }
      cur = i === 0 ? next : next;
    }
    for (const el of cur) if (res.indexOf(el) < 0) res.push(el);
  }
  return res;
}

function makeEnv(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.storage || {});
  const els = {};
  const log = {
    confirms: [], alerts: [], fetches: [], puts: [], toasts: [], errors: [], prompts: []
  };
  const timers = [];

  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => {
      if (opts.storageFull) throw new Error('QuotaExceededError');
      store[k] = String(v);
    },
    removeItem: k => { delete store[k]; }
  };

  const document = {
    getElementById(id) { return els[id] || (els[id] = new El(id)); },
    querySelector(sel) {
      if (sel && sel[0] === '#') return this.getElementById(sel.slice(1));
      return els['__' + sel] || (els['__' + sel] = new El('', 'DIV'));
    },
    querySelectorAll(sel) {
      const res = [];
      for (const one of String(sel).split(',')) {
        const t = one.trim();
        const m = /^#([A-Za-z0-9_-]+)\s+(.+)$/.exec(t);
        if (m) {
          const host = els[m[1]];
          if (host) for (const e of queryAll(host.kids, m[2])) if (res.indexOf(e) < 0) res.push(e);
          continue;
        }
        const roots = Object.keys(els).map(k => els[k]);
        for (const host of roots) for (const e of queryAll(host.kids, t)) if (res.indexOf(e) < 0) res.push(e);
      }
      return res;
    },
    createElement(tag) { return new El('', tag); },
    addEventListener(t, fn) { (docHandlers[t] = docHandlers[t] || []).push(fn); },
    hidden: false,
    body: new El('body', 'body'),
    documentElement: new El('html', 'html')
  };
  const docHandlers = {};

  const location = { hash: opts.hash || '', href: opts.href || 'https://x.test/p.html', search: '' };
  const history = { replaceState(a, b, url) { if (url && url[0] === '#') location.hash = url; } };

  const ctx = {
    console,
    document, location, history, localStorage,
    navigator: { clipboard: null },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    Blob: function () {},
    FileReader: function () { this.readAsText = () => {}; },
    btoa, atob, Date, Math, JSON, isFinite, Number, String, Object, Array, RegExp, Error, parseInt, parseFloat, escape, unescape,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '#123456' }),
    MutationObserver: function () { this.observe = () => {}; },
    requestAnimationFrame: fn => { timers.push(fn); return timers.length; },
    setTimeout: (fn, ms) => { timers.push(fn); return timers.length; },
    clearTimeout: id => { if (id) timers[id - 1] = null; },
    setInterval: () => 0, clearInterval: () => {},
    confirm: msg => { log.confirms.push(String(msg)); return !!(opts.confirm === undefined ? true : (typeof opts.confirm === 'function' ? opts.confirm(String(msg)) : opts.confirm)); },
    alert: msg => { log.alerts.push(String(msg)); },
    prompt: (msg, def) => { log.prompts.push(String(msg)); return opts.promptReply === undefined ? def : opts.promptReply; },
    fetch: (url, init) => {
      log.fetches.push({ url: String(url), init: init || {} });
      if (init && init.method === 'PUT') log.puts.push({ url: String(url), body: init.body });
      if (!opts.fetch) return Promise.reject(new Error('no network'));
      return opts.fetch(String(url), init || {}, log);
    }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.window.addEventListener = () => {};
  ctx.self = ctx;

  return {
    ctx, log, store, els, timers, docHandlers,
    fireDoc(t, ev) { (docHandlers[t] || []).forEach(fn => fn(ev || {})); },
    flush() {
      for (let i = 0; i < timers.length; i++) {
        const fn = timers[i];
        if (fn) { timers[i] = null; try { fn(); } catch (e) { log.errors.push('timer: ' + e.message); } }
      }
    },
    el(id) { return document.getElementById(id); },
    toastText() { return els['toast'] ? String(els['toast'].textContent) : ''; },
    storeWarn() { const e = els['store-warn']; return e ? { hidden: e.hidden, text: String(e.textContent) } : null; }
  };
}

function run(file, opts) {
  const env = makeEnv(opts);
  const code = extractScript(file);
  try {
    vm.runInNewContext(code, env.ctx, { filename: path.basename(file), timeout: 15000 });
  } catch (e) {
    env.log.errors.push('load: ' + e.message);
    env.threw = e;
  }
  return env;
}

const tick = () => new Promise(r => setImmediate(r));
async function settle(env, n) {
  for (let i = 0; i < (n || 8); i++) { await tick(); env.flush(); await tick(); }
}

module.exports = { run, makeEnv, extractScript, settle, tick, El };
