// ==UserScript==
// @name         Poke'Catch 地点循环助手
// @namespace    local.pokecatch.loop
// @version      0.2.0
// @description  超过指定步数后重置当前章节
// @match        https://pokecatch-online.netlify.app/*
// @grant        none
// ==/UserScript==
(() => {
  'use strict';
  const KEY = 'pc-route-loop-settings-v1';
  const POS_KEY = 'pc-route-loop-pos-v1';
  const COLLAPSE_KEY = 'pc-route-loop-collapsed-v1';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const side = () => document.querySelector('#side-chapter');
  function current() {
    const t = clean(side()?.textContent);
    const m = t.match(/^(.*?)\s*·\s*第\s*\d+\s*章\s*(.*?)\s*[▾▼]\s*第\s*(\d+)\s*步\s*\/\s*共\s*(\d+)\s*步/);
    return m ? { region: m[1].trim(), chapter: m[2].trim(), step: +m[3], total: +m[4] } : null;
  }
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } })();

  // ---------- 面板结构 ----------
  const panel = document.createElement('div');
  panel.id = 'pc-loop-panel';
  panel.innerHTML = `
    <div id="pc-head">
      <span>地点循环助手</span>
      <button id="pc-toggle" type="button" title="收起">−</button>
    </div>
    <div id="pc-body">
      <label>章节名称 <input id="pc-name" type="text" placeholder="例如：原石徽章"></label>
      <label>结束小关 <input id="pc-limit" type="number" min="1" step="1" placeholder="例如：6"></label>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button id="pc-start" type="button">开始</button>
        <button id="pc-stop" type="button">停止</button>
      </div>
      <div id="pc-status" style="margin-top:8px;line-height:1.5;word-break:break-all">已停止</div>
    </div>`;

  Object.assign(panel.style, {
    position: 'fixed', right: '12px', top: '100px', zIndex: '2147483647',
    width: '200px', padding: '12px', background: '#1d2635', color: '#fff',
    border: '1px solid #7b8da8', borderRadius: '9px',
    boxShadow: '0 3px 16px #0008', font: '14px sans-serif',
    userSelect: 'none'
  });

  const head = panel.querySelector('#pc-head');
  const body = panel.querySelector('#pc-body');
  const toggle = panel.querySelector('#pc-toggle');

  Object.assign(head.style, {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '8px', marginBottom: '6px', fontWeight: 'bold',
    cursor: 'move', touchAction: 'none'
  });
  Object.assign(toggle.style, {
    flex: '0 0 auto', width: '22px', height: '22px', padding: '0',
    lineHeight: '18px', font: '14px monospace', cursor: 'pointer',
    color: '#fff', background: '#39465c', border: '1px solid #7b8da8',
    borderRadius: '4px'
  });

  panel.querySelectorAll('#pc-body label').forEach(e => Object.assign(e.style, { display: 'block', marginTop: '6px' }));
  panel.querySelectorAll('#pc-body input').forEach(e => Object.assign(e.style, { boxSizing: 'border-box', width: '100%', marginTop: '3px', color: '#111', background: '#fff', padding: '4px' }));
  panel.querySelectorAll('#pc-body button').forEach(e => Object.assign(e.style, { padding: '5px 12px', cursor: 'pointer', color: '#111', background: '#eee', border: '1px solid #aaa', borderRadius: '4px' }));

  const name = panel.querySelector('#pc-name'), limit = panel.querySelector('#pc-limit'), status = panel.querySelector('#pc-status');
  name.value = saved.name || ''; limit.value = saved.limit || '';

  // ---------- 收起 / 展开 ----------
  let collapsed = false;
  function setCollapsed(v) {
    collapsed = !!v;
    body.style.display = collapsed ? 'none' : '';
    panel.style.width = collapsed ? 'auto' : '200px';
    head.style.marginBottom = collapsed ? '0' : '6px';
    toggle.textContent = collapsed ? '+' : '−';
    toggle.title = collapsed ? '展开' : '收起';
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch {}
  }
  toggle.addEventListener('click', e => {
    e.stopPropagation();
    setCollapsed(!collapsed);
  });
  setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');

  document.body.append(panel);

  // ---------- 恢复上次拖动位置 ----------
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    if (p && Number.isFinite(p.left) && Number.isFinite(p.top)) {
      panel.style.right = 'auto';
      const w = panel.offsetWidth || 200, h = panel.offsetHeight || 40;
      panel.style.left = Math.max(0, Math.min(p.left, innerWidth - w)) + 'px';
      panel.style.top = Math.max(0, Math.min(p.top, innerHeight - h)) + 'px';
    }
  } catch {}

  // ---------- 拖动标题栏 ----------
  let drag = null;
  head.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('#pc-toggle')) return; // 点按钮不触发拖动
    const r = panel.getBoundingClientRect();
    drag = { sx: e.clientX, sy: e.clientY, left: r.left, top: r.top };
    panel.style.right = 'auto';
    panel.style.left = r.left + 'px';
    panel.style.top = r.top + 'px';
    head.style.cursor = 'grabbing';
    try { head.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });
  head.addEventListener('pointermove', e => {
    if (!drag) return;
    let left = drag.left + e.clientX - drag.sx;
    let top = drag.top + e.clientY - drag.sy;
    const maxL = Math.max(0, innerWidth - panel.offsetWidth);
    const maxT = Math.max(0, innerHeight - panel.offsetHeight);
    left = Math.min(Math.max(left, 0), maxL);
    top = Math.min(Math.max(top, 0), maxT);
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  });
  const finishDrag = e => {
    if (!drag) return;
    drag = null;
    head.style.cursor = 'move';
    try { head.releasePointerCapture(e.pointerId); } catch {}
    try {
      const r = panel.getBoundingClientRect();
      localStorage.setItem(POS_KEY, JSON.stringify({ left: r.left, top: r.top }));
    } catch {}
  };
  head.addEventListener('pointerup', finishDrag);
  head.addEventListener('pointercancel', finishDrag);

  // 窗口尺寸变化时防止面板跑出可视区
  addEventListener('resize', () => {
    if (!panel.style.left) return;
    const r = panel.getBoundingClientRect();
    const w = panel.offsetWidth, h = panel.offsetHeight;
    if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) {
      panel.style.left = Math.max(0, Math.min(r.left, innerWidth - w)) + 'px';
      panel.style.top = Math.max(0, Math.min(r.top, innerHeight - h)) + 'px';
    }
  });

  // ---------- 以下为原业务逻辑（未改动） ----------
  let running = false, busy = false, region = '';
  const say = s => status.textContent = s;
  const stop = message => { running = false; say(message || '已停止'); };
  async function waitFor(fn, ms = 4000) { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(100); } throw new Error('页面响应超时'); }
  function rows() {
    return [...document.querySelectorAll('main button, main [role="button"]')].filter(b => {
      const t = clean(b.textContent);
      return /^\d{1,2}\s*/.test(t) && /建议\s*Lv/i.test(t) && !/未解锁/.test(t) && !b.disabled && b.getAttribute('aria-disabled') !== 'true';
    });
  }
  function findTarget(target) { return rows().filter(b => clean(b.textContent).includes(target)); }
  async function reset(c) {
    side().click();
    await waitFor(() => rows().length >= 2);
    if (!running) return;
    const targets = findTarget(c.chapter);
    if (targets.length !== 1) throw new Error('目标章节未找到或名称不唯一');
    const other = rows().find(b => b !== targets[0]);
    if (!other) throw new Error('没有找到另一个已解锁章节');
    // 选中其他章节后，通过详情按钮开始；避免碰到章节行内的循环开关。
    other.click();
    await sleep(300);
    let otherState = current();
    if (otherState?.chapter === c.chapter) {
      const action = await waitFor(() => [...document.querySelectorAll('main button')].find(b => /^(重玩本章|开始|挑战|开始冒险)$/.test(clean(b.textContent)) && !b.disabled));
      action.click();
      await waitFor(() => current()?.chapter !== c.chapter);
    }
    if (!running) throw new Error('已停止；请手动切回目标章节');
    // 操作后游戏可能回到战斗页面，重新打开冒险列表。
    if (!rows().length) { side().click(); await waitFor(() => rows().length >= 2); }
    const match = findTarget(c.chapter);
    if (match.length !== 1) throw new Error('切回时找不到唯一的目标章节');
    match[0].click();
    await sleep(300);
    if (current()?.chapter !== c.chapter) {
      const action = await waitFor(() => [...document.querySelectorAll('main button')].find(b => /^(重玩本章|开始|挑战|开始冒险)$/.test(clean(b.textContent)) && !b.disabled));
      action.click();
    }
    await waitFor(() => { const now = current(); return now && now.region === c.region && now.chapter === c.chapter && now.step <= +limit.value; });
    say('已重置：' + c.chapter + '；继续监测');
  }
  panel.querySelector('#pc-start').onclick = () => {
    const c = current(), n = name.value.trim(), y = Number(limit.value);
    if (!c) return say('无法读取当前进度，请确认游戏语言为中文。');
    if (!n || !Number.isInteger(y) || y < 1) return say('请输入章节名称和大于 0 的整数。');
    if (c.chapter !== n) return say('请先手动进入目标章节：当前为 ' + c.chapter);
    if (y >= c.total) return say('结束小关必须小于本章总步数 ' + c.total);
    region = c.region; localStorage.setItem(KEY, JSON.stringify({name:n,limit:y})); running = true; say('监测中：' + region + ' · ' + n + '，第 ' + c.step + ' 步');
  };
  panel.querySelector('#pc-stop').onclick = () => stop('已停止');
  setInterval(async () => {
    if (!running || busy) return;
    const c = current(), n = name.value.trim(), y = Number(limit.value);
    if (!c) return stop('无法读取进度，已停止');
    if (c.region !== region || c.chapter !== n || !Number.isInteger(y) || y < 1 || y >= c.total) return stop('章节或设置已改变，已停止；请检查后重新开始');
    if (c.step <= y) { say('监测中：' + c.region + ' · ' + c.chapter + '，第 ' + c.step + '/' + c.total + ' 步'); return; }
    busy = true;
    try { say('超过第 ' + y + ' 步，正在重置…'); await reset(c); }
    catch (e) { stop('已停止：' + e.message + '。请检查当前章节。'); }
    finally { busy = false; }
  }, 300);
})();
