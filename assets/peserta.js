/* Halaman peserta: login username + password, konfirmasi identitas, kerjakan bagian demi bagian */
(function () {
  var api = GT.api, esc = GT.esc;
  var $app = document.getElementById('app');
  var LETTER = 'ABCD';

  var S = {
    kode: null, kandidat: null, sections: [], perluBiodata: false, biodata: null, inForm: false,
    cur: null,          // { sec, deadline, soal, jawaban, idx }
    dirty: false, saving: false, saveErr: false,
    saveTimer: null, tick: null, submitting: false,
    logQueue: [], leftAt: null, active: false
  };

  // ---------- penyimpanan lokal (aman bila diblokir) ----------
  function ls(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }
  function backupKey() { return 'gt_ans_' + S.kode + '_' + S.cur.sec.id; }

  function fmtDur(detik) {
    var m = Math.floor(detik / 60), s = detik % 60;
    if (m >= 60) { var h = Math.floor(m / 60); m = m % 60; return h + ' jam' + (m ? ' ' + m + ' menit' : ''); }
    return (m ? m + ' menit' : '') + (s ? (m ? ' ' : '') + s + ' detik' : '');
  }

  // ================= MASUK =================
  function viewLogin(msg) {
    stopTest();
    S.active = false;
    document.body.classList.add('at-login');
    var preU = (location.hash.match(/u=([A-Za-z0-9._-]+)/) || [])[1] || '';
    $app.innerHTML =
      '<section class="login">' +
      '<img src="assets/logo.png" alt="Granostic" class="logo-big">' +
      '<h1>Tes tulis calon karyawan</h1>' +
      '<p class="lead">Masuk dengan username dan password yang Anda terima dari HR Granostic Center.</p>' +
      (msg ? '<div class="alert err" role="alert">' + esc(msg) + '</div>' : '') +
      '<form id="fLogin" autocomplete="off">' +
      '<label class="f"><span>Username</span><input id="user" type="text" autocapitalize="none" spellcheck="false" value="' + esc(preU) + '" required></label>' +
      '<label class="f"><span>Password</span><input id="pass" type="password" autocapitalize="characters" spellcheck="false" required></label>' +
      '<button class="btn block" id="bMasuk" type="submit">Masuk</button>' +
      '</form>' +
      '<p class="foot-note">Akun berlaku 3 hari sejak dibuat dan hanya bisa dipakai untuk satu kali tes.</p>' +
      '</section>';
    document.getElementById('fLogin').onsubmit = function (e) {
      e.preventDefault();
      doLogin({ username: document.getElementById('user').value.trim(), password: document.getElementById('pass').value.trim() });
    };
    document.getElementById(preU ? 'pass' : 'user').focus();
  }

  function doLogin(cred, silent) {
    var b = document.getElementById('bMasuk');
    if (b) { b.disabled = true; b.textContent = 'Memeriksa…'; }
    return api('login', cred).then(function (r) {
      S.kode = r.kandidat.kode; S.kandidat = r.kandidat; S.sections = r.sections;
      S.perluBiodata = !!r.perluBiodata; S.biodata = r.biodata || null;
      try { sessionStorage.setItem('gt_kode', S.kode); } catch (e) {}
      setWatermark();
      document.body.classList.remove('at-login');
      S.active = true;
      var started = S.sections.some(function (s) { return s.status !== 'belum'; });
      var running = S.sections.filter(function (s) { return s.status === 'berjalan'; })[0];
      if (running) return startSection(running);
      if (started) return viewDaftar();
      viewKonfirmasi();
    }).catch(function (e) {
      try { sessionStorage.removeItem('gt_kode'); } catch (x) {}
      viewLogin(silent && !e.network ? '' : e.message);
    });
  }

  // ================= DATA DIRI =================
  function totalDetik() { return S.sections.reduce(function (a, s) { return a + s.detik; }, 0); }

  function perluForm() { return S.perluBiodata && !(S.biodata && S.biodata.terisi); }

  function viewKonfirmasi() {
    var k = S.kandidat, v3 = S.perluBiodata;
    var form = perluForm();
    $app.innerHTML =
      '<section class="stack">' +
      '<h1>Periksa data diri Anda</h1>' +
      '<div class="card"><dl class="data-list">' +
      row('Nama', k.nama) + row('Posisi dilamar', k.posisi) +
      (v3 ? row('No. HP', k.no_hp || '–') :
        row('Tempat, tgl lahir', [k.tempat_lahir, k.tgl_lahir ? GT.tgl(k.tgl_lahir) : ''].filter(Boolean).join(', ') || '–') + row('Pendidikan', k.pendidikan || '–')) +
      row('Akun berlaku sampai', GT.tgl(k.berlaku_sampai, true)) +
      '</dl></div>' +
      (form ? '<div class="alert info">Sebelum tes, Anda akan mengisi <strong>Formulir Data Pelamar</strong> (sekitar 10–15 menit, tanpa batas waktu dan tanpa unggah dokumen). Formulir ini tidak dinilai.</div>' : '') +
      '<p class="muted">Jika ada data yang salah, hubungi HR sebelum memulai tes.</p>' +
      '<h2>Sebelum mulai</h2>' +
      '<ul class="rules">' +
      '<li>Tes terdiri dari ' + S.sections.length + ' bagian, total sekitar ' + fmtDur(Math.round(totalDetik() / 60) * 60) + '. Setiap bagian punya batas waktu sendiri.</li>' +
      '<li>Waktu mulai berjalan saat Anda menekan <strong>Mulai</strong> dan tetap berjalan walau koneksi terputus atau halaman ditutup.</li>' +
      '<li>Jawaban tersimpan otomatis. Anda boleh kembali ke soal sebelumnya selama waktu bagian itu masih ada (kecuali bagian Hitung Cepat).</li>' +
      '<li>Jangan berpindah tab, membuka aplikasi lain, atau mengambil tangkapan layar. Setiap kejadian dicatat dan dilaporkan ke HR.</li>' +
      '<li>Kerjakan sendiri, di tempat yang tenang, dengan koneksi internet yang stabil. Siapkan waktu yang cukup sebelum mulai.</li>' +
      (S.sections.some(function (s) { return s.id === 'KETIK'; }) ? '<li>Ada bagian <strong>Mengetik</strong>. Sebaiknya gunakan komputer/laptop dengan keyboard agar hasilnya maksimal.</li>' : '') +
      '</ul>' +
      '<label class="check"><input type="checkbox" id="cOk"><span>Data saya sudah benar dan saya siap mengikuti tes dengan jujur.</span></label>' +
      '<button class="btn block" id="bLanjut" disabled>' + (form ? 'Lanjut isi Formulir Data Pelamar' : 'Konfirmasi data diri') + '</button>' +
      '</section>';
    var c = document.getElementById('cOk'), b = document.getElementById('bLanjut');
    c.onchange = function () { b.disabled = !c.checked; };
    b.onclick = function () {
      if (form) return viewBiodata();
      siapMulai();
    };
    window.scrollTo(0, 0);
  }

  function viewBiodata() {
    S.inForm = true;
    GT.biodata.open({ kode: S.kode, kandidat: S.kandidat, onDone: function () {
      S.inForm = false;
      S.biodata = { terisi: true };
      siapMulai(true);
    } });
  }

  function siapMulai(dariForm) {
    {
      var first = S.sections[0];
      if (dariForm) $app.innerHTML = '<section class="stack"><h1>Formulir terkirim</h1><p>Terima kasih. Data pelamar Anda sudah kami terima.</p>' +
        '<button class="btn block" id="bSiap">Lanjut ke tes</button></section>';
      var tanya = function () {
        GT.dialog('<h2>Siap memulai tes?</h2><p>' + (dariForm ? 'Formulir sudah terkirim. ' : 'Data diri Anda sudah dikonfirmasi. ') + 'Tes akan dimulai dari bagian pertama, <strong>' + esc(first.nama) + '</strong>.</p>' +
          '<p class="muted">Pastikan baterai dan internet Anda cukup untuk sekitar ' + fmtDur(Math.round(totalDetik() / 60) * 60) + '.</p>',
          [{ label: 'Nanti dulu', cls: 'ghost', value: false }, { label: 'Ya, saya siap', value: true }]).then(function (ok) {
          if (ok) viewPetunjuk(first);
        });
      };
      if (dariForm) document.getElementById('bSiap').onclick = tanya; else tanya();
    }
  }
  function row(a, b) { return '<dt>' + esc(a) + '</dt><dd>' + esc(b) + '</dd>'; }

  // ================= DAFTAR BAGIAN =================
  function nextSection() { return S.sections.filter(function (s) { return s.status !== 'selesai'; })[0]; }

  function viewDaftar(note) {
    stopTest();
    var next = nextSection();
    if (!next) return viewSelesai();
    var items = S.sections.map(function (s) {
      var cls = s.status === 'selesai' ? 'done' : (s === next ? 'next' : '');
      var badge = s.status === 'selesai' ? '<span class="badge ok">Selesai</span>' :
        (s.status === 'berjalan' ? '<span class="badge run">Sedang dikerjakan</span>' : '');
      return '<li class="' + cls + '"><span class="num">' + (s.status === 'selesai' ? '✓' : s.urut) + '</span>' +
        '<div><div class="t">' + esc(s.nama) + '</div><div class="m">' + fmtDur(s.detik) + ', ' + s.jumlah + ' ' + esc(s.satuan) + '</div></div>' + badge + '</li>';
    }).join('');
    $app.innerHTML =
      '<section>' +
      (note ? '<div class="alert info" role="status">' + esc(note) + '</div>' : '') +
      '<h1>Halo, ' + esc(firstName(S.kandidat.nama)) + '</h1>' +
      '<p class="muted">Kerjakan bagian secara berurutan. Setelah sebuah bagian dikirim, bagian itu tidak bisa dibuka lagi.</p>' +
      '<ol class="steps">' + items + '</ol>' +
      '<button class="btn block" id="bNext">' + (next.status === 'berjalan' ? 'Lanjutkan ' : 'Buka ') + esc(next.nama) + '</button>' +
      '</section>';
    document.getElementById('bNext').onclick = function () {
      if (next.status === 'berjalan') startSection(next); else viewPetunjuk(next);
    };
    window.scrollTo(0, 0);
  }
  function firstName(n) { return String(n || '').split(' ')[0]; }

  function contoh(sec) {
    if (sec.id === 'TEKS') {
      return '<div class="card contoh"><p class="r-cap">Contoh</p>' +
        '<div class="ex-row"><span class="mono">asdasd890890</span><span class="mono">asdasd890890</span><b>Sama</b></div>' +
        '<div class="ex-row"><span class="mono">zxciop11111221</span><span class="mono">zxciop11112221</span><b>Tidak sama</b></div>' +
        '<div class="ex-row"><span class="mono">Illinois</span><span class="mono">Ilinois</span><b>Tidak sama</b></div></div>';
    }
    if (sec.id === 'KETIK') {
      var dv = deviceInfo();
      return '<div class="card contoh"><p class="r-cap">Contoh</p><p class="mono" style="margin:0 0 6px">Setiap pagi, Laras selalu datang sepuluh menit lebih awal.</p>' +
        '<p style="margin:0" class="muted">Ketik persis seperti itu — termasuk huruf kapital, koma, dan titik. Kata yang sudah diketik akan berwarna hijau bila benar dan merah bila salah.</p></div>' +
        (dv.jenis === 'HP/Tablet' ? '<div class="alert warn">Anda terdeteksi memakai <strong>HP/tablet</strong>. Anda tetap bisa lanjut, tetapi hasil mengetik biasanya lebih baik dengan komputer/laptop.</div>' :
          '<div class="alert info">Perangkat terdeteksi: <strong>komputer/laptop</strong>.</div>');
    }
    if (sec.id === 'KRAEP') {
      return '<div class="card contoh kr-ex"><p class="r-cap">Contoh</p>' +
        '<div class="kr-ex-col"><span>6</span><em>0</em><span>4</span><em>3</em><span>9</span></div>' +
        '<p style="margin:0">Mulai dari bawah: 9 + 4 = 13, tekan <strong>3</strong>. Lalu 4 + 6 = 10, tekan <strong>0</strong>. Begitu seterusnya ke atas.</p></div>';
    }
    return '';
  }

  var JEDA_LABEL = { motivasi: 'Semangat', lucu: 'Senyum dulu', relaks: 'Tarik napas' };
  function kataJeda() {
    var J = window.GT_JEDA; if (!J) return null;
    var used = S.jedaUsed = S.jedaUsed || {};
    var cats = Object.keys(J), cat = cats[Math.floor(Math.random() * cats.length)];
    var pool = J[cat].filter(function (t) { return !used[t]; });
    if (!pool.length) { S.jedaUsed = {}; pool = J[cat]; }
    var t = pool[Math.floor(Math.random() * pool.length)];
    S.jedaUsed[t] = 1;
    return { cat: cat, t: t };
  }

  function viewPetunjuk(sec, note) {
    stopTest();
    var jd = kataJeda();
    $app.innerHTML =
      '<section class="stack jeda">' +
      (note ? '<div class="alert info" role="status">' + esc(note) + '</div>' : '') +
      (jd ? '<div class="jeda-card ' + jd.cat + '"><span class="jeda-tag">' + esc(JEDA_LABEL[jd.cat] || '') + '</span><p>' + esc(jd.t) + '</p></div>' : '') +
      '<p class="q-part">Bagian ' + sec.urut + ' dari ' + S.sections.length + ' · berikutnya</p>' +
      '<h1>' + esc(sec.nama) + '</h1>' +
      '<div class="jeda-meta"><span><b>' + sec.jumlah + '</b> ' + esc(sec.satuan) + '</span><span><b>' + fmtDur(sec.detik) + '</b></span></div>' +
      '<div class="card"><p style="margin:0">' + esc(sec.petunjuk) + '</p></div>' + contoh(sec) +
      '<p class="muted">Ambil jeda sejenak bila perlu. Waktu baru berjalan setelah Anda menekan <strong>Siap</strong>.</p>' +
      '<button class="btn block" id="bMulai">Siap, mulai ' + esc(sec.nama) + '</button>' +
      '<button class="btn ghost block" id="bBack">Lihat daftar bagian</button>' +
      '</section>';
    document.getElementById('bMulai').onclick = function () { startSection(sec); };
    document.getElementById('bBack').onclick = function () { viewDaftar(); };
    window.scrollTo(0, 0);
  }

  // ================= PENGERJAAN =================
  function startSection(sec) {
    $app.innerHTML = '<div class="center-load"><div class="spinner"></div></div>';
    return api('start', { kode: S.kode, bagian: sec.id }).then(function (r) {
      if (r.closed) {
        S.sections = r.sections;
        var nx = nextSection();
        var msg = 'Waktu bagian ' + sec.nama + ' sudah habis. Jawaban yang tersimpan sudah dikirim.';
        return nx ? viewPetunjuk(nx, msg) : viewSelesai();
      }
      var jaw = r.jawaban || {};
      S.cur = { sec: sec, deadline: r.deadline, soal: r.soal, jawaban: jaw, idx: 0 };
      var bk = ls(backupKey());
      if (bk && bk.ans) {
        Object.keys(bk.ans).forEach(function (k) {
          var sv = jaw[k], lv = bk.ans[k];
          if (sv === undefined || (typeof lv === 'string' && typeof sv === 'string' && lv.length > sv.length)) jaw[k] = lv;
        });
        if (typeof bk.idx === 'number' && r.soal.items.length) S.cur.idx = Math.min(bk.idx, r.soal.items.length - 1);
        S.dirty = true;
      }
      sec.status = 'berjalan';
      document.getElementById('barTest').classList.remove('hidden');
      document.getElementById('timeline').classList.remove('hidden');
      document.getElementById('barSec').textContent = sec.nama;
      S.tick = setInterval(tick, r.soal.tipe === 'kraepelin' ? 200 : 500); tick();
      S.saveTimer = setInterval(function () { if (S.dirty) save(); }, r.soal.tipe === 'kraepelin' ? 5000 : (r.soal.tipe === 'ketik' ? 10000 : 15000));
      if (r.soal.tipe === 'kraepelin') krStart(); else if (r.soal.tipe === 'ketik') ktStart(); else renderQ();
    }).catch(function (e) {
      if (e.network) return viewDaftar(e.message);
      viewLogin(e.message);
    });
  }

  function stopTest() {
    clearInterval(S.tick); clearInterval(S.saveTimer); clearTimeout(S.debounce);
    S.tick = S.saveTimer = null;
    var bt = document.getElementById('barTest'); if (bt) bt.classList.add('hidden');
    var tl = document.getElementById('timeline'); if (tl) tl.classList.add('hidden');
    var nav = document.querySelector('.q-nav'); if (nav) nav.remove();
    document.body.classList.remove('kr-mode');
    document.body.classList.remove('kt-mode');
    S.keyChoose = null;
  }

  function tick() {
    if (!S.cur) return;
    var left = Math.max(0, S.cur.deadline - GT.api.now());
    var total = S.cur.sec.detik * 1000;
    var s = Math.ceil(left / 1000);
    var t = document.getElementById('barTimer');
    t.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    t.classList.toggle('low', s <= 60);
    var tl = document.getElementById('timeline');
    tl.classList.toggle('low', s <= 60);
    document.getElementById('timefill').style.width = (left / total * 100).toFixed(2) + '%';
    t.setAttribute('aria-label', 'Sisa waktu ' + Math.floor(s / 60) + ' menit ' + (s % 60) + ' detik');
    if (S.cur.soal.tipe === 'kraepelin') krTick();
    if (left <= 0 && !S.submitting) timeUp();
  }

  function answered(i) {
    var v = S.cur.jawaban[i];
    if (S.cur.soal.tipe === 'sifat') return Array.isArray(v) && v.filter(function (x) { return String(x).trim(); }).length >= S.cur.soal.min;
    return v !== undefined && v !== null && v !== '';
  }

  function renderQ() {
    var c = S.cur, so = c.soal, it = so.items[c.idx], n = so.items.length, i = c.idx;
    var head = '<div class="q-head"><span class="q-count tabnum">' + (so.tipe === 'skala' ? 'Pernyataan ' : 'Soal ') + (i + 1) + ' dari ' + n + '</span>' +
      (so.tipe === 'skala' ? '<span class="q-part">Bagian ' + it.part + ', skala 1 sampai ' + it.skala + '</span>' : '') + '</div>';
    var body = '';
    if (so.tipe === 'pilihan') {
      body = '<p class="q-text">' + esc(it.t) + '</p><div class="opts" role="radiogroup">' +
        it.opsi.map(function (o, j) {
          var on = c.jawaban[i] === j;
          return '<button type="button" class="opt' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-v="' + j + '"><span class="k">' + LETTER[j] + '</span><span>' + esc(o) + '</span></button>';
        }).join('') + '</div>';
    } else if (so.tipe === 'ab') {
      body = '<p class="q-text">Pilih pernyataan yang paling sesuai dengan diri Anda.</p><div class="opts" role="radiogroup">' +
        ['A', 'B'].map(function (k) {
          var on = c.jawaban[i] === k;
          return '<button type="button" class="opt' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-v="' + k + '"><span class="k">' + k + '</span><span>' + esc(it[k.toLowerCase()]) + '</span></button>';
        }).join('') + '</div>';
    } else if (so.tipe === 'samatidak') {
      var v0 = c.jawaban[i];
      body = '<div class="pair" aria-label="Pasangan teks">' +
        '<div class="pair-t"><span class="lbl">Kiri</span><span class="mono">' + esc(it.a) + '</span></div>' +
        '<div class="pair-t"><span class="lbl">Kanan</span><span class="mono">' + esc(it.b) + '</span></div></div>' +
        '<div class="st-btns" role="radiogroup">' +
        '<button type="button" class="opt st' + (v0 === 'S' ? ' on' : '') + '" data-v="S" aria-checked="' + (v0 === 'S') + '" role="radio">Sama</button>' +
        '<button type="button" class="opt st' + (v0 === 'T' ? ' on' : '') + '" data-v="T" aria-checked="' + (v0 === 'T') + '" role="radio">Tidak sama</button></div>' +
        '<p class="kb-hint">Di laptop: tekan S untuk sama, T untuk tidak sama.</p>';
    } else if (so.tipe === 'skala') {
      var btns = '';
      for (var v = 1; v <= it.skala; v++) btns += '<button type="button" class="' + (c.jawaban[i] === v ? 'on' : '') + '" data-v="' + v + '" aria-pressed="' + (c.jawaban[i] === v) + '">' + v + '</button>';
      body = '<p class="q-text">' + esc(it.t) + '</p>' +
        '<div class="scale n' + it.skala + '" style="--n:' + it.skala + '" role="group" aria-label="Skor 1 sampai ' + it.skala + '">' + btns + '</div>' +
        '<div class="scale-ends"><span>1 = paling tidak sesuai</span><span>' + it.skala + ' = paling sesuai</span></div>';
    } else if (so.tipe === 'sifat') {
      var arr = c.jawaban[i] || [];
      var rows = '';
      for (var r = 0; r < so.max; r++) {
        rows += '<div class="sifat-row"><span class="n">' + (r + 1) + '</span><input type="text" maxlength="60" data-r="' + r + '" value="' + esc(arr[r] || '') + '" placeholder="' +
          (r === 0 ? 'Sifat paling kuat' : (r < so.min ? 'Sifat ke-' + (r + 1) : 'Sifat ke-' + (r + 1) + ' (boleh kosong)')) + '" autocomplete="off" spellcheck="false"></div>';
      }
      body = '<p class="q-text">' + esc(it.t) + '</p>' +
        '<p class="sifat-hint">Minimal ' + so.min + ' sifat, urutkan dari yang paling kuat. Tulis sifat, bukan kegiatan.</p>' +
        '<div class="sifat-list">' + rows + '</div>';
    }
    $app.innerHTML = '<section>' + head + body + '</section>';

    var nav = document.querySelector('.q-nav');
    if (!nav) { nav = document.createElement('nav'); nav.className = 'q-nav'; document.body.appendChild(nav); }
    var last = i === n - 1;
    nav.innerHTML = '<div class="q-nav-in">' +
      '<button class="btn ghost" id="bPrev"' + (i === 0 ? ' disabled' : '') + '>Sebelumnya</button>' +
      '<button class="btn ghost icon" id="bGrid" aria-label="Daftar soal" title="Daftar soal"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor"><rect x="2" y="2" width="6.5" height="6.5" rx="1.5"/><rect x="11.5" y="2" width="6.5" height="6.5" rx="1.5"/><rect x="2" y="11.5" width="6.5" height="6.5" rx="1.5"/><rect x="11.5" y="11.5" width="6.5" height="6.5" rx="1.5"/></svg></button>' +
      (last ? '<button class="btn" id="bKirim">Kirim jawaban</button>' : '<button class="btn" id="bNext">Berikutnya</button>') +
      '</div>';
    document.getElementById('bPrev').onclick = function () { go(i - 1); };
    document.getElementById('bGrid').onclick = showGrid;
    if (last) document.getElementById('bKirim').onclick = confirmSubmit;
    else document.getElementById('bNext').onclick = function () { go(i + 1); };
    updateSaveState();

    var fast = so.tipe === 'samatidak';
    $app.querySelectorAll('.opt, .scale button').forEach(function (btn) {
      btn.onclick = function () { choose(btn.getAttribute('data-v')); };
    });
    function choose(v) {
      if (S.cur !== c || c.idx !== i) return;
      c.jawaban[i] = (so.tipe === 'ab' || so.tipe === 'samatidak') ? v : Number(v);
      changed();
      renderQ();
      if (!last) setTimeout(function () { if (S.cur === c && c.idx === i) go(i + 1); }, fast ? 90 : 260);
    }
    S.keyChoose = fast ? choose : null;
    $app.querySelectorAll('.sifat-row input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var a = (c.jawaban[i] || []).slice();
        while (a.length < so.max) a.push('');
        a[Number(inp.getAttribute('data-r'))] = inp.value;
        c.jawaban[i] = a;
        changed();
      });
    });
    var first = $app.querySelector('.sifat-row input');
    if (first && !first.value) first.focus();
  }

  function go(j) {
    if (j < 0 || j >= S.cur.soal.items.length) return;
    S.cur.idx = j;
    backup();
    renderQ();
    window.scrollTo(0, 0);
  }

  function showGrid() {
    var c = S.cur, html = '<h2>Daftar soal</h2><div class="legend"><span><i class="ans"></i>Sudah dijawab</span><span><i></i>Belum dijawab</span></div><div class="grid-nav">';
    c.soal.items.forEach(function (_, j) {
      html += '<button type="button" data-j="' + j + '" class="' + (answered(j) ? 'ans' : '') + (j === c.idx ? ' cur' : '') + '">' + (j + 1) + '</button>';
    });
    html += '</div>';
    var p = GT.dialog(html, [{ label: 'Tutup', cls: 'ghost', value: null }], { wide: true });
    document.querySelectorAll('.grid-nav button').forEach(function (b) {
      b.onclick = function () {
        var bg = b.closest('.modal-bg'); bg.parentNode.removeChild(bg);
        go(Number(b.getAttribute('data-j')));
      };
    });
    return p;
  }

  // ================= KRAEPELIN =================
  // Data: kolom[L] = string angka dari BAWAH (indeks 0) ke atas. Jawaban: jawaban[L] = string angka satuan.
  function krStart() {
    var c = S.cur, so = c.soal;
    c.kr = { L: -1, mulai: c.deadline - so.lajur * so.detik * 1000 };
    document.body.classList.add('kr-mode');
    $app.innerHTML =
      '<section class="kr">' +
      '<div class="kr-head"><span class="q-count tabnum" id="krLajur"></span><span class="kr-flash" id="krFlash" aria-live="assertive"></span></div>' +
      '<div class="kr-lane" aria-hidden="true"><i id="krLaneFill"></i></div>' +
      '<div class="kr-col" id="krCol"></div>' +
      '<div class="keypad" role="group" aria-label="Tombol angka">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(function (d) { return '<button type="button" data-d="' + d + '"' + (d === 0 ? ' class="zero"' : '') + '>' + d + '</button>'; }).join('') +
      '</div></section>';
    $app.querySelectorAll('.keypad button').forEach(function (b) {
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); krInput(b.getAttribute('data-d')); });
      b.addEventListener('click', function (e) { if (e.detail === 0) krInput(b.getAttribute('data-d')); }); // keyboard Enter/Space
    });
    krTick();
  }

  function krLajurNow() {
    var c = S.cur, so = c.soal;
    return Math.min(so.lajur - 1, Math.max(0, Math.floor((GT.api.now() - c.kr.mulai) / (so.detik * 1000))));
  }

  function krTick() {
    var c = S.cur; if (!c || !c.kr) return;
    var so = c.soal, L = krLajurNow();
    if (L !== c.kr.L) {
      var first = c.kr.L === -1;
      c.kr.L = L;
      if (!first) { save(true); flash(); }
      document.getElementById('krLajur').textContent = 'Lajur ' + (L + 1) + ' dari ' + so.lajur;
      krRender();
    }
    var into = (GT.api.now() - c.kr.mulai) - L * so.detik * 1000;
    var f = document.getElementById('krLaneFill');
    if (f) f.style.width = Math.max(0, 100 - into / (so.detik * 10)).toFixed(1) + '%';
  }

  function flash() {
    var el = document.getElementById('krFlash'); if (!el) return;
    el.textContent = 'Pindah lajur';
    el.classList.add('on');
    var col = document.getElementById('krCol'); if (col) { col.classList.remove('slide'); void col.offsetWidth; col.classList.add('slide'); }
    clearTimeout(S.flashT); S.flashT = setTimeout(function () { el.classList.remove('on'); el.textContent = ''; }, 900);
  }

  function krInput(d) {
    var c = S.cur; if (!c || !c.kr || S.submitting) return;
    var L = c.kr.L, col = c.soal.kolom[L], a = c.jawaban[L] || '';
    if (a.length >= col.length - 1) return;
    c.jawaban[L] = a + d;
    changed(true);
    krRender();
  }

  function krRender() {
    var c = S.cur, L = c.kr.L, col = c.soal.kolom[L], a = c.jawaban[L] || '';
    var j = a.length; // pasangan aktif: angka j (bawah) dan j+1 (atas)
    var lo = Math.max(0, j - 1), hi = Math.min(col.length - 1, j + 4);
    var html = '';
    for (var i = hi; i >= lo; i--) {
      var act = (i === j || i === j + 1) && j < col.length - 1;
      html += '<div class="kr-d' + (act ? ' act' : '') + (i < j ? ' past' : '') + '">' + col.charAt(i) + '</div>';
      if (i > lo) {
        var pi = i - 1; // jawaban untuk pasangan (pi, pi+1) berada di antara keduanya
        html += '<div class="kr-a' + (pi === j ? ' cur' : '') + '">' + (pi < j ? a.charAt(pi) : (pi === j ? '?' : '')) + '</div>';
      }
    }
    if (j >= col.length - 1) html = '<div class="kr-done">Lajur ini selesai. Tunggu lajur berikutnya.</div>';
    document.getElementById('krCol').innerHTML = html;
  }

  // ================= MENGETIK =================
  function deviceInfo() {
    var ua = navigator.userAgent || '';
    var coarse = false; try { coarse = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches; } catch (e) {}
    var touch = (navigator.maxTouchPoints || 0) > 0;
    var mobUA = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(ua) || (/Macintosh/.test(ua) && touch);
    var w = Math.min(screen.width || 0, screen.height || 0);
    var hp = mobUA || (coarse && touch && w < 900);
    return { jenis: hp ? 'HP/Tablet' : 'PC/Laptop', ua: ua.slice(0, 200), layar: (screen.width || 0) + 'x' + (screen.height || 0), sentuh: touch };
  }

  function ktStart() {
    var c = S.cur, so = c.soal;
    var j = c.jawaban;
    if (!j || typeof j !== 'object' || Array.isArray(j)) j = c.jawaban = {};
    if (typeof j.teks !== 'string') j.teks = '';
    var dv = deviceInfo();
    j.perangkat = Object.assign({}, dv, { keyboardLayar: !!(j.perangkat && j.perangkat.keyboardLayar) });
    j.stat = j.stat || { tombol: 0, hapus: 0, tempel: 0 };
    c.kt = { ref: so.teks.split(/\s+/).filter(Boolean) };
    document.body.classList.add('kt-mode');
    var gi = 0;
    var refHtml = so.teks.split(/\n\s*\n/).map(function (par) {
      return '<p>' + par.split(/\s+/).filter(Boolean).map(function (w) { return '<span data-i="' + (gi++) + '">' + esc(w) + '</span>'; }).join(' ') + '</p>';
    }).join('');
    $app.innerHTML = '<section class="kt">' +
      '<div class="kt-top"><span class="q-count">' + esc(so.judul || 'Teks') + '</span><span class="kt-dev">' + esc(dv.jenis) + '</span></div>' +
      '<div class="kt-ref" id="ktRef" aria-label="Teks yang harus diketik">' + refHtml + '</div>' +
      '<div class="kt-stat" aria-live="off"><span id="ktN">0 kata</span><span class="muted">Ketik di kotak bawah ini</span></div>' +
      '<textarea id="ktIn" class="kt-in" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-gramm="false" ' +
      'aria-label="Kotak mengetik" placeholder="Mulai mengetik di sini…"></textarea>' +
      '</section>';
    var nav = document.querySelector('.q-nav');
    if (!nav) { nav = document.createElement('nav'); nav.className = 'q-nav'; document.body.appendChild(nav); }
    nav.innerHTML = '<div class="q-nav-in one"><button class="btn" id="bKirim">Selesai & kirim</button></div>';
    document.getElementById('bKirim').onclick = function () {
      GT.dialog('<h2>Selesai mengetik?</h2><p>Waktu yang tersisa tidak bisa dipakai lagi setelah dikirim.</p>',
        [{ label: 'Lanjut mengetik', cls: 'ghost', value: false }, { label: 'Kirim', value: true }]).then(function (ok) { if (ok) submit(false); });
    };
    var ta = document.getElementById('ktIn');
    ta.value = j.teks;
    ta.addEventListener('beforeinput', function (e) {
      var t = e.inputType || '';
      if (/^insertFrom(Paste|Drop|Yank)/.test(t) || t === 'insertReplacementText') {
        e.preventDefault();
        if (t !== 'insertReplacementText') { j.stat.tempel++; GT.toast('Tempel teks tidak diizinkan. Silakan ketik.'); changed(true); }
      }
    });
    ta.addEventListener('keydown', function (e) { if (e.keyCode === 229) j.perangkat.keyboardLayar = true; });
    ta.addEventListener('input', function (e) {
      if (S.submitting) return;
      var t = e.inputType || '';
      if (/^delete/.test(t)) j.stat.hapus++;
      else j.stat.tombol += (e.data ? Math.min(e.data.length, 3) : 1);
      if (!j.stat.mulaiKetik) j.stat.mulaiKetik = Math.max(1, GT.api.now() - (c.deadline - c.sec.detik * 1000));
      j.stat.terakhirKetik = GT.api.now() - (c.deadline - c.sec.detik * 1000);
      j.teks = ta.value.slice(0, 9000);
      ktPaint();
      changed(true);
    });
    ktPaint();
    if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) ta.focus();
    updateSaveState();
  }

  function ktPaint() {
    var c = S.cur; if (!c || !c.kt) return;
    var typed = c.jawaban.teks.split(/\s+/).filter(Boolean);
    var endsSpace = /\s$/.test(c.jawaban.teks) || !c.jawaban.teks;
    var done = endsSpace ? typed.length : typed.length - 1; // kata yang sudah selesai diketik
    var spans = document.querySelectorAll('#ktRef span');
    var curI = Math.min(spans.length - 1, endsSpace ? typed.length : typed.length - 1);
    for (var i = 0; i < spans.length; i++) {
      var cls = '';
      if (i < done) cls = typed[i] === c.kt.ref[i] ? 'ok' : 'bad';
      else if (i === curI) cls = 'cur';
      if (spans[i].className !== cls) spans[i].className = cls;
    }
    document.getElementById('ktN').textContent = typed.length + ' kata';
    var box = document.getElementById('ktRef'), cs = spans[curI];
    if (cs && box) {
      var top = cs.offsetTop - box.offsetTop;
      if (top < box.scrollTop + 8 || top > box.scrollTop + box.clientHeight - 48) box.scrollTop = Math.max(0, top - box.clientHeight / 3);
    }
  }

  // ---------- simpan ----------
  function changed(noDebounceReset) {
    S.dirty = true;
    backup();
    if (!noDebounceReset || !S.debounce) {
      clearTimeout(S.debounce);
      S.debounce = setTimeout(function () { S.debounce = null; save(); }, 2000);
    }
    updateSaveState();
  }
  function backup() { if (S.cur) ls(backupKey(), { ans: S.cur.jawaban, idx: S.cur.idx }); }

  function save(force) {
    if (!S.cur || S.submitting) return Promise.resolve();
    if (S.saving) { if (force) S.dirty = true; return Promise.resolve(); }
    if (!S.dirty && !force) return Promise.resolve();
    S.saving = true; S.dirty = false; updateSaveState();
    var c = S.cur;
    return api('save', { kode: S.kode, bagian: c.sec.id, jawaban: c.jawaban }, { timeout: 20000 }).then(function (r) {
      S.saving = false; S.saveErr = false;
      if (r.closed && S.cur === c) { finishLocal(c, 'Waktu bagian ini sudah habis. Jawaban yang tersimpan sudah dikirim.'); return; }
      updateSaveState();
    }).catch(function () {
      S.saving = false; S.saveErr = true; S.dirty = true; updateSaveState();
    });
  }
  function updateSaveState() {
    var el = document.getElementById('saveState'); if (!el) return;
    el.classList.toggle('err', S.saveErr);
    el.textContent = S.saveErr ? 'Koneksi bermasalah, mencoba lagi' : ((S.saving || S.dirty) ? 'Menyimpan…' : 'Tersimpan');
  }

  function confirmSubmit() {
    var c = S.cur, kosong = 0;
    c.soal.items.forEach(function (_, j) { if (!answered(j)) kosong++; });
    var msg = kosong ? '<h2>Masih ada yang kosong</h2><p>' + kosong + ' ' + esc(c.sec.satuan) + ' belum ' + (c.soal.tipe === 'sifat' ? 'berisi minimal 3 sifat' : 'dijawab') + '. Kirim sekarang?</p>' :
      '<h2>Kirim jawaban?</h2><p>Setelah dikirim, bagian <strong>' + esc(c.sec.nama) + '</strong> tidak bisa dibuka lagi.</p>';
    GT.dialog(msg, [{ label: 'Kembali mengerjakan', cls: 'ghost', value: false }, { label: 'Kirim jawaban', value: true }]).then(function (ok) {
      if (ok) submit(false);
    });
  }

  function timeUp() {
    var kr = S.cur.soal.tipe === 'kraepelin';
    var ta = document.getElementById('ktIn'); if (ta) ta.disabled = true;
    GT.dialog('<h2>' + (kr ? 'Bagian selesai' : 'Waktu habis') + '</h2><p>Jawaban bagian <strong>' + esc(S.cur.sec.nama) + '</strong> sedang dikirim.</p>', []);
    submit(true);
  }

  function submit(auto, attempt) {
    var c = S.cur; if (!c) return;
    S.submitting = true;
    clearTimeout(S.debounce); S.debounce = null;
    api('submit', { kode: S.kode, bagian: c.sec.id, jawaban: c.jawaban }, { timeout: 25000 }).then(function (r) {
      document.querySelectorAll('.modal-bg').forEach(function (m) { m.remove(); });
      S.sections = r.sections;
      ls(backupKey(), null);
      S.submitting = false; S.cur = null;
      var nx = nextSection();
      if (!nx) return viewSelesai();
      var note = (auto && c.soal.tipe !== 'kraepelin' ? 'Waktu habis. ' : '') + 'Jawaban bagian ' + c.sec.nama + ' sudah terkirim.';
      viewPetunjuk(nx, note);
    }).catch(function (e) {
      attempt = (attempt || 0) + 1;
      if (attempt < 6) return setTimeout(function () { submit(auto, attempt); }, 2500 * attempt);
      S.submitting = false;
      document.querySelectorAll('.modal-bg').forEach(function (m) { m.remove(); });
      GT.dialog('<h2>Gagal mengirim</h2><p>' + esc(e.message) + '</p><p class="muted">Jawaban Anda tersimpan di perangkat ini. Coba kirim lagi.</p>',
        [{ label: 'Coba lagi', value: true }]).then(function () { submit(auto); });
    });
  }

  function finishLocal(c, note) {
    ls(backupKey(), null);
    S.cur = null;
    api('login', { kode: S.kode }).then(function (r) {
      S.sections = r.sections;
      var nx = nextSection();
      if (nx) viewPetunjuk(nx, note); else viewSelesai();
    }).catch(function () { viewSelesai(); });
  }

  // ================= SELESAI =================
  function viewSelesai() {
    stopTest();
    S.active = false;
    try { sessionStorage.removeItem('gt_kode'); } catch (e) {}
    $app.innerHTML =
      '<section class="done-hero">' +
      '<div class="done-mark"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
      '<h1>Tes selesai</h1>' +
      '<p>Terima kasih, ' + esc(firstName(S.kandidat && S.kandidat.nama)) + '. Semua jawaban Anda sudah kami terima.</p>' +
      '<p class="muted">Hasil tes akan diproses oleh tim HR Granostic Center. Anda boleh menutup halaman ini.</p>' +
      '</section>';
    flushLog();
  }

  // ================= ANTI-CURANG =================
  function setWatermark() {
    var txt = (S.kandidat.nama + '  ' + (S.kandidat.username || '')).replace(/[<&>"]/g, '');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="170"><text x="0" y="110" transform="rotate(-24 150 85)" ' +
      'font-family="sans-serif" font-size="15" fill="rgba(29,39,51,0.075)">' + txt + '</text></svg>';
    document.getElementById('watermark').style.backgroundImage = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
  }

  function curBagian() { return S.cur ? S.cur.sec.id : '-'; }

  function logEvent(jenis, durasi, t) {
    if (!S.kode) return;
    S.logQueue.push({ t: t || GT.api.now(), bagian: curBagian(), jenis: jenis, durasi: durasi || 0 });
    flushLog();
  }
  function flushLog() {
    if (!S.logQueue.length || S.flushing || !S.kode) return;
    var batch = S.logQueue.splice(0, S.logQueue.length);
    S.flushing = true;
    api('log', { kode: S.kode, events: batch }).then(function () { S.flushing = false; if (S.logQueue.length) flushLog(); })
      .catch(function () { S.flushing = false; S.logQueue = batch.concat(S.logQueue); setTimeout(flushLog, 10000); });
  }

  function leave() {
    if (!S.active || S.leftAt || S.inForm) return;
    S.leftAt = GT.api.now();
    document.body.classList.add('shielded');
    document.getElementById('shield').classList.remove('hidden');
  }
  function back() {
    if (!S.leftAt) return;
    var dur = (GT.api.now() - S.leftAt) / 1000, t = S.leftAt;
    S.leftAt = null;
    document.body.classList.remove('shielded');
    document.getElementById('shield').classList.add('hidden');
    if (dur < 1 || !S.active) return;
    logEvent('Keluar dari halaman tes', Math.round(dur), t);
    if (!document.querySelector('.modal-bg.warn-leave')) {
      GT.dialog('<h2>Peringatan</h2><p>Anda meninggalkan halaman tes selama <strong>' + GT.durasi(dur) + '</strong>. ' +
        'Kejadian ini sudah dicatat dan dilaporkan ke HR.</p><p class="muted">Tetap di halaman ini sampai tes selesai.</p>',
        [{ label: 'Lanjutkan tes', value: true }]);
      var m = document.querySelectorAll('.modal-bg'); if (m.length) m[m.length - 1].classList.add('warn-leave');
    }
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) leave(); else back(); });
  window.addEventListener('blur', leave);
  window.addEventListener('focus', back);
  window.addEventListener('pagehide', function () { if (S.active) leave(); });

  ['copy', 'cut', 'paste', 'contextmenu', 'dragstart', 'drop'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (S.inForm && (ev === 'paste' || ev === 'copy' || ev === 'cut') && e.target.closest && e.target.closest('.bio')) return;
      e.preventDefault();
    });
  });
  document.addEventListener('selectstart', function (e) {
    if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault();
  });
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    var inBio = S.inForm && e.target.closest && e.target.closest('.bio');
    if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'v', 'a', 'p', 's', 'u'].indexOf(k) >= 0 && !(inBio && ['c', 'x', 'v', 'a'].indexOf(k) >= 0)) { e.preventDefault(); return; }
    if (k === 'f12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c', 's'].indexOf(k) >= 0)) { e.preventDefault(); return; }
    if (k === 'printscreen') { onPrintScreen(); return; }
    if (document.querySelector('.modal-bg') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (S.cur && S.cur.kr && /^[0-9]$/.test(k)) { e.preventDefault(); if (!e.repeat) krInput(k); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (S.keyChoose && (k === 's' || k === 't')) { e.preventDefault(); if (!e.repeat) S.keyChoose(k.toUpperCase()); }
  });
  document.addEventListener('keyup', function (e) { if ((e.key || '').toLowerCase() === 'printscreen') onPrintScreen(); });
  var lastPS = 0;
  function onPrintScreen() {
    if (GT.api.now() - lastPS < 1500) return;
    lastPS = GT.api.now();
    try { navigator.clipboard && navigator.clipboard.writeText(' '); } catch (e) {}
    document.body.classList.add('shielded');
    setTimeout(function () { if (!S.leftAt) document.body.classList.remove('shielded'); }, 1200);
    if (S.active) logEvent('Menekan tombol screenshot');
  }
  window.addEventListener('beforeprint', function () { if (S.active) logEvent('Mencoba mencetak halaman'); });

  // ================= MULAI =================
  if (!GT.cfg.API_URL || /GANTI_DENGAN/.test(GT.cfg.API_URL)) {
    $app.innerHTML = '<div class="alert err">Aplikasi belum dikonfigurasi. Isi API_URL di config.js.</div>';
    return;
  }
  var saved = null;
  try { saved = sessionStorage.getItem('gt_kode'); } catch (e) {}
  if (saved) doLogin({ kode: saved }, true);
  else viewLogin();
})();
