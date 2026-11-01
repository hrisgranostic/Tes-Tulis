/* Halaman admin: kelola kandidat, lihat & cetak hasil, rekapitulasi */
(function () {
  var api = GT.api, esc = GT.esc, tgl = GT.tgl;
  var $app = document.getElementById('app');
  var A = { token: null, user: null, meta: null, list: null, f: { q: '', st: '', pos: '', hs: '' } };
  var X = window.GTA = { A: A };

  function ss(k, v) {
    try {
      if (v === undefined) return sessionStorage.getItem(k);
      if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v);
    } catch (e) { return null; }
  }

  function call(action, data) {
    return api(action, Object.assign({ token: A.token }, data || {})).catch(function (e) {
      if (e.auth) { logout(e.message); }
      throw e;
    });
  }

  // ================= LOGIN =================
  function viewLogin(msg) {
    document.getElementById('top').classList.add('hidden');
    $app.innerHTML =
      '<section class="login-box">' +
      '<img src="assets/logo.png" alt="Granostic">' +
      '<h1>Admin tes tulis</h1>' +
      '<p class="muted">Masuk untuk mengelola kandidat dan melihat hasil tes.</p>' +
      (msg ? '<div class="alert err" role="alert">' + esc(msg) + '</div>' : '') +
      '<form id="fL"><label class="f"><span>Username</span><input type="text" id="u" autocomplete="username" required></label>' +
      '<label class="f"><span>Password</span><input type="password" id="p" autocomplete="current-password" required></label>' +
      '<button class="btn block" id="bL">Masuk</button></form></section>';
    document.getElementById('fL').onsubmit = function (e) {
      e.preventDefault();
      var b = document.getElementById('bL'); b.disabled = true; b.textContent = 'Memeriksa…';
      api('adminLogin', { user: document.getElementById('u').value, pass: document.getElementById('p').value }).then(function (r) {
        A.token = r.token; A.user = r.user; ss('gt_adm', r.token);
        boot();
      }).catch(function (e) { viewLogin(e.message); });
    };
    document.getElementById('u').focus();
  }

  function logout(msg) {
    if (A.token) api('adminLogout', { token: A.token }).catch(function () {});
    A.token = null; A.list = null; ss('gt_adm', null);
    viewLogin(msg);
  }

  function boot() {
    $app.innerHTML = '<div class="center-load"><div class="spinner"></div></div>';
    call('adminMeta').then(function (m) {
      A.meta = m; A.user = m.user;
      document.getElementById('top').classList.remove('hidden');
      route();
    }).catch(function (e) { if (!e.auth) viewLogin(e.message); });
  }

  // ================= ROUTER =================
  function route() {
    if (!A.token) return viewLogin();
    var h = location.hash.replace('#', '') || 'kandidat';
    var tab = h.split('/')[0];
    document.querySelectorAll('.tabs a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-tab') === tab || ((tab === 'hasil' || tab === 'form' || tab === 'impor') && a.getAttribute('data-tab') === 'kandidat')); });
    window.scrollTo(0, 0);
    if (tab === 'bank') return X.viewBank(decodeURIComponent(h.split('/')[1] || ''));
    if (tab === 'impor') return X.viewImport();
    if (tab === 'form') return X.viewForm(decodeURIComponent(h.split('/')[1] || ''));
    if (tab === 'rekap') return viewRekap();
    if (tab === 'akun') return viewAkun();
    if (tab === 'hasil') return viewHasil(decodeURIComponent(h.split('/')[1] || ''));
    viewKandidat();
  }
  window.addEventListener('hashchange', route);
  document.getElementById('bLogout').onclick = function () { logout(); };

  function loadList(force) {
    if (A.list && !force) return Promise.resolve(A.list);
    return call('adminList').then(function (r) { A.list = r.list; return A.list; });
  }

  function statusBadge(r) {
    var m = { 'Selesai': 'ok', 'Sedang tes': 'run', 'Belum mulai': 'wait', 'Kedaluwarsa': 'bad', 'Tidak tuntas': 'warn' };
    return '<span class="badge ' + (m[r.statusTampil] || 'wait') + '">' + esc(r.statusTampil) + '</span>';
  }

  // ================= KANDIDAT =================
  function viewKandidat() {
    $app.innerHTML =
      '<div class="head"><div><h1>Kandidat</h1><p>Buat akun tes, kirim undangan, dan pantau progres.</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" id="bRef">Muat ulang</button><a class="btn ghost" href="#impor">Impor Excel</a><button class="btn" id="bAdd">Tambah kandidat</button></div></div>' +
      '<div class="filters"><input type="search" id="q" placeholder="Cari nama, username, atau posisi" value="' + esc(A.f.q) + '">' +
      '<select id="st"><option value="">Semua status</option>' +
      ['Belum mulai', 'Sedang tes', 'Selesai', 'Kedaluwarsa', 'Tidak tuntas'].map(function (s) { return '<option' + (A.f.st === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
      '</select></div><div id="tbl"><div class="center-load"><div class="spinner"></div></div></div>';
    document.getElementById('bAdd').onclick = function () { formKandidat(); };
    document.getElementById('bRef').onclick = function () { loadList(true).then(drawKandidat); };
    document.getElementById('q').oninput = function (e) { A.f.q = e.target.value; drawKandidat(); };
    document.getElementById('st').onchange = function (e) { A.f.st = e.target.value; drawKandidat(); };
    loadList(true).then(drawKandidat).catch(function (e) { if (!e.auth) document.getElementById('tbl').innerHTML = '<div class="alert err">' + esc(e.message) + '</div>'; });
  }

  function filtered() {
    var q = A.f.q.trim().toLowerCase();
    return (A.list || []).filter(function (r) {
      if (A.f.st && r.statusTampil !== A.f.st) return false;
      if (A.f.pos && r.posisi !== A.f.pos) return false;
      if (A.f.hs === 'lulus' && !(r.hs && r.hs.lulus)) return false;
      if (A.f.hs === 'tidak' && !(r.hs && !r.hs.lulus)) return false;
      if (q && (r.nama + ' ' + r.username + ' ' + r.posisi).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function drawKandidat() {
    var el = document.getElementById('tbl'); if (!el) return;
    var rows = filtered();
    if (!A.list.length) { el.innerHTML = '<div class="tbl-wrap"><div class="empty">Belum ada kandidat. Tekan <strong>Tambah kandidat</strong> untuk membuat akun tes pertama.</div></div>'; return; }
    if (!rows.length) { el.innerHTML = '<div class="tbl-wrap"><div class="empty">Tidak ada kandidat yang cocok dengan pencarian.</div></div>'; return; }
    el.innerHTML = '<div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>Kandidat</th><th>Akun tes</th><th>Berlaku sampai</th><th>Status</th><th>Keluar halaman</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        var started = r.statusTampil !== 'Belum mulai' && r.statusTampil !== 'Kedaluwarsa';
        var canExtend = r.statusTampil !== 'Selesai';
        return '<tr><td><div class="nm">' + esc(r.nama) + '</div><div class="sub">' + esc(r.posisi) + (r.paket_nama ? '' : ' (tanpa hard skill)') + '</div>' +
          (r.email ? '<div class="sub">' + esc(r.email) + (r.email_kirim ? ' · undangan terkirim' : '') + '</div>' : '') +
          (r.versi >= 3 ? '<div class="sub">' + (r.bio ? '<span class="badge ok sm">Formulir terisi</span>' : '<span class="badge wait sm">Formulir belum</span>') + '</div>' : '') + '</td>' +
          '<td data-l="Akun tes"><span class="kode">' + esc(r.username) + '</span><div class="sub">Password: <span class="kode">' + esc(r.password) + '</span></div></td>' +
          '<td data-l="Berlaku sampai" style="white-space:nowrap">' + tgl(r.berlaku_sampai, true, true) + '</td>' +
          '<td data-l="Status">' + statusBadge(r) + '<div class="sub">' + r.bagianSelesai + ' dari ' + r.jumlahBagian + ' bagian</div></td>' +
          '<td data-l="Keluar halaman">' + (r.keluar.n ? '<span class="badge warn">' + r.keluar.n + ' kali</span><div class="sub">' + GT.durasi(r.keluar.detik) + '</div>' : '<span class="sub">–</span>') + '</td>' +
          '<td><div class="acts">' +
          (started ? '<a class="btn sm" href="#hasil/' + encodeURIComponent(r.kode) + '">Lihat hasil</a>' : '') +
          (r.bio ? '<a class="btn ghost sm" href="#form/' + encodeURIComponent(r.kode) + '">Formulir</a>' : '') +
          (r.statusTampil !== 'Selesai' ? '<button class="btn ghost sm" data-a="inv" data-k="' + esc(r.kode) + '">Undangan</button>' : '') +
          '<button class="btn ghost sm" data-a="edit" data-k="' + esc(r.kode) + '">Ubah</button>' +
          (canExtend ? '<button class="btn ghost sm" data-a="ext" data-k="' + esc(r.kode) + '">Perpanjang</button>' : '') +
          '<button class="btn danger sm" data-a="del" data-k="' + esc(r.kode) + '">Hapus</button>' +
          '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
    el.querySelectorAll('button[data-a]').forEach(function (b) {
      var r = A.list.filter(function (x) { return x.kode === b.getAttribute('data-k'); })[0];
      b.onclick = function () {
        var a = b.getAttribute('data-a');
        if (a === 'inv') showInvite(r);
        if (a === 'edit') formKandidat(r);
        if (a === 'ext') extend(r);
        if (a === 'del') del(r);
      };
    });
  }

  function posOptions(sel) {
    var groups = {};
    A.meta.posisi.forEach(function (p) { (groups[p.divisi] = groups[p.divisi] || []).push(p); });
    return '<option value="">Pilih posisi</option>' + Object.keys(groups).map(function (g) {
      return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (p) {
        return '<option value="' + esc(p.nama) + '"' + (p.nama === sel ? ' selected' : '') + '>' + esc(p.nama) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }
  function paketOptions(sel) {
    return '<option value="">Tanpa tes hard skill</option>' + A.meta.paket.map(function (p) {
      return '<option value="' + p.kode + '"' + (p.kode === sel ? ' selected' : '') + '>' + esc(p.nama) + '</option>';
    }).join('');
  }
  function discText(code) { return code ? code.split('').join(' + ') : '–'; }

  function formKandidat(r) {
    var edit = !!r, d = r || {};
    var locked = edit && r.statusTampil !== 'Belum mulai' && r.statusTampil !== 'Kedaluwarsa';
    var v3 = !edit || r.versi >= 3;
    if (v3) {
      var h3 = '<h2>' + (edit ? 'Ubah data kandidat' : 'Tambah kandidat') + '</h2>' +
        '<div class="alert err hidden" id="fErr"></div>' +
        '<p class="muted" style="margin-top:-4px">Cukup isi nama, nomor HP, email, dan posisi. Data lain (KTP, pendidikan, riwayat kerja, harapan gaji, dll.) diisi kandidat sendiri lewat Formulir Data Pelamar sebelum tes.</p>' +
        '<div class="form-grid">' +
        '<label class="f full"><span>Nama lengkap</span><input type="text" id="fNama" value="' + esc(d.nama) + '" maxlength="100"></label>' +
        '<label class="f full"><span>No. HP / WhatsApp</span><input type="tel" id="fHp" value="' + esc(d.no_hp) + '" maxlength="20" placeholder="08…"></label>' +
        '<label class="f full"><span>Email (untuk kirim undangan)</span><input type="email" id="fEm" value="' + esc(d.email) + '" maxlength="80" placeholder="nama@gmail.com"></label>' +
        (edit ? '' : '<label class="chk full"><input type="checkbox" id="fKirim" checked><span>Kirim undangan otomatis ke email ini setelah akun dibuat</span></label>') +
        '<label class="f full"><span>Posisi yang dilamar</span><select id="fPos"' + (locked ? ' disabled' : '') + '>' + posOptions(d.posisi) + '</select></label>' +
        '<p class="hint full" id="fDisc"></p>' +
        '<label class="f full"><span>Tes hard skill</span><select id="fHs"' + (locked ? ' disabled' : '') + '>' + paketOptions(d.paket_hs) + '</select></label>' +
        '<p class="hint full">Otomatis mengikuti posisi (25 soal, ' + Math.round((A.meta.sections.filter(function (x) { return x.id === 'HS'; })[0] || { detik: 1500 }).detik / 60) + ' menit, lulus ≥ ' + A.meta.lulus + '). Ubah hanya bila perlu.</p>' +
        (locked ? '<p class="hint full">Posisi dan tes hard skill tidak bisa diubah karena kandidat sudah mulai tes.</p>' : '') +
        '</div>';
      var p3 = GT.dialog(h3, [
        { label: 'Batal', cls: 'ghost', value: null },
        { label: edit ? 'Simpan perubahan' : 'Buat akun tes', value: 'ok', onClick: function () { submitForm(edit, r, true); return false; } }
      ], { wide: true });
      bindPos();
      return p3;
    }
    var html = '<h2>' + (edit ? 'Ubah data kandidat' : 'Tambah kandidat') + '</h2>' +
      '<div class="alert err hidden" id="fErr"></div>' +
      '<div class="form-grid">' +
      '<label class="f full"><span>Nama lengkap</span><input type="text" id="fNama" value="' + esc(d.nama) + '" maxlength="100"></label>' +
      '<label class="f"><span>NIK KTP</span><input type="text" id="fNik" inputmode="numeric" value="' + esc(d.nik) + '" maxlength="16"></label>' +
      '<label class="f"><span>No. HP / WhatsApp</span><input type="tel" id="fHp" value="' + esc(d.no_hp) + '" maxlength="20"></label>' +
      '<label class="f"><span>Tempat lahir</span><input type="text" id="fTl" value="' + esc(d.tempat_lahir) + '" maxlength="60"></label>' +
      '<label class="f"><span>Tanggal lahir</span><input type="date" id="fTg" value="' + esc(d.tgl_lahir) + '"></label>' +
      '<label class="f full"><span>Alamat</span><input type="text" id="fAl" value="' + esc(d.alamat) + '" maxlength="250"></label>' +
      '<label class="f full"><span>Pendidikan terakhir</span><input type="text" id="fPd" value="' + esc(d.pendidikan) + '" maxlength="80" placeholder="Contoh: D3 Teknologi Laboratorium Medis"></label>' +
      '<label class="f full"><span>Posisi yang dilamar</span><select id="fPos"' + (locked ? ' disabled' : '') + '>' + posOptions(d.posisi) + '</select></label>' +
      '<p class="hint full" id="fDisc"></p>' +
      '<label class="f full"><span>Tes hard skill</span><select id="fHs"' + (locked ? ' disabled' : '') + '>' + paketOptions(d.paket_hs) + '</select></label>' +
      (locked ? '<p class="hint full">Posisi dan tes hard skill tidak bisa diubah karena kandidat sudah mulai tes.</p>' : '') +
      '</div>';
    var p = GT.dialog(html, [
      { label: 'Batal', cls: 'ghost', value: null },
      { label: edit ? 'Simpan perubahan' : 'Buat akun tes', value: 'ok', onClick: function () { submitForm(edit, r); return false; } }
    ], { wide: true });
    bindPos();
    return p;
  }
  function bindPos() {
    var pos = document.getElementById('fPos'), hs = document.getElementById('fHs');
    function upd(setPaket) {
      var x = A.meta.posisi.filter(function (q) { return q.nama === pos.value; })[0];
      document.getElementById('fDisc').textContent = x ? 'Profil DISC jabatan: ' + discText(x.disc) + ' (' + x.karakter + ')' : '';
      if (setPaket && x) hs.value = x.paket || '';
    }
    pos.onchange = function () { upd(true); };
    upd(!hs.value && !!pos.value);
  }

  function submitForm(edit, r, v3) {
    var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    var data = v3 ? { nama: g('fNama'), no_hp: g('fHp'), email: g('fEm'), posisi: g('fPos'), paket_hs: g('fHs'),
      nik: r ? r.nik : '', tempat_lahir: r ? r.tempat_lahir : '', tgl_lahir: r ? r.tgl_lahir : '', alamat: r ? r.alamat : '', pendidikan: r ? r.pendidikan : '' } :
      { nama: g('fNama'), nik: g('fNik'), no_hp: g('fHp'), tempat_lahir: g('fTl'), tgl_lahir: g('fTg'), alamat: g('fAl'),
      pendidikan: g('fPd'), posisi: g('fPos'), paket_hs: g('fHs') };
    var err = document.getElementById('fErr');
    var bad = !data.nama ? 'Nama wajib diisi.' : (v3 && !data.no_hp ? 'No. HP wajib diisi.' : (!data.posisi ? 'Posisi wajib dipilih.' : (data.nik && !/^\d{16}$/.test(data.nik) ? 'NIK harus 16 digit angka.' : '')));
    if (!bad && v3 && data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) bad = 'Format email belum benar.';
    var kirim = !edit && v3 && !!data.email && !!(document.getElementById('fKirim') || {}).checked;
    if (bad) { err.textContent = bad; err.classList.remove('hidden'); return; }
    var btns = document.querySelectorAll('.modal .actions .btn'); btns.forEach(function (b) { b.disabled = true; });
    var req = edit ? call('adminUpdate', { kode: r.kode, data: data }) : call('adminCreate', { data: data, kirim: kirim, linkBase: kirim ? testUrl('') : undefined });
    req.then(function (res) {
      var bg = document.querySelector('.modal-bg'); if (bg) bg.remove();
      return loadList(true).then(function () {
        if (location.hash.indexOf('#kandidat') === 0 || !location.hash) drawKandidat();
        if (edit) { GT.toast('Data kandidat tersimpan'); return; }
        var row = A.list.filter(function (x) { return x.kode === res.kode; })[0];
        showInvite(row, true, res.email);
      });
    }).catch(function (e) {
      btns.forEach(function (b) { b.disabled = false; });
      err.textContent = e.message; err.classList.remove('hidden');
    });
  }

  function testUrl(username) {
    var u = location.href.split('#')[0].replace(/admin\.html?$/, '').replace(/\/?$/, '/');
    return u + 'index.html#u=' + (username ? encodeURIComponent(username) : '');
  }
  function totalTes(r) {
    var d = A.meta.sections.filter(function (s) { return s.id !== 'HS' || r.paket_hs; }).reduce(function (a, s) { return a + s.detik; }, 0);
    var m = Math.round(d / 60), h = Math.floor(m / 60);
    return h ? h + ' jam ' + (m % 60) + ' menit' : m + ' menit';
  }
  function inviteText(r) {
    return 'Halo ' + r.nama + ',\n\n' +
      'Anda diundang mengikuti tes tulis rekrutmen Granostic Center untuk posisi ' + r.posisi + '.\n\n' +
      'Link tes: ' + testUrl(r.username) + '\n' +
      'Username: ' + r.username + '\n' +
      'Password: ' + r.password + '\n' +
      'Berlaku sampai: ' + tgl(r.berlaku_sampai, true) + ' WIB\n\n' +
      (r.versi >= 3 ? 'Sebelum tes, Anda akan mengisi Formulir Data Pelamar (±15 menit, tanpa unggah dokumen). ' : '') +
      'Total waktu tes sekitar ' + totalTes(r) + ' (terbagi dalam beberapa bagian dengan waktu masing-masing) dan bisa dikerjakan lewat HP, laptop, atau komputer' +
      (r.versi >= 3 ? ' — untuk bagian Mengetik sangat disarankan memakai laptop/komputer' : '') + '. ' +
      'Siapkan koneksi internet yang stabil, kerjakan sendiri di tempat yang tenang, dan jangan berpindah aplikasi selama tes. ' +
      'Akun hanya bisa dipakai untuk satu kali tes.\n\n' +
      'Terima kasih,\nHR Granostic Center';
  }
  function emailNote(e) {
    if (!e) return '';
    if (e.status === 'terkirim') return '<div class="alert info" id="invNote">Undangan sudah dikirim ke email kandidat.</div>';
    if (e.status === 'tanpa_email') return '';
    return '<div class="alert warn" id="invNote">Email belum terkirim: ' + esc(e.alasan || 'terjadi kesalahan') + '</div>';
  }
  function showInvite(r, fresh, emailRes) {
    var txt = inviteText(r);
    var html = '<h2>' + (fresh ? 'Akun tes dibuat' : 'Undangan tes') + '</h2>' +
      '<p class="muted" style="margin:0">' + esc(r.nama) + ', ' + esc(r.posisi) + '</p>' +
      '<div class="cred"><div><span>Username</span><b class="big-code">' + esc(r.username) + '</b></div><div><span>Password</span><b class="big-code">' + esc(r.password) + '</b></div></div>' +
      '<p class="muted">Berlaku sampai ' + tgl(r.berlaku_sampai, true) + '</p>' + emailNote(emailRes) +
      (r.versi >= 3 ? '<label class="f" style="margin:10px 0 4px"><span>Kirim undangan ke email' + (r.email_kirim ? ' (terakhir terkirim ' + tgl(r.email_kirim, true, true) + ')' : '') + '</span>' +
        '<input type="email" id="invEm" value="' + esc(r.email || '') + '" maxlength="80" placeholder="nama@gmail.com"></label>' : '') +
      '<div class="invite">' + esc(txt) + '</div>';
    var wa = r.no_hp ? 'https://wa.me/' + r.no_hp.replace(/^0/, '62').replace(/^\+/, '') + '?text=' + encodeURIComponent(txt) : null;
    var btns = [
      { label: 'Salin username & password', cls: 'ghost', onClick: function () { GT.copyText('Username: ' + r.username + '\nPassword: ' + r.password).then(function () { GT.toast('Username & password disalin'); }); return false; } },
      { label: 'Salin pesan undangan', cls: wa ? 'ghost' : '', onClick: function () { GT.copyText(txt).then(function () { GT.toast('Pesan undangan disalin'); }); return false; } }
    ];
    if (r.versi >= 3) btns.unshift({ label: 'Kirim ke email', onClick: function (bg) {
      var inp = bg.querySelector('#invEm'), em = inp.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { GT.toast('Isi alamat email yang benar dulu', 3200); inp.focus(); return false; }
      var b0 = bg.querySelector('.actions .btn'); b0.disabled = true; b0.textContent = 'Mengirim…';
      call('adminKirimEmail', { kode: r.kode, email: em, linkBase: testUrl('') }).then(function (x) {
        b0.disabled = false; b0.textContent = 'Kirim ke email';
        var old = bg.querySelector('#invNote'); if (old) old.remove();
        var wrap = document.createElement('div'); wrap.innerHTML = emailNote(x);
        if (wrap.firstChild) bg.querySelector('.cred').insertAdjacentElement('afterend', wrap.firstChild);
        if (x.status === 'terkirim') { r.email = em; r.email_kirim = x.email_kirim; loadList(true).then(function () { if (document.getElementById('tbl')) drawKandidat(); }); GT.toast('Undangan terkirim ke ' + em); }
      }).catch(function (e) { b0.disabled = false; b0.textContent = 'Kirim ke email'; if (!e.auth) GT.toast(e.message, 4000); });
      return false;
    } });
    if (wa) btns.push({ label: 'Kirim lewat WhatsApp', onClick: function () { window.open(wa, '_blank', 'noopener'); return false; } });
    btns.push({ label: 'Tutup', cls: 'ghost', value: true });
    GT.dialog(html, btns, { wide: true });
  }

  function extend(r) {
    GT.dialog('<h2>Perpanjang akun?</h2><p>Akun <strong>' + esc(r.username) + '</strong> akan berlaku ' + A.meta.berlakuHari + ' hari lagi dihitung dari sekarang.</p>',
      [{ label: 'Batal', cls: 'ghost', value: false }, { label: 'Perpanjang', value: true }]).then(function (ok) {
      if (!ok) return;
      call('adminExtend', { kode: r.kode }).then(function () { return loadList(true); }).then(function () { drawKandidat(); GT.toast('Masa berlaku akun diperpanjang'); })
        .catch(function (e) { if (!e.auth) GT.toast(e.message, 4000); });
    });
  }

  function del(r) {
    GT.dialog('<h2>Hapus kandidat?</h2><p><strong>' + esc(r.nama) + '</strong> beserta seluruh jawaban dan hasil tesnya akan dihapus permanen.</p>',
      [{ label: 'Batal', cls: 'ghost', value: false }, { label: 'Hapus permanen', cls: 'danger', value: true }]).then(function (ok) {
      if (!ok) return;
      call('adminDelete', { kode: r.kode }).then(function () { return loadList(true); }).then(function () { drawKandidat(); GT.toast('Kandidat dihapus'); })
        .catch(function (e) { if (!e.auth) GT.toast(e.message, 4000); });
    });
  }

  // ================= REKAP =================
  function viewRekap() {
    $app.innerHTML =
      '<div class="head"><div><h1>Rekapitulasi hasil</h1><p>Ringkasan hasil semua kandidat. Klik nama untuk laporan lengkap.</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" id="bRef">Muat ulang</button><button class="btn ghost" id="bCsv">Unduh Excel (CSV)</button><button class="btn" id="bPrint">Cetak rekap</button></div></div>' +
      '<div class="filters no-print"><input type="search" id="q" placeholder="Cari nama atau username" value="' + esc(A.f.q) + '">' +
      '<select id="pos"><option value="">Semua posisi</option>' + A.meta.posisi.map(function (p) { return '<option' + (A.f.pos === p.nama ? ' selected' : '') + '>' + esc(p.nama) + '</option>'; }).join('') + '</select>' +
      '<select id="st"><option value="">Semua status</option>' + ['Selesai', 'Sedang tes', 'Belum mulai', 'Kedaluwarsa', 'Tidak tuntas'].map(function (s) { return '<option' + (A.f.st === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
      '<select id="hs"><option value="">Semua hasil hard skill</option><option value="lulus"' + (A.f.hs === 'lulus' ? ' selected' : '') + '>Lulus</option><option value="tidak"' + (A.f.hs === 'tidak' ? ' selected' : '') + '>Tidak lulus</option></select></div>' +
      '<div class="print-only"><h2>Rekapitulasi hasil tes tulis, Granostic Center</h2><p class="muted" id="pInfo"></p></div>' +
      '<div id="stats"></div><div id="tbl"><div class="center-load"><div class="spinner"></div></div></div>';
    document.getElementById('bRef').onclick = function () { loadList(true).then(drawRekap); };
    document.getElementById('bCsv').onclick = csv;
    document.getElementById('bPrint').onclick = function () { window.print(); };
    document.getElementById('q').oninput = function (e) { A.f.q = e.target.value; drawRekap(); };
    ['pos', 'st', 'hs'].forEach(function (id) { document.getElementById(id).onchange = function (e) { A.f[id] = e.target.value; drawRekap(); }; });
    loadList(true).then(drawRekap).catch(function (e) { if (!e.auth) document.getElementById('tbl').innerHTML = '<div class="alert err">' + esc(e.message) + '</div>'; });
  }

  function akhirCls(k) { return { 'Direkomendasikan': 'ok', 'Dipertimbangkan': 'warn', 'Tidak direkomendasikan': 'bad' }[k] || 'wait'; }
  function fitCls(l) { return { 'Sangat Sesuai': 'f4', 'Sesuai': 'f3', 'Cukup Sesuai': 'f2', 'Kurang Sesuai': 'f1' }[l] || ''; }
  function gkShort(g) { if (!g || !g.most.length) return '–'; var m = g.most.slice(0, 2).join(', '); return m + (g.most.length > 2 ? ' +' + (g.most.length - 2) : ''); }

  function drawRekap() {
    var rows = filtered(), el = document.getElementById('tbl');
    var selesai = rows.filter(function (r) { return r.statusTampil === 'Selesai'; }).length;
    var hsAda = rows.filter(function (r) { return r.hs; });
    var lulus = hsAda.filter(function (r) { return r.hs.lulus; }).length;
    var keluar = rows.filter(function (r) { return r.keluar.n > 0; }).length;
    var rek = rows.filter(function (r) { return r.nilai && r.nilai.kategori === 'Direkomendasikan'; }).length;
    document.getElementById('stats').innerHTML = '<div class="stats">' +
      '<div class="stat"><b>' + rows.length + '</b><span>Kandidat</span></div>' +
      '<div class="stat"><b>' + selesai + '</b><span>Selesai tes</span></div>' +
      '<div class="stat"><b>' + rek + '</b><span>Direkomendasikan (≥ 70)</span></div>' +
      '<div class="stat"><b>' + lulus + ' / ' + hsAda.length + '</b><span>Lulus hard skill (≥ ' + A.meta.lulus + ')</span></div>' +
      '<div class="stat"><b>' + keluar + '</b><span>Pernah keluar halaman</span></div></div>';
    var info = document.getElementById('pInfo');
    if (info) info.textContent = 'Dicetak ' + tgl(Date.now(), true) + (A.f.pos ? ', posisi ' + A.f.pos : '') + (A.f.st ? ', status ' + A.f.st : '');
    if (!rows.length) { el.innerHTML = '<div class="tbl-wrap"><div class="empty">Belum ada data untuk filter ini.</div></div>'; return; }
    el.innerHTML = '<div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>Kandidat</th><th>Tanggal tes</th><th>Status</th><th class="num">Nilai akhir</th><th class="num">Soft skill</th><th class="num">Hard skill</th><th class="num">Mengetik</th><th>DISC</th><th>MBTI</th><th class="num">Keluar</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td><a class="nm" href="#hasil/' + encodeURIComponent(r.kode) + '">' + esc(r.nama) + '</a><div class="sub">' + esc(r.posisi) + '</div>' +
          (r.bio && r.bio.harapan_gaji ? '<div class="sub">Harapan: Rp ' + X.rp(r.bio.harapan_gaji) + '</div>' : '') + '</td>' +
          '<td data-l="Tanggal tes" style="white-space:nowrap">' + (r.mulai ? tgl(r.mulai, false, true) : '–') + '</td>' +
          '<td data-l="Status">' + statusBadge(r) + '</td>' +
          '<td data-l="Nilai akhir" class="num">' + (r.nilai && r.nilai.akhir !== null ? '<strong class="big-num">' + r.nilai.akhir + '</strong><div><span class="badge ' + akhirCls(r.nilai.kategori) + '">' + r.nilai.kategori + '</span></div>' : '–') + '</td>' +
          '<td data-l="Soft skill" class="num">' + (r.nilai && r.nilai.soft !== null ? '<strong>' + r.nilai.soft + '</strong><div class="sub">' + r.nilai.softKategori + '</div>' : '–') + '</td>' +
          '<td data-l="Hard skill" class="num">' + (r.hs ? '<strong>' + r.hs.nilai + '</strong><div><span class="badge ' + (r.hs.lulus ? 'ok' : 'bad') + '">' + (r.hs.lulus ? 'Lulus' : 'Tidak lulus') + '</span></div>' : (r.paket_hs ? '–' : '<span class="sub">Tidak ada</span>')) + '</td>' +
          '<td data-l="Mengetik" class="num">' + (r.ketik ? '<strong>' + r.ketik.nilai + '</strong><div class="sub">' + r.ketik.wpm + ' kpm · ' + esc(r.ketik.perangkat === 'HP/Tablet' ? 'HP' : 'PC') + '</div>' + (r.ketik.curiga ? '<span class="badge bad">cek tempel</span>' : '') : (r.versi >= 3 ? '–' : '<span class="sub">–</span>')) + '</td>' +
          '<td data-l="DISC">' + (r.disc ? '<strong>' + discText(r.disc.urutan) + '</strong><div class="sub">Jabatan: ' + discText(r.disc.profil) + '</div>' + (r.disc.kesesuaian ? '<span class="fit ' + fitCls(r.disc.kesesuaian) + '">' + r.disc.kesesuaian + '</span>' : '') : '–') + '</td>' +
          '<td data-l="MBTI"><strong>' + esc(r.mbti || '–') + '</strong></td>' +
          '<td data-l="Keluar halaman" class="num">' + (r.keluar.n ? r.keluar.n + '×' : '–') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function csv() {
    var komp = A.meta.sections.filter(function (x) { return x.grup === 'soft'; });
    var head = ['Username', 'Nama', 'NIK', 'Tempat lahir', 'Tanggal lahir', 'Usia', 'Pendidikan', 'No HP', 'Alamat', 'Email', 'Posisi', 'Status', 'Tanggal tes',
      'Sumber info lowongan', 'Detail sumber', 'Kisaran gaji dari sumber', 'Harapan gaji',
      'DISC D', 'DISC I', 'DISC S', 'DISC C', 'DISC dominan', 'Profil DISC jabatan', 'Kesesuaian DISC', 'MBTI',
      'Gaya kepemimpinan (most)', 'Gaya kepemimpinan (least)', 'Level kepemimpinan (%)', 'Paket hard skill', 'Nilai hard skill', 'Benar', 'Hasil hard skill',
      'Mengetik kata/menit (bersih)', 'Mengetik akurasi (%)', 'Perangkat mengetik'].concat(komp.map(function (x) { return x.id === 'KRAEP' ? 'Kraepelin' : x.label; }), ['Nilai soft skill', 'Nilai akhir', 'Kategori akhir', 'Keluar halaman (kali)', 'Keluar halaman (detik)']);
    var q = function (v) { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [head.join(';')].concat(filtered().map(function (r) {
      var d = r.disc || {}, s = d.skor || {};
      var nv = r.nilai || {}, kmap = {};
      (nv.komponen || []).forEach(function (c) { kmap[c.id] = c.nilai; });
      var bio = r.bio || {}, kt = r.ketik || {};
      return [r.username, r.nama, r.nik ? "'" + r.nik : '', r.tempat_lahir, r.tgl_lahir, r.usia, r.pendidikan, r.no_hp ? "'" + r.no_hp : '', r.alamat, bio.email || r.email || '', r.posisi, r.statusTampil,
        r.mulai ? tgl(r.mulai) : '', bio.sumber || '', bio.sumber_detail || '', bio.gaji_info || '', bio.harapan_gaji || '', s.D, s.I, s.S, s.C, d.urutan ? discText(d.urutan) : '', discText(d.profil), d.kesesuaian || '', r.mbti || '',
        r.gk ? r.gk.most.join(', ') : '', r.gk ? r.gk.least.join(', ') : '', r.gk ? r.gk.level : '', r.paket_nama || '',
        r.hs ? r.hs.nilai : '', r.hs ? r.hs.benar : '', r.hs ? (r.hs.lulus ? 'Lulus' : 'Tidak lulus') : '',
        kt.wpm == null ? '' : kt.wpm, kt.akurasi == null ? '' : kt.akurasi, kt.perangkat || ''].concat(komp.map(function (x) { return kmap[x.id] == null ? '' : kmap[x.id]; }),
        [nv.soft == null ? '' : nv.soft, nv.akhir == null ? '' : nv.akhir, nv.kategori || '', r.keluar.n, r.keluar.detik]).map(q).join(';');
    }));
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rekap-tes-tulis-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ================= HASIL (LAPORAN) =================
  function viewHasil(kode) {
    $app.innerHTML = '<div class="center-load"><div class="spinner"></div></div>';
    call('adminDetail', { kode: kode }).then(function (d) { drawHasil(d); })
      .catch(function (e) { if (!e.auth) $app.innerHTML = '<div class="alert err">' + esc(e.message) + '</div><a class="btn ghost" href="#kandidat">Kembali</a>'; });
  }

  function secHead(title, b) {
    var t = '';
    if (b && b.mulai) {
      var dur = b.selesai ? Math.round((b.selesai - b.mulai) / 1000) : null;
      t = '<small class="muted">' + tgl(b.mulai, true) + (dur != null ? ', dikerjakan ' + GT.durasi(Math.min(dur, b.detik)) + ' dari ' + GT.durasi(b.detik) : ', belum selesai') + '</small>';
    }
    return '<h2>' + esc(title) + t + '</h2>';
  }
  function notTaken() { return '<p class="muted r-p">Belum ada jawaban untuk bagian ini.</p>'; }
  function bar(label, val, max, hl, valTxt) {
    var w = max ? Math.max(0, Math.min(100, val / max * 100)) : 0;
    return '<div class="bar-row' + (hl ? ' hl' : '') + '"><span class="lab">' + label + '</span><div class="track" role="img" aria-label="' + esc(String(label).replace(/<[^>]*>/g, '')) + ' ' + esc(String(valTxt || val).replace(/<[^>]*>/g, '')) + '"><div class="fill" style="width:' + w + '%"></div></div><span class="val">' + (valTxt || val) + '</span></div>';
  }

  function drawHasil(d) {
    var k = d.identitas, s = d.ringkasan, B = d.bagian;
    var nz = function (x) { return x && x.hasil && x.hasil.dijawab !== 0 ? x.hasil : null; };
    var disc = nz(B.DISC), mb = nz(B.MBTI), gk = nz(B.GK), sf = B.SIFAT && B.SIFAT.hasil, hs = B.HS && B.HS.hasil;
    var traits = { D: 'Dominance (D)', I: 'Influence (I)', S: 'Steadiness (S)', C: 'Compliance (C)' };
    var traitDesc = { D: 'Tegas, berorientasi hasil & target, cepat mengambil keputusan', I: 'Komunikatif, persuasif, pandai membangun jejaring, energik', S: 'Stabil, sabar, kooperatif dalam tim, konsisten', C: 'Teliti, analitis, patuh aturan, memperhatikan detail' };

    var h = '<div class="toolbar"><a class="btn ghost" href="#kandidat">Kembali</a><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      (d.biodata ? '<a class="btn ghost" href="#form/' + encodeURIComponent(k.kode) + '">Formulir Data Pelamar</a>' : '') +
      '<button class="btn ghost" id="bRe">Muat ulang</button><button class="btn" id="bPr">Cetak / simpan PDF</button></div></div>';
    var no = 0, N = function () { return ++no + '. '; };
    h += '<article class="report">';
    h += '<header class="r-head"><img src="assets/logo.png" alt="Granostic"><div class="ttl"><h1>Laporan hasil tes tulis</h1><p>Rekrutmen karyawan, rahasia</p><p>Dicetak ' + tgl(Date.now(), true) + '</p></div></header>';

    // identitas
    var bd = d.biodata && d.biodata.data, bp = (bd && bd.pribadi) || {}, bl = (bd && bd.lowongan) || {};
    h += '<section class="r-sec" style="margin-top:0"><h2>Identitas kandidat</h2><dl class="r-id">' +
      idr('Nama', k.nama) + idr('Username tes', k.username) +
      idr('NIK', k.nik || '–') + idr('Posisi dilamar', k.posisi) +
      idr('Tempat, tgl lahir', [k.tempat_lahir, k.tgl_lahir ? tgl(k.tgl_lahir) : ''].filter(Boolean).join(', ') || '–') + idr('Usia', k.usia != null ? k.usia + ' tahun' : '–') +
      idr('Pendidikan', k.pendidikan || '–') + idr('No. HP', k.no_hp || '–') +
      idr('Alamat', k.alamat || '–') + idr('Status tes', s.statusTampil + ' (' + s.bagianSelesai + ' dari ' + s.jumlahBagian + ' bagian)') +
      (bd ? idr('Jenis kelamin', bp.jenis_kelamin || '–') + idr('Email', bp.email || '–') +
        idr('Sumber info lowongan', [bl.sumber, bl.sumber_detail].filter(Boolean).join(': ') || '–') +
        idr('Gaji dari sumber lowongan', bl.gaji_info_tidak_ada ? 'Tidak dicantumkan' : ([bl.gaji_info_min, bl.gaji_info_max].filter(Boolean).map(function (x) { return 'Rp ' + X.rp(x); }).join(' – ') || '–')) +
        idr('Harapan gaji', bl.harapan_gaji ? 'Rp ' + X.rp(bl.harapan_gaji) : '–') + idr('Siap mulai kerja', bl.siap_mulai || '–') : '') +
      '</dl>';
    var nv = s.nilai || {};
    h += '<div class="r-final"><div class="fin-main"><div class="l">Nilai akhir</div><div class="fin-num">' + (nv.akhir != null ? nv.akhir : '–') + '</div>' +
      (nv.kategori ? '<span class="badge ' + akhirCls(nv.kategori) + '">' + nv.kategori + '</span>' : '<span class="muted" style="font-size:.85rem">Belum lengkap</span>') + '</div>' +
      '<div class="fin-parts"><div><span class="l">Soft skill</span><b>' + (nv.soft != null ? nv.soft : '–') + '</b><span class="s">' + (nv.softKategori || '') + (nv.adaHs ? ', bobot ' + Math.round(A.meta.bobotSoft * 100) + '%' : ', bobot 100%') + '</span></div>' +
      (nv.adaHs ? '<div><span class="l">Hard skill</span><b>' + (nv.hard != null ? nv.hard : '–') + '</b><span class="s">' + (hs ? (hs.lulus ? 'Lulus' : 'Tidak lulus') + ' (batas ' + hs.batas + ')' : '') + ', bobot ' + Math.round(A.meta.bobotHs * 100) + '%</span></div>' : '') +
      '<div class="fin-note">' + (nv.rumus ? esc(nv.rumus) + '. ' : '') + 'Direkomendasikan ≥ 70, Dipertimbangkan 60–69, Tidak direkomendasikan &lt; 60.</div></div></div>';
    h += '<div class="r-sum">' +
      sumBox('DISC', disc ? discTxt(disc.urutan.slice(0, 2).join('')) : '–', disc && disc.kesesuaian ? '<span class="fit ' + fitCls(disc.kesesuaian) + '">' + disc.kesesuaian + '</span>' : '') +
      sumBox('MBTI', mb ? mb.tipe : '–', mb && mb.interpretasi ? esc(mb.interpretasi.nama) : '') +
      sumBox('Gaya kepemimpinan', gk && gk.most.length ? esc(gk.most[0].nama.replace('The ', '')) : '–', gk ? 'Level ' + gk.level + '%' : '') +
      sumBox('Kraepelin', B.KRAEP && B.KRAEP.hasil ? B.KRAEP.hasil.nilai : '–', B.KRAEP && B.KRAEP.hasil ? B.KRAEP.hasil.kategori : '') +
      (B.KETIK ? sumBox('Mengetik', B.KETIK.hasil ? B.KETIK.hasil.wpmBersih + ' kpm' : '–', B.KETIK.hasil ? 'akurasi ' + B.KETIK.hasil.akurasi + '%' : '') : '') +
      sumBox('Keluar halaman', d.log.filter(isLeave).length + '×', d.log.length ? GT.durasi(d.log.reduce(function (a, l) { return a + l.durasi; }, 0)) : 'Tidak pernah') +
      '</div></section>';

    // DISC
    h += '<section class="r-sec">' + secHead(N() + 'Gaya kerja (DISC)', B.DISC);
    if (disc) {
      var top2 = disc.urutan.slice(0, 2);
      h += '<div class="bars">' + ['D', 'I', 'S', 'C'].map(function (t) { return bar(traits[t], disc.skor[t], disc.total, top2.indexOf(t) >= 0, disc.skor[t] + ' / ' + disc.total); }).join('') + '</div>';
      h += '<div class="cols2" style="margin-top:16px"><div><div class="r-sub">Profil kandidat</div><p class="r-p">Dominan <strong>' + discTxt(top2.join('')) + '</strong>: ' + top2.map(function (t) { return traitDesc[t].toLowerCase(); }).join('; ') + '.</p></div>' +
        '<div><div class="r-sub">Kebutuhan jabatan</div><p class="r-p"><strong>' + discTxt(disc.profilJabatan) + '</strong> untuk ' + esc(k.posisi) + ': ' + esc(disc.karakterJabatan) + '.</p>' +
        (disc.kesesuaian ? '<p class="r-p">Kesesuaian: <span class="fit ' + fitCls(disc.kesesuaian) + '">' + disc.kesesuaian + '</span></p>' : '') + '</div></div>';
      if (disc.dijawab < disc.total) h += '<p class="r-note">' + (disc.total - disc.dijawab) + ' soal tidak dijawab.</p>';
      h += '<p class="r-note">Sangat Sesuai: huruf dominan kandidat sama dengan profil jabatan dan urutannya sama. Sesuai: hurufnya sama, urutan berbeda. Cukup Sesuai: sebagian cocok atau huruf utama jabatan masuk 2 besar. Kurang Sesuai: profil berbeda.</p>';
    } else h += notTaken();
    h += '</section>';

    // MBTI
    h += '<section class="r-sec">' + secHead(N() + 'Tipe kepribadian (MBTI)', B.MBTI);
    if (mb) {
      var pairs = [['I', 'Introvert', 'E', 'Ekstrovert'], ['S', 'Sensing', 'N', 'Intuition'], ['T', 'Thinking', 'F', 'Feeling'], ['J', 'Judging', 'P', 'Perceiving']];
      h += '<div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;margin-bottom:16px"><div><div class="type-big">' + esc(mb.tipe) + '</div><div class="muted" style="font-size:.9rem;margin-top:4px">' + esc(mb.interpretasi ? mb.interpretasi.nama : 'Ada dimensi seimbang') + '</div></div>' +
        '<div class="bipolar" style="flex:1;min-width:280px">' + pairs.map(function (p) {
          var a = mb.persen[p[0]], b = mb.persen[p[2]];
          return '<div class="bp"><span class="' + (a > b ? 'on' : '') + '">' + p[1] + ' (' + p[0] + ') ' + a + '%</span>' +
            '<div class="track" role="img" aria-label="' + p[1] + ' ' + a + ' persen, ' + p[3] + ' ' + b + ' persen"><i class="' + (a > b ? 'dom' : '') + '" style="width:' + a + '%"></i><i class="' + (b > a ? 'dom' : '') + '" style="width:' + b + '%"></i></div>' +
            '<span class="r ' + (b > a ? 'on' : '') + '">' + b + '% ' + p[3] + ' (' + p[2] + ')</span></div>';
        }).join('') + '</div></div>';
      if (mb.seri.length) h += '<p class="r-note">Dimensi ' + mb.seri.join(', ') + ' seimbang (ditandai X), biasanya karena ada soal yang tidak dijawab.</p>';
      var it = mb.interpretasi;
      if (it) {
        h += '<div class="cols2"><div><div class="r-sub">Indikator perilaku</div><ul class="r-list">' + it.indikator.map(li).join('') + '</ul></div>' +
          '<div><div class="r-sub">Saran pengembangan</div><ul class="r-list">' + it.saran.map(li).join('') + '</ul></div></div>' +
          '<div class="cols2"><div><div class="r-sub">Saran profesi</div><p class="r-p">' + esc(it.profesi) + '</p></div>' +
          '<div><div class="r-sub">Pasangan / partner alami</div><p class="r-p">' + esc(it.partner) + '</p></div></div>';
      }
      if (mb.dijawab < mb.total) h += '<p class="r-note">' + (mb.total - mb.dijawab) + ' soal tidak dijawab.</p>';
    } else h += notTaken();
    h += '</section>';

    // GK
    h += '<section class="r-sec">' + secHead(N() + 'Gaya kepemimpinan', B.GK);
    if (gk) {
      var mostK = gk.most.map(function (x) { return x.kode; });
      var sorted = gk.skor.slice().sort(function (a, b) { return b.skor - a.skor; });
      h += '<div class="bars">' + sorted.map(function (x) { return bar(esc(x.nama), x.skor, 100, mostK.indexOf(x.kode) >= 0, x.skor.toFixed(0)); }).join('') + '</div>';
      h += '<p class="r-note">Skor 0–100 per gaya, rata-rata dari 5 pernyataan yang dinormalkan ke skalanya masing-masing (skala 1–6, 1–8, 1–10). Level persepsi kepemimpinan keseluruhan: <strong>' + gk.level + '%</strong>.</p>';
      h += '<div class="cols2"><div><div class="r-sub">Most: paling sering digunakan</div>' + gk.most.map(gkDesc).join('') + '</div>' +
        '<div><div class="r-sub">Least: jarang digunakan, perlu diasah</div>' + gk.least.map(gkDesc).join('') + '</div></div>';
      if (gk.dijawab < gk.total) h += '<p class="r-note">' + (gk.total - gk.dijawab) + ' pernyataan tidak dijawab.</p>';
    } else h += notTaken();
    h += '</section>';

    // SOFT SKILL (9 aspek)
    var NV = s.nilai || {};
    h += '<section class="r-sec">' + secHead(N() + 'Penilaian soft skill');
    var skDone = d.urutanBagian.filter(function (id) { return /^SK\d$/.test(id) && B[id] && B[id].hasil; });
    if (skDone.length) {
      h += '<div class="bars wide">' + d.urutanBagian.filter(function (id) { return /^SK\d$/.test(id); }).map(function (id) {
        var x = B[id] && B[id].hasil;
        return x ? bar(esc(x.aspek), x.nilai, 100, x.nilai >= 65, x.nilai + ' <span class="kat">' + x.kategori + '</span>') : bar(esc(B[id] ? B[id].label : id), 0, 100, false, 'belum');
      }).join('') + '</div>';
      h += '<p class="r-note">Setiap aspek berisi 10 soal situasi kerja. Tiap pilihan jawaban punya poin 1–4 (tidak terlihat oleh kandidat), lalu dikonversi ke 0–100. ' +
        'Kategori: Sangat Baik ≥ 80, Baik 65–79, Cukup 50–64, Kurang &lt; 50. Pada layar kandidat, aspek ditampilkan sebagai "Situasi Kerja 1–9" tanpa nama aspek.</p>';
      h += '<details class="no-print-closed"><summary>Rincian jawaban per soal</summary>' + skDone.map(function (id) {
        var x = B[id].hasil;
        return '<div class="r-sub">' + esc(x.aspek) + ' (' + x.nilai + ')</div><table class="r-tbl"><thead><tr><th>Situasi</th><th>Jawaban kandidat</th><th class="num">Poin</th></tr></thead><tbody>' +
          x.rinci.map(function (q) { return '<tr' + (q.poin !== null && q.poin <= 2 ? ' class="wrong"' : '') + '><td>' + esc(q.t) + '</td><td>' + (q.pilih ? esc(q.pilih) : '<span class="muted">Tidak dijawab</span>') + '</td><td class="num">' + (q.poin == null ? '0' : q.poin) + ' / 4</td></tr>'; }).join('') +
          '</tbody></table>';
      }).join('') + '</details>';
    } else h += notTaken();
    h += '</section>';

    // KETELITIAN TEKS
    var tk = B.TEKS && B.TEKS.hasil;
    h += '<section class="r-sec">' + secHead(N() + 'Ketelitian (membandingkan teks)', B.TEKS);
    if (tk) {
      h += '<div class="r-sum r-sum-4">' + sumBox('Nilai', tk.nilai, tk.kategori) + sumBox('Benar', tk.benar, 'dari ' + tk.total) + sumBox('Salah', tk.salah, 'mengurangi nilai') + sumBox('Tidak dijawab', tk.kosong, 'akurasi ' + tk.akurasi + '%') + '</div>';
      h += '<p class="r-note">Nilai = (benar − salah) ÷ ' + tk.total + ' × 100, minimal 0. Waktu ' + Math.round(B.TEKS.detik / 60 * 10) / 10 + ' menit untuk ' + tk.total + ' pasang teks (±5 detik per soal).</p>';
      if (tk.salahRinci && tk.salahRinci.length) {
        h += '<details><summary>Lihat ' + tk.salahRinci.length + ' jawaban salah</summary><table class="r-tbl"><thead><tr><th>Teks kiri</th><th>Teks kanan</th><th>Seharusnya</th></tr></thead><tbody>' +
          tk.salahRinci.map(function (x) { return '<tr><td class="mono">' + esc(x.a) + '</td><td class="mono">' + esc(x.b) + '</td><td>' + (x.sama ? 'Sama' : 'Tidak sama') + '</td></tr>'; }).join('') + '</tbody></table></details>';
      }
    } else h += notTaken();
    h += '</section>';

    // MENGETIK
    if (B.KETIK) h += X.ketikSection(B.KETIK, N(), secHead, sumBox, notTaken);

    // KRAEPELIN
    var kr = B.KRAEP && B.KRAEP.hasil;
    h += '<section class="r-sec">' + secHead(N() + 'Kraepelin (hitung cepat)', B.KRAEP);
    if (kr) {
      h += '<div class="r-sum r-sum-4">' +
        sumBox('Kecepatan kerja', kr.kecepatan.nilai, kr.kecepatan.kategori + ', rata-rata jawaban per lajur') +
        sumBox('Ketelitian', kr.ketelitian.nilai + '%', kr.ketelitian.kategori + ', ' + kr.totalSalah + ' salah dari ' + kr.totalJawab) +
        sumBox('Keajegan', kr.keajegan.nilai, kr.keajegan.kategori + ', selisih lajur ' + kr.keajegan.terendah + '–' + kr.keajegan.tertinggi) +
        sumBox('Ketahanan', (kr.ketahanan.nilai > 0 ? '+' : '') + kr.ketahanan.nilai, kr.ketahanan.kategori + ', 10 lajur awal ' + kr.ketahanan.awal + ' → akhir ' + kr.ketahanan.akhir) +
        '</div>';
      h += krChart(kr);
      h += '<div class="cols2" style="margin-top:12px"><div><div class="r-sub">Cara membaca</div><ul class="r-list">' +
        '<li><strong>Kecepatan</strong> (panker): banyaknya penjumlahan per lajur. Tinggi ≥ 14, Sedang 9–13, Rendah &lt; 9.</li>' +
        '<li><strong>Ketelitian</strong> (tianker): persentase jawaban salah. Tinggi ≤ 3%, Sedang ≤ 8%, Rendah &gt; 8%.</li>' +
        '<li><strong>Keajegan</strong> (janker): selisih lajur tertinggi dan terendah, makin kecil makin stabil. Tinggi ≤ 5, Sedang 6–9, Rendah ≥ 10.</li>' +
        '<li><strong>Ketahanan</strong> (hanker): perubahan rata-rata 10 lajur terakhir dibanding 10 lajur pertama. Tinggi ≥ −1, Sedang −1 s.d. −3, Rendah &lt; −3.</li></ul></div>' +
        '<div><div class="r-sub">Interpretasi singkat</div><p class="r-p">' + esc(krNarasi(kr)) + '</p>' +
        '<p class="r-p">Nilai gabungan Kraepelin: <strong>' + kr.nilai + '</strong> (' + kr.kategori + '), dari kecepatan 30%, ketelitian 30%, keajegan 20%, ketahanan 20%.</p></div></div>';
      h += '<p class="r-note">Batas kategori adalah acuan internal, bukan norma resmi lembaga psikologi. Sebaiknya disesuaikan setelah data kandidat terkumpul.</p>';
    } else h += notTaken();
    h += '</section>';

    // SIFAT
    h += '<section class="r-sec">' + secHead(N() + 'Gambaran sifat', B.SIFAT);
    if (sf) {
      var blk = function (i) { var x = sf.isian[i]; return '<div><div class="r-sub">' + esc(x.t) + '</div>' + (x.jawab.length ? '<ol class="r-list">' + x.jawab.map(li).join('') + '</ol>' : '<p class="muted r-p">Tidak diisi</p>') + '</div>'; };
      h += '<div class="cols2">' + [0, 3, 1, 4, 2, 5].map(blk).join('') + '</div>';
      h += '<p class="r-note">Isian kandidat apa adanya, diurutkan dari yang paling kuat.</p>';
    } else h += notTaken();
    h += '</section>';

    // HS
    if (k.paket_hs) {
      h += '<section class="r-sec">' + secHead(N() + 'Pengetahuan teknis (hard skill): ' + k.paket_nama, B.HS);
      if (hs) {
        h += '<div style="display:flex;gap:28px;align-items:center;flex-wrap:wrap;margin-bottom:14px"><div><div class="type-big">' + hs.nilai + '</div><div class="muted" style="font-size:.85rem">Nilai</div></div>' +
          '<div class="r-p">' + hs.benar + ' benar dari ' + hs.total + ' soal, ' + hs.dijawab + ' dijawab.<br>Batas lulus ' + hs.batas + ': <span class="badge ' + (hs.lulus ? 'ok' : 'bad') + '">' + (hs.lulus ? 'Lulus' : 'Tidak lulus') + '</span></div></div>';
        h += '<table class="r-tbl"><thead><tr><th>No</th><th>Soal</th><th>Jawaban kandidat</th><th>Kunci</th><th></th></tr></thead><tbody>' +
          hs.rinci.map(function (x) {
            return '<tr class="' + (x.benar ? '' : 'wrong') + '"><td>' + x.no + '</td><td>' + esc(x.t) + '</td><td>' + (x.pilih == null ? '<span class="muted">Tidak dijawab</span>' : esc(x.opsi[x.pilih])) + '</td><td>' + esc(x.opsi[x.kunci]) + '</td><td class="' + (x.benar ? 'v' : 'x') + '">' + (x.benar ? '✓' : '✗') + '</td></tr>';
          }).join('') + '</tbody></table>';
        h += '<p class="r-note">Nomor soal sesuai bank soal. Urutan soal dan pilihan jawaban diacak untuk tiap kandidat.</p>';
      } else h += notTaken();
      h += '</section>';
    }

    // LOG
    h += '<section class="r-sec">' + secHead('Catatan perilaku selama tes') +
      (d.log.length ? '<table class="r-tbl"><thead><tr><th>Waktu</th><th>Bagian</th><th>Kejadian</th><th>Lama</th></tr></thead><tbody>' +
        d.log.map(function (l) { return '<tr><td>' + tgl(l.waktu, true) + '</td><td>' + esc(secName(l.bagian)) + '</td><td>' + esc(l.kejadian) + '</td><td>' + (l.durasi ? GT.durasi(l.durasi) : '–') + '</td></tr>'; }).join('') + '</tbody></table>'
        : '<p class="r-p muted">Tidak ada catatan. Kandidat tidak pernah meninggalkan halaman tes.</p>') + '</section>';

    h += '<div class="sign"><div><div class="line"></div>Penilai</div><div><div class="line"></div>Diverifikasi oleh</div><div><div class="line"></div>Diketahui oleh</div></div>';
    h += '</article>';
    $app.innerHTML = h;
    document.getElementById('bPr').onclick = function () {
      var old = document.title; document.title = 'Hasil Tes - ' + k.nama + ' - ' + k.username;
      window.print(); setTimeout(function () { document.title = old; }, 1000);
    };
    document.getElementById('bRe').onclick = function () { viewHasil(k.kode); };
  }
  function krChart(kr) {
    var W = 640, H = 170, pl = 30, pb = 22, pt = 8, n = kr.lajur.length;
    var maxv = Math.max(10, Math.max.apply(null, kr.lajur.map(function (x) { return x.n; })));
    maxv = Math.ceil(maxv / 5) * 5;
    var bw = (W - pl) / n, y = function (v) { return pt + (H - pt - pb) * (1 - v / maxv); };
    var g = '';
    for (var t = 0; t <= maxv; t += 5) g += '<line x1="' + pl + '" x2="' + W + '" y1="' + y(t) + '" y2="' + y(t) + '" class="grid"/><text x="' + (pl - 6) + '" y="' + (y(t) + 4) + '" class="ax" text-anchor="end">' + t + '</text>';
    var bars = kr.lajur.map(function (x, i) {
      var x0 = pl + i * bw + 1, w = Math.max(1, bw - 2), yb = y(x.benar), ys = y(x.n);
      var r = '<g><title>Lajur ' + (i + 1) + ': ' + x.n + ' dijawab, ' + x.benar + ' benar, ' + (x.n - x.benar) + ' salah</title>' +
        '<rect x="' + x0 + '" y="' + yb + '" width="' + w + '" height="' + (y(0) - yb) + '" class="b-ok"/>';
      if (x.n > x.benar) r += '<rect x="' + x0 + '" y="' + ys + '" width="' + w + '" height="' + Math.max(0, yb - ys - 1) + '" class="b-err"/>';
      return r + '</g>';
    }).join('');
    var lab = [1, 10, 20, 30, 40].filter(function (v) { return v <= n; }).map(function (v) { return '<text x="' + (pl + (v - 0.5) * bw) + '" y="' + (H - 6) + '" class="ax" text-anchor="middle">' + v + '</text>'; }).join('');
    return '<figure class="kr-chart"><figcaption><span><i class="lg-ok"></i>Benar</span><span><i class="lg-err"></i>Salah</span><span class="muted">Jumlah jawaban per lajur (lajur 1–' + n + ')</span></figcaption>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Kurva kerja Kraepelin per lajur">' + g + bars + lab + '</svg></figure>';
  }
  function krNarasi(kr) {
    var k = { Tinggi: 'tinggi', Sedang: 'sedang', Rendah: 'rendah' };
    var s = 'Kecepatan kerja ' + k[kr.kecepatan.kategori] + ' dengan ketelitian ' + k[kr.ketelitian.kategori] + '. ';
    s += kr.keajegan.kategori === 'Tinggi' ? 'Hasil kerja antar lajur stabil. ' : (kr.keajegan.kategori === 'Sedang' ? 'Hasil kerja antar lajur cukup stabil dengan sedikit naik-turun. ' : 'Hasil kerja antar lajur naik-turun cukup tajam, menandakan konsentrasi yang belum ajeg. ');
    s += kr.ketahanan.nilai >= 0 ? 'Performa bertahan atau meningkat hingga akhir tes.' : (kr.ketahanan.kategori === 'Rendah' ? 'Performa menurun cukup jelas di akhir tes, menandakan daya tahan kerja yang perlu diperhatikan.' : 'Performa sedikit menurun di akhir tes, masih dalam batas wajar.');
    return s;
  }
  function isLeave(l) { return /keluar/i.test(l.kejadian); }
  function secName(id) {
    var m = { DISC: 'DISC', MBTI: 'MBTI', GK: 'Gaya kepemimpinan', SIFAT: 'Sifat', HS: 'Hard skill', TEKS: 'Ketelitian', KETIK: 'Mengetik', KRAEP: 'Kraepelin' };
    if (/^SK\d$/.test(id)) { var x = A.meta.sections.filter(function (s) { return s.id === id; })[0]; return x ? x.label : id; }
    return m[id] || '–';
  }
  function idr(a, b) { return '<div><dt>' + esc(a) + '</dt><dd>' + esc(b) + '</dd></div>'; }
  function sumBox(l, v, s) { return '<div><div class="l">' + esc(l) + '</div><div class="v">' + (typeof v === 'number' ? v : esc(v)) + '</div><div class="s">' + (s || '') + '</div></div>'; }
  function li(x) { return '<li>' + esc(x) + '</li>'; }
  function discTxt(c) { return c ? c.split('').join(' + ') : '–'; }
  function gkDesc(x) { return '<p class="r-p"><strong>' + esc(x.nama) + '</strong> (' + x.skor.toFixed(0) + '): ' + esc(x.desc) + '</p>'; }

  X.testUrl = testUrl; X.inviteText = inviteText; X.loadList = loadList; X.showInvite = showInvite;
  X.call = call; X.esc = esc; X.tgl = tgl; X.route = route; X.sumBox = sumBox; X.idr = idr;

  // ================= AKUN =================
  function viewAkun() {
    $app.innerHTML = '<div class="head"><div><h1>Akun admin</h1><p>Ganti username atau password login admin.</p></div></div>' +
      '<div class="card" style="max-width:460px"><div class="alert err hidden" id="aErr"></div>' +
      '<form id="fA"><label class="f"><span>Username baru</span><input type="text" id="aU" value="' + esc(A.user || '') + '" autocomplete="username" required></label>' +
      '<label class="f"><span>Password lama</span><input type="password" id="aO" autocomplete="current-password" required></label>' +
      '<label class="f"><span>Password baru (minimal 8 karakter)</span><input type="password" id="aN" autocomplete="new-password" minlength="8" required></label>' +
      '<label class="f"><span>Ulangi password baru</span><input type="password" id="aN2" autocomplete="new-password" required></label>' +
      '<button class="btn" id="bA">Simpan</button></form></div>';
    document.getElementById('fA').onsubmit = function (e) {
      e.preventDefault();
      var err = document.getElementById('aErr');
      var n = document.getElementById('aN').value;
      if (n !== document.getElementById('aN2').value) { err.textContent = 'Ulangan password baru tidak sama.'; err.classList.remove('hidden'); return; }
      call('adminPassword', { user: document.getElementById('aU').value, lama: document.getElementById('aO').value, baru: n }).then(function (r) {
        A.user = r.user; GT.toast('Akun admin tersimpan'); viewAkun();
      }).catch(function (x) { if (!x.auth) { err.textContent = x.message; err.classList.remove('hidden'); } });
    };
  }

  // ================= MULAI =================
  if (!GT.cfg.API_URL || /GANTI_DENGAN/.test(GT.cfg.API_URL)) {
    $app.innerHTML = '<div class="alert err">Aplikasi belum dikonfigurasi. Isi API_URL di config.js.</div>';
    return;
  }
  A.token = ss('gt_adm');
  if (A.token) boot(); else viewLogin();
})();
