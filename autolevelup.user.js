// ==UserScript==
// @name         discord level up april fool game
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  Auto level up
// @match        https://canary.discord.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      canary.discord.com
// ==/UserScript==

(function () {
  'use strict';

  const BASE = 'https://canary.discord.com/api/v9/gorilla/activity/gathering';
  const CYCLES_PER_LEVEL = 14;

  let token = '';
  let running = false;
  let loopId = 0;
  let cycleCount = 0;
  let targetCycles = 0;

  function extractToken() {
    try {
      let extracted = null;
      const w = unsafeWindow;
      w.webpackChunkdiscord_app.push([[Symbol()], {}, (o) => {
        for (let e of Object.values(o.c)) {
          try {
            if (!e.exports || e.exports === w) continue;
            if (e.exports?.getToken) extracted = e.exports.getToken();
            for (let k in e.exports) {
              if (e.exports[k]?.getToken && e.exports[k][Symbol.toStringTag] !== 'IntlMessagesProxy') {
                extracted = e.exports[k].getToken();
              }
            }
          } catch { }
        }
      }]);
      w.webpackChunkdiscord_app.pop();
      return extracted;
    } catch (e) {
      return null;
    }
  }

  // --- UI ---
  const overlay = document.createElement('div');
  overlay.style.cssText = `position: fixed; top: 20px; right: 20px; z-index: 99999; background: #1e1f22; color: #fff; border-radius: 12px; padding: 16px 20px; font-family: sans-serif; font-size: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); min-width: 280px; border: 1px solid #3a3b3e;`;

  function makeLabel(text) {
    const l = document.createElement('div'); l.textContent = text; l.style.cssText = 'font-size: 11px; color: #aaa; margin-bottom: 4px;'; return l;
  }
  function makeInput(placeholder, value = '') {
    const i = document.createElement('input'); i.placeholder = placeholder; i.value = value; i.style.cssText = `width: 100%; box-sizing: border-box; background: #2b2d31; border: 1px solid #3a3b3e; border-radius: 6px; color: #fff; padding: 6px 8px; font-size: 12px; margin-bottom: 10px;`; return i;
  }

  const tokenInput = makeInput('Paste token here', ''); tokenInput.type = 'text';
  const levelInput = makeInput('Ex: 5', '1'); levelInput.type = 'number';

  // Réglages du rythme
  const speedLabel = makeLabel('Cycle Delay (ms)');
  const speedRow = document.createElement('div');
  speedRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 10px;';
  const minInput = makeInput('Min (600)', '600');
  const maxInput = makeInput('Max (800)', '800');
  minInput.type = 'number'; maxInput.type = 'number';
  speedRow.appendChild(minInput); speedRow.appendChild(maxInput);

  const statusEl = document.createElement('div'); statusEl.textContent = 'Status: Waiting'; statusEl.style.cssText = 'margin-bottom: 6px; margin-top: 10px; font-weight: bold;';
  const counterEl = document.createElement('div'); counterEl.textContent = 'Cycles: 0 / 0'; counterEl.style.cssText = 'color: #aaa; font-size: 12px; margin-bottom: 10px;';

  const progressWrap = document.createElement('div'); progressWrap.style.cssText = `background: #2b2d31; border-radius: 4px; height: 6px; margin-bottom: 10px; overflow: hidden;`;
  const progressBar = document.createElement('div'); progressBar.style.cssText = `background: #5865f2; height: 100%; width: 0%; transition: width 0.3s;`;
  progressWrap.appendChild(progressBar);

  const logEl = document.createElement('div'); logEl.style.cssText = `font-size: 11px; color: #888; max-height: 120px; overflow-y: auto; margin-bottom: 12px; font-family: monospace;`;
  const btn = document.createElement('button'); btn.textContent = 'Start Flow'; btn.style.cssText = `background: #5865f2; color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-size: 13px; width: 100%; font-weight: bold;`;

  overlay.appendChild(makeLabel('Token')); overlay.appendChild(tokenInput);
  overlay.appendChild(makeLabel('Target Level')); overlay.appendChild(levelInput);
  overlay.appendChild(speedLabel); overlay.appendChild(speedRow);
  overlay.appendChild(statusEl); overlay.appendChild(counterEl); overlay.appendChild(progressWrap); overlay.appendChild(logEl); overlay.appendChild(btn);
  document.body.appendChild(overlay);

  function log(msg) {
    const line = document.createElement('div'); line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.appendChild(line); logEl.scrollTop = logEl.scrollHeight;
  }

  function randomDelay(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function postRequest(endpoint) {
    const currentToken = tokenInput.value.trim() || token;
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: `${BASE}/${endpoint}`,
        headers: {
          'accept': '*/*',
          'authorization': currentToken,
          'content-length': '0',
          'origin': 'https://canary.discord.com',
          'referer': 'https://canary.discord.com/channels/@me',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.897 Chrome/138.0.7204.251 Electron/37.6.0 Safari/537.36',
          'x-super-properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRGlzY29yZCBDbGllbnQiLCJyZWxlYXNlX2NoYW5uZWwiOiJjYW5hcnkiLCJjbGllbnRfdmVyc2lvbiI6IjEuMC44OTciLCJvc192ZXJzaW9uIjoiMTAuMC4yNjEwMCIsIm9zX2FyY2giOiJ4NjQiLCJhcHBfYXJjaCI6Ing2NCIsInN5c3RlbV9sb2NhbGUiOiJmciIsImhhc19jbGllbnRfbW9kcyI6ZmFsc2UsImNsaWVudF9sYXVuY2hfaWQiOiJkMTA1NjA0YS02ZjZjLTRkOTQtYTRkNC0xOWI5YTM3YzQyY2IiLCJicm93c2VyX3VzZXJfYWdlbnQiOiJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCAxMC4wOyBXaW42NDsgeDY0KSBBcHBsZVdlYktpdC81MzcuMzYgKEtIVE1MLCBsaWtlIEdlY2tvKSBkaXNjb3JkLzEuMC44OTcgQ2hyb21lLzEzOC4wLjcyMDQuMjUxIEVsZWN0cm9uLzM3LjYuMCBTYWZhcmkvNTM3LjM2IiwiYnJvd3Nlcl92ZXJzaW9uIjoiMzcuNi4wIiwib3Nfc2RrX3ZlcnNpb24iOiIyNjEwMCIsImNsaWVudF9idWlsZF9udW1iZXIiOjUyMjcyOSwibmF0aXZlX2J1aWxkX251bWJlciI6NzkxODIsImNsaWVudF9ldmVudF9zb3VyY2UiOm51bGwsImxhdW5jaF9zaWduYXR1cmUiOiIyZTBhYTM0Yy0yM2VhLTQzY2MtODgzMi1iYTNjZDQyYjYyMzQiLCJjbGllbnRfaGVhcnRiZWF0X3Nlc3Npb25faWQiOiI0NWVkZTUwOC0zNDlkLTQ1ZDQtYmY5MS1mZTc5MzIzN2QxZWIiLCJjbGllbnRfYXBwX3N0YXRlIjoiZm9jdXNlZCJ9',
        },
        data: '',
        onload: (res) => {
          log(`${endpoint}: HTTP ${res.status}`);
          resolve(res.status);
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null)
      });
    });
  }

  async function cycle() {
    if (!running) return "STOPPED";

    let statusStart = await postRequest('start');
    if (statusStart === 429) return "RATE_LIMIT";

    await new Promise(r => setTimeout(r, 100));

    let statusComplete = await postRequest('complete');
    if (statusComplete === 429) return "RATE_LIMIT";

    cycleCount++;
    const pct = targetCycles > 0 ? Math.min((cycleCount / targetCycles) * 100, 100) : 0;
    progressBar.style.width = pct + '%';
    counterEl.textContent = `Cycles: ${cycleCount} / ${targetCycles}`;

    if (targetCycles > 0 && cycleCount >= targetCycles) {
      stop();
      statusEl.textContent = 'Status: Target reached / Objectif atteint';
      log('Target reached');
      return "DONE";
    }
    return "OK";
  }

  async function loop(currentId) {
    while (running && currentId === loopId) {
      const result = await cycle();

      if (result === "DONE" || result === "STOPPED") break;

      if (result === "RATE_LIMIT") {
        log('Rate limit (429)! Stop for 2.5s');
        await new Promise(r => setTimeout(r, 2500));
      } else {
        const delay = randomDelay(parseInt(minInput.value) || 600, parseInt(maxInput.value) || 800);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  function stop() {
    running = false;
    loopId++;
    btn.textContent = 'Start Flow';
    btn.style.background = '#5865f2';
  }

  btn.addEventListener('click', async () => {
    if (!running) {
      if (!tokenInput.value.trim() && !token) return log('Missing token!');

      targetCycles = (parseInt(levelInput.value) || 1) * CYCLES_PER_LEVEL;
      cycleCount = 0; running = true;
      btn.textContent = 'Stop Flow'; btn.style.background = '#ed4245';
      statusEl.textContent = `Status: Running (Target: ${targetCycles})`;

      loopId++; const myId = loopId;
      loop(myId);
    } else {
      stop(); statusEl.textContent = 'Status: Stopped';
    }
  });

  setTimeout(() => {
    const t = extractToken();
    if (t) { tokenInput.value = t; token = t; log('Token auto-detected'); }
  }, 2000);

})();
