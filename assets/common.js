/* Utilitas bersama halaman peserta & admin */
(function () {
  var cfg = window.APP_CONFIG || {};

  function api(action, data, opts) {
    opts = opts || {};
    var body = Object.assign({ action: action }, data || {});
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeout || 30000) : null;
    return fetch(cfg.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (timer) clearTimeout(timer);
      if (j && j.serverNow) api.offset = j.serverNow - Date.now();
      if (!j.ok) {
        var e = new Error(j.error || 'Terjadi kesalahan');
        e.auth = /^AUTH:/.test(j.error || '');
        e.message = (j.error || '').replace(/^AUTH:\s*/, '');
        throw e;
      }
      return j;
    }, function (err) {
      if (timer) clearTimeout(timer);
      var e = new Error('Koneksi ke server gagal. Periksa internet Anda lalu coba lagi.');
      e.network = true;
      throw e;
    });
  }
  api.offset = 0;
  api.now = function () { return Date.now() + api.offset; };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function tgl(ms, withTime, short) {
    if (!ms) return '–';
    var d = typeof ms === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ms) ? new Date(ms + 'T00:00:00') : new Date(ms);
    if (isNaN(d)) return String(ms);
    var s = d.getDate() + ' ' + (short ? BLN : BULAN)[d.getMonth()] + ' ' + d.getFullYear();
    if (withTime) s += ', ' + String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0');
    return s;
  }
  function durasi(detik) {
    detik = Math.max(0, Math.round(detik || 0));
    var m = Math.floor(detik / 60), s = detik % 60;
    return m ? m + ' mnt ' + s + ' dtk' : s + ' dtk';
  }

  var toastT;
  function toast(msg, ms) {
    var el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.add('hidden'); }, ms || 2600);
  }

  /** Dialog sederhana. buttons: [{label, cls, value}] → Promise(value) */
  function dialog(html, buttons, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var bg = document.createElement('div');
      bg.className = 'modal-bg';
      bg.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '" role="dialog" aria-modal="true">' + html +
        '<div class="actions"></div></div>';
      var act = bg.querySelector('.actions');
      (buttons || [{ label: 'Tutup', value: true }]).forEach(function (b) {
        var btn = document.createElement('button');
        btn.className = 'btn ' + (b.cls || '');
        btn.type = 'button';
        btn.textContent = b.label;
        btn.onclick = function () {
          if (b.onClick) { var r = b.onClick(bg); if (r === false) return; }
          document.body.removeChild(bg); resolve(b.value);
        };
        act.appendChild(btn);
      });
      document.body.appendChild(bg);
      var f = bg.querySelector('input,select,textarea,button');
      if (f) f.focus();
    });
  }

  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
    var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
    return Promise.resolve();
  }

  window.GT = { api: api, esc: esc, tgl: tgl, durasi: durasi, toast: toast, dialog: dialog, copyText: copyText, cfg: cfg };
})();
