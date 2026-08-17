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
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) {
    this._html = String(v);
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
  querySelector() { return null; }
  querySelectorAll() { const a = []; a.forEach = Array.prototype.forEach; return a; }
  appendChild(c) { this.children.push(c); return c; }
  closest() { return null; }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  focus() {} select() {} click() {} scrollIntoView() {} remove() {} blur() {}
  insertBefore(c) { this.children.push(c); return c; }
  contains() { return false; }
  matches() { return false; }
  get parentNode() { return null; }
  get nextElementSibling() { return null; }
  get firstChild() { return null; }
  getBoundingClientRect() { return { top: 0, left: 0, width: 720, height: 240, right: 720, bottom: 240 }; }
  getContext() { return { measureText: () => ({ width: 40 }), font: '' }; }
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
    querySelectorAll() { const a = []; return a; },
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
