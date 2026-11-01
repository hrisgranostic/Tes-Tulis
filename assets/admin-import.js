/* Admin: impor kandidat massal dari Excel + kirim undangan otomatis lewat email backend */
(function () {
  var X = window.GTA, A = X.A, esc = GT.esc, tgl = GT.tgl;
  var $app = document.getElementById('app');
  var CHUNK = 20, MAXROW = 300;
  var S = null;

  // ---------- util ----------
  function normHp(v) {
    var s = String(v == null ? '' : v).replace(/[^\d+]/g, '');
    if (/^\+?62/.test(s)) s = '0' + s.replace(/^\+?62/, '');
    else if (/^8\d{7,}/.test(s)) s = '0' + s;
    return s;
  }
  function normTxt(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function dupKey(hp, pos) { return normHp(hp).replace(/\D/g, '') + '|' + String(pos || '').toLowerCase(); }
  function posByName(n) {
    n = normTxt(n).toLowerCase(); if (!n) return null;
    return A.meta.posisi.filter(function (p) { return p.nama.toLowerCase() === n; })[0] || null;
  }

  var xlsxP = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    if (xlsxP) return xlsxP;
    xlsxP = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = 'assets/xlsx.mini.min.js';
      s.onload = function () { ok(); }; s.onerror = function () { xlsxP = null; no(new Error('Pembaca Excel gagal dimuat. Periksa internet lalu coba lagi.')); };
      document.head.appendChild(s);
    });
    return xlsxP;
  }

  // ---------- baca file ----------
  function parseFile(file) {
    return loadXlsx().then(function () {
      return new Promise(function (ok, no) {
        var fr = new FileReader();
        fr.onerror = function () { no(new Error('File tidak bisa dibaca.')); };
        fr.onload = function () {
          try {
            var wb = XLSX.read(new Uint8Array(fr.result), { type: 'array' });
            var ws = wb.Sheets['Data Kandidat'] || wb.Sheets[wb.SheetNames[0]];
            var m = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
            var hr = -1, col = {};
            for (var i = 0; i < Math.min(m.length, 15) && hr < 0; i++) {
              var c = {};
              m[i].forEach(function (h, j) {
                h = String(h).toLowerCase();
                if (/^nama/.test(h)) c.nama = j;
                else if (/hp|whatsapp|telepon|telp|wa\b/.test(h)) c.hp = j;
                else if (/mail/.test(h)) c.email = j;
                else if (/posisi|jabatan/.test(h)) c.posisi = j;
              });
              if (c.nama !== undefined && c.hp !== undefined && c.posisi !== undefined) { hr = i; col = c; }
            }
            if (hr < 0) return no(new Error('Judul kolom tidak ditemukan. Pakai template dari tombol "Unduh template Excel" dan jangan ubah baris judulnya.'));
            var rows = [];
            for (var r = hr + 1; r < m.length; r++) {
              var g = function (k) { return col[k] === undefined ? '' : m[r][col[k]]; };
              var row = { baris: r + 1, nama: normTxt(g('nama')), hp: String(g('hp')).trim(), email: normTxt(g('email')).toLowerCase(), posisi: normTxt(g('posisi')) };
              if (!row.nama && !row.hp && !row.email && !row.posisi) continue;
              rows.push(row);
            }
            if (!rows.length) return no(new Error('Tidak ada data kandidat di file ini. Isi mulai baris 2 pada sheet "Data Kandidat".'));
            if (rows.length > MAXROW) return no(new Error('Isi file ' + rows.length + ' baris. Maksimal ' + MAXROW + ' kandidat per file, pecah jadi beberapa file.'));
            ok(rows);
          } catch (e) { no(new Error('File tidak bisa dibaca. Pastikan formatnya .xlsx (Excel).')); }
        };
        fr.readAsArrayBuffer(file);
      });
    });
  }

  // ---------- validasi pratinjau ----------
  function validate() {
    var exist = {};
    (A.list || []).forEach(function (k) { exist[dupKey(k.no_hp, k.posisi)] = 1; });
    var seen = {};
    S.rows.forEach(function (r) {
      var p = posByName(r.posisi), hp = normHp(r.hp), prob = '';
      r.posisiOk = p ? p.nama : '';
      if (!r.nama) prob = 'Nama kosong';
      else if (hp.replace(/\D/g, '').length < 9) prob = 'No. HP tidak valid';
      else if (r.email && !EMAIL.test(r.email)) prob = 'Format email salah';
      else if (!p) prob = r.posisi ? 'Posisi tidak ada di daftar' : 'Posisi kosong';
      else {
        var k = dupKey(hp, p.nama);
        if (exist[k]) prob = 'Dobel: sudah terdaftar (HP & posisi sama)';
        else if (seen[k]) prob = 'Dobel di file ini (baris ' + seen[k] + ')';
        else seen[k] = r.baris;
      }
      r.hpNorm = hp; r.prob = prob;
    });
  }

  // ---------- tampilan ----------
  X.viewImport = function () {
    S = { step: 'upload', rows: [], kirim: true, hasil: [], fileName: '' };
    X.loadList(false).catch(function () {}).then(draw);
    draw();
  };

  function senderNote() {
    var e = A.meta.email || {};
    if (!e.siap) return '<div class="alert warn">Izin kirim email belum aktif di backend. Jalankan fungsi <b>setup</b> sekali lagi di editor Apps Script dan izinkan akses email, lalu <b>New version</b> pada deployment. Sebelum itu, undangan hanya bisa dikirim lewat WhatsApp/salin pesan.</div>';
    return '<p class="hint" style="margin:6px 0 0">Email dikirim dari <b>' + esc(e.pengirim || 'akun backend') + '</b>. Sisa kuota kirim hari ini: <b>' + (e.sisa == null ? '?' : e.sisa) + '</b> email.</p>';
  }

  function head(sub) {
    return '<div class="head"><div><h1>Impor kandidat dari Excel</h1><p>' + sub + '</p></div><a class="btn ghost" href="#kandidat">Kembali ke daftar</a></div>';
  }

  function draw() {
    if (!S || !document.getElementById('app')) return;
    if (S.step === 'upload') return drawUpload();
    if (S.step === 'preview') return drawPreview();
    if (S.step === 'run') return drawRun();
    drawDone();
  }

  function drawUpload() {
    var e = A.meta.email || {};
    $app.innerHTML = head('Buat banyak akun tes sekaligus. Posisi dipilih dari daftar di Excel, jadi tidak ada salah ketik.') +
      '<div class="imp-steps"><span class="on">1. Siapkan &amp; unggah</span><span>2. Periksa</span><span>3. Hasil</span></div>' +
      '<div class="imp-card"><h2>Langkah 1 — Unduh template</h2>' +
      '<p class="muted" style="margin:0 0 12px">Isi nama, no. HP, email, dan pilih posisi dari daftar dropdown. Satu baris untuk satu kandidat (maksimal ' + MAXROW + ' per file).</p>' +
      '<a class="btn" href="assets/template-impor-kandidat.xlsx" download="Template-Impor-Kandidat.xlsx">Unduh template Excel</a></div>' +
      '<div class="imp-card"><h2>Langkah 2 — Unggah file yang sudah diisi</h2>' +
      '<label class="drop" id="drop"><input type="file" id="fFile" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>' +
      '<b>Klik untuk pilih file Excel</b><span>atau tarik file ke sini (.xlsx)</span></label>' +
      '<div class="alert err hidden" id="impErr" style="margin-top:12px"></div>' +
      '<label class="chk" style="margin-top:14px"><input type="checkbox" id="chKirim"' + (S.kirim && e.siap !== false ? ' checked' : '') + (e.siap === false ? ' disabled' : '') + '><span>Kirim undangan otomatis ke email kandidat setelah akun dibuat</span></label>' +
      senderNote() + '</div>';
    var inp = document.getElementById('fFile'), drop = document.getElementById('drop');
    document.getElementById('chKirim').onchange = function (ev) { S.kirim = ev.target.checked; };
    function pick(f) {
      if (!f) return;
      var er = document.getElementById('impErr'); er.classList.add('hidden');
      if (!/\.xlsx?$/i.test(f.name)) { er.textContent = 'File harus berformat Excel (.xlsx).'; er.classList.remove('hidden'); return; }
      if (f.size > 3 * 1024 * 1024) { er.textContent = 'Ukuran file terlalu besar (maks. 3 MB).'; er.classList.remove('hidden'); return; }
      drop.classList.add('busy'); drop.querySelector('b').textContent = 'Membaca file…';
      Promise.all([parseFile(f), X.loadList(true).catch(function () { return A.list; })]).then(function (r) {
        S.rows = r[0]; S.fileName = f.name; validate(); S.step = 'preview'; draw();
      }).catch(function (x) {
        if (x && x.auth) return;
        drop.classList.remove('busy'); drop.querySelector('b').textContent = 'Klik untuk pilih file Excel';
        er.textContent = x.message; er.classList.remove('hidden');
      });
    }
    inp.onchange = function () { pick(inp.files[0]); };
    ['dragover', 'dragenter'].forEach(function (n) { drop.addEventListener(n, function (ev) { ev.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function (ev) { ev.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (ev) { pick(ev.dataTransfer.files[0]); });
  }

  function counts() {
    var ok = S.rows.filter(function (r) { return !r.prob; });
    return { ok: ok.length, bad: S.rows.length - ok.length, noMail: ok.filter(function (r) { return !r.email; }).length };
  }

  function posSelect(i, cur) {
    var groups = {};
    A.meta.posisi.forEach(function (p) { (groups[p.divisi] = groups[p.divisi] || []).push(p); });
    return '<select class="imp-sel" data-i="' + i + '"><option value="">Pilih posisi…</option>' + Object.keys(groups).map(function (g) {
      return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (p) { return '<option value="' + esc(p.nama) + '">' + esc(p.nama) + '</option>'; }).join('') + '</optgroup>';
    }).join('') + '</select>';
  }

  function drawPreview() {
    var c = counts(), e = A.meta.email || {};
    var willMail = S.kirim ? c.ok - c.noMail : 0;
    $app.innerHTML = head('Periksa dulu sebelum akun dibuat. Baris bermasalah tidak ikut dibuat.') +
      '<div class="imp-steps"><span>1. Siapkan &amp; unggah</span><span class="on">2. Periksa</span><span>3. Hasil</span></div>' +
      '<div class="imp-sum"><div class="ok"><b>' + c.ok + '</b><span>siap dibuat</span></div><div class="' + (c.bad ? 'bad' : '') + '"><b>' + c.bad + '</b><span>bermasalah (dilewati)</span></div>' +
      '<div><b>' + c.noMail + '</b><span>tanpa email</span></div><div><b>' + S.rows.length + '</b><span>baris di ' + esc(S.fileName) + '</span></div></div>' +
      (S.kirim && willMail > (e.sisa == null ? 1e9 : e.sisa) ? '<div class="alert warn">Kuota email hari ini tinggal ' + e.sisa + ', sedangkan yang akan dikirim ' + willMail + '. Sisanya akan ditandai gagal kirim (akun tetap dibuat) dan bisa dikirim ulang besok atau lewat WhatsApp.</div>' : '') +
      '<div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>Baris</th><th>Nama</th><th>No. HP</th><th>Email</th><th>Posisi</th><th>Status</th></tr></thead><tbody>' +
      S.rows.map(function (r, i) {
        var badPos = r.prob && /Posisi/.test(r.prob);
        return '<tr class="' + (r.prob ? 'bad-row' : '') + '"><td class="nw" data-l="Baris Excel">' + r.baris + '</td><td data-l="Nama">' + esc(r.nama || '–') + '</td><td class="nw" data-l="No. HP">' + esc(r.hpNorm || r.hp || '–') + '</td>' +
          '<td data-l="Email">' + (r.email ? esc(r.email) : '<span class="sub">–</span>') + '</td>' +
          '<td data-l="Posisi">' + (badPos ? esc(r.posisi || '') + '<br>' + posSelect(i) : esc(r.posisiOk || r.posisi || '–')) + '</td>' +
          '<td class="nw" data-l="Status">' + (r.prob ? '<span class="badge bad">' + esc(r.prob) + '</span>' : '<span class="badge ok">Siap</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="imp-bar"><label class="chk" style="margin:0"><input type="checkbox" id="chKirim2"' + (S.kirim ? ' checked' : '') + (e.siap === false ? ' disabled' : '') + '><span>Kirim undangan ke email (' + willMail + ' kandidat)</span></label>' +
      '<div class="acts"><button class="btn ghost" id="bBack">Ganti file</button><button class="btn" id="bGo"' + (c.ok ? '' : ' disabled') + '>Buat ' + c.ok + ' akun' + (S.kirim && willMail ? ' &amp; kirim email' : '') + '</button></div></div>';
    document.getElementById('bBack').onclick = function () { S.step = 'upload'; draw(); };
    document.getElementById('chKirim2').onchange = function (ev) { S.kirim = ev.target.checked; drawPreview(); };
    document.getElementById('bGo').onclick = start;
    document.querySelectorAll('.imp-sel').forEach(function (sel) {
      sel.onchange = function () { if (!sel.value) return; S.rows[Number(sel.getAttribute('data-i'))].posisi = sel.value; validate(); drawPreview(); };
    });
  }

  // ---------- proses ----------
  function start() {
    var todo = S.rows.filter(function (r) { return !r.prob; });
    S.step = 'run'; S.todo = todo; S.done = 0; S.hasil = []; S.err = ''; draw();
    var chunks = [];
    for (var i = 0; i < todo.length; i += CHUNK) chunks.push(todo.slice(i, i + CHUNK));
    var link = X.testUrl('');
    (function next(ci) {
      if (ci >= chunks.length) { S.step = 'done'; return X.loadList(true).catch(function () {}).then(draw); }
      var part = chunks[ci];
      X.call('adminImport', { rows: part.map(function (r) { return { nama: r.nama, no_hp: r.hpNorm, email: r.email, posisi: r.posisi }; }), kirim: S.kirim, linkBase: S.kirim ? link : undefined })
        .then(function (res) {
          res.hasil.forEach(function (h, k) { h.baris = part[k].baris; h.nama = h.nama || part[k].nama; h.posisi = h.posisi || part[k].posisi; h.email = h.ok ? h.email : part[k].email; S.hasil.push(h); });
          if (res.email) A.meta.email = res.email;
          S.done += part.length; drawRun(); next(ci + 1);
        }).catch(function (e) {
          if (e.auth) return;
          S.err = e.message + ' Sebagian akun mungkin sudah terbuat; cek hasil di bawah dan daftar Kandidat sebelum mengulang, supaya tidak dobel.';
          S.step = 'done'; X.loadList(true).catch(function () {}).then(draw);
        });
    })(0);
  }

  function drawRun() {
    if (S.step !== 'run') return;
    var pct = Math.round(S.done / S.todo.length * 100);
    $app.innerHTML = head('Sedang membuat akun' + (S.kirim ? ' dan mengirim email' : '') + '. Jangan tutup halaman ini.') +
      '<div class="imp-steps"><span>1. Siapkan &amp; unggah</span><span>2. Periksa</span><span class="on">3. Hasil</span></div>' +
      '<div class="imp-card"><div class="bar-row"><span class="lab">' + S.done + ' dari ' + S.todo.length + '</span><div class="track"><div class="fill" style="width:' + pct + '%"></div></div><span class="val">' + pct + '%</span></div></div>';
  }

  function mailBadge(h) {
    var m = { terkirim: ['ok', 'Email terkirim'], gagal: ['bad', 'Email gagal'], tanpa_email: ['wait', 'Tanpa email'], tidak_dikirim: ['wait', 'Tidak dikirim'] }[h.email_status] || ['wait', '–'];
    return '<span class="badge ' + m[0] + '">' + m[1] + '</span>' + (h.email_alasan ? '<div class="sub">' + esc(h.email_alasan) + '</div>' : '');
  }

  function rowObj(h) {
    return { kode: h.kode, nama: h.nama, posisi: h.posisi, username: h.username, password: h.password, no_hp: h.no_hp, email: h.email, berlaku_sampai: h.berlaku_sampai, versi: 3, paket_hs: 'x' };
  }

  function drawDone() {
    var okH = S.hasil.filter(function (h) { return h.ok; }), badH = S.hasil.filter(function (h) { return !h.ok; });
    var sent = okH.filter(function (h) { return h.email_status === 'terkirim'; }).length;
    var fail = okH.filter(function (h) { return h.email_status === 'gagal'; }).length;
    var skipped = S.rows.filter(function (r) { return r.prob; });
    $app.innerHTML = head('Selesai. Simpan daftar akun di bawah; username dan password juga bisa dilihat lagi di menu Kandidat.') +
      '<div class="imp-steps"><span>1. Siapkan &amp; unggah</span><span>2. Periksa</span><span class="on">3. Hasil</span></div>' +
      (S.err ? '<div class="alert err">' + esc(S.err) + '</div>' : '') +
      '<div class="imp-sum"><div class="ok"><b>' + okH.length + '</b><span>akun dibuat</span></div>' +
      '<div class="' + (S.kirim ? 'ok' : '') + '"><b>' + sent + '</b><span>email terkirim</span></div>' +
      '<div class="' + (fail ? 'bad' : '') + '"><b>' + fail + '</b><span>email gagal</span></div>' +
      '<div class="' + (badH.length + skipped.length ? 'bad' : '') + '"><b>' + (badH.length + skipped.length) + '</b><span>baris dilewati</span></div></div>' +
      (fail ? '<div class="alert warn">Email yang gagal tidak membatalkan akun. Klik <b>Kirim ulang</b> di barisnya, atau pakai <b>WhatsApp</b>.</div>' : '') +
      '<div class="tbl-wrap"><table class="tbl cards"><thead><tr><th>Kandidat</th><th>Username</th><th>Password</th><th>Email</th><th></th></tr></thead><tbody>' +
      okH.map(function (h, i) {
        var wa = h.no_hp ? 'https://wa.me/' + h.no_hp.replace(/^0/, '62').replace(/^\+/, '') + '?text=' + encodeURIComponent(X.inviteText(rowObj(h))) : '';
        return '<tr><td data-l="Kandidat"><div class="nm">' + esc(h.nama) + '</div><div class="sub">' + esc(h.posisi) + '</div></td>' +
          '<td data-l="Username"><span class="kode">' + esc(h.username) + '</span></td><td data-l="Password"><span class="kode">' + esc(h.password) + '</span></td>' +
          '<td data-l="Email"><div id="mb' + i + '">' + mailBadge(h) + '</div>' + (h.email ? '<div class="sub">' + esc(h.email) + '</div>' : '') + '</td>' +
          '<td><div class="acts">' + (h.email && h.email_status !== 'terkirim' ? '<button class="btn sm" data-re="' + i + '">Kirim ulang</button>' : '') +
          (wa ? '<a class="btn ghost sm" target="_blank" rel="noopener" href="' + wa + '">WhatsApp</a>' : '') + '</div></td></tr>';
      }).join('') + '</tbody></table></div>' +
      ((badH.length || skipped.length) ? '<h2 class="bank-h" style="margin-top:22px">Baris yang dilewati</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Baris</th><th>Nama</th><th>Alasan</th></tr></thead><tbody>' +
        skipped.map(function (r) { return '<tr><td class="nw">' + r.baris + '</td><td>' + esc(r.nama || '–') + '</td><td>' + esc(r.prob) + '</td></tr>'; }).join('') +
        badH.map(function (h) { return '<tr><td class="nw">' + h.baris + '</td><td>' + esc(h.nama || '–') + '</td><td>' + esc(h.error || '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
      '<div class="imp-bar"><div class="acts"><button class="btn ghost" id="bXl"' + (okH.length ? '' : ' disabled') + '>Unduh daftar akun (Excel)</button><button class="btn ghost" id="bMore">Impor file lain</button></div>' +
      '<a class="btn" href="#kandidat">Ke daftar Kandidat</a></div>';
    document.getElementById('bMore').onclick = function () { S = { step: 'upload', rows: [], kirim: S.kirim, hasil: [], fileName: '' }; draw(); };
    document.getElementById('bXl').onclick = function () {
      loadXlsx().then(function () {
        var aoa = [['Nama', 'Posisi', 'No. HP', 'Email', 'Username', 'Password', 'Berlaku sampai', 'Status email']].concat(okH.map(function (h) {
          return [h.nama, h.posisi, h.no_hp, h.email || '', h.username, h.password, tgl(h.berlaku_sampai, true), { terkirim: 'Terkirim', gagal: 'Gagal', tanpa_email: 'Tanpa email', tidak_dikirim: 'Tidak dikirim' }[h.email_status] || ''];
        }));
        var ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 28 }, { wch: 40 }, { wch: 16 }, { wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 14 }];
        var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Akun Tes');
        XLSX.writeFile(wb, 'Akun-Tes-Kandidat.xlsx');
      }).catch(function (e) { GT.toast(e.message, 4000); });
    };
    document.querySelectorAll('button[data-re]').forEach(function (b) {
      b.onclick = function () {
        var i = Number(b.getAttribute('data-re')), h = okH[i];
        b.disabled = true; b.textContent = 'Mengirim…';
        X.call('adminKirimEmail', { kode: h.kode, email: h.email, linkBase: X.testUrl('') }).then(function (x) {
          h.email_status = x.status; h.email_alasan = x.alasan || '';
          document.getElementById('mb' + i).innerHTML = mailBadge(h);
          if (x.status === 'terkirim') { b.remove(); GT.toast('Undangan terkirim ke ' + h.email); } else { b.disabled = false; b.textContent = 'Kirim ulang'; }
        }).catch(function (e) { b.disabled = false; b.textContent = 'Kirim ulang'; if (!e.auth) GT.toast(e.message, 4000); });
      };
    });
  }
})();
