/* Admin v3: Bank Soal, Formulir Data Pelamar (cetak), dan bagian Mengetik di laporan */
(function () {
  var X = window.GTA, A = X.A, esc = GT.esc, tgl = GT.tgl;
  var $app = document.getElementById('app');
  var LET = 'ABCD';

  X.rp = function (v) {
    var n = String(v == null ? '' : v).replace(/\D/g, '');
    return n ? n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '–';
  };

  // ================= LAPORAN: MENGETIK =================
  X.ketikSection = function (B, no, secHead, sumBox, notTaken) {
    var k = B.hasil;
    var h = '<section class="r-sec">' + secHead(no + 'Mengetik', B);
    if (!k || !k.kataDiketik) return h + notTaken() + '</section>';
    h += '<div class="r-sum r-sum-4">' +
      sumBox('Nilai', k.nilai, k.kategori) +
      sumBox('Kecepatan bersih', k.wpmBersih + ' kata/menit', k.kataPerDetik + ' kata/detik') +
      sumBox('Kecepatan kotor', k.wpmKotor + ' kata/menit', k.kpm + ' karakter/menit') +
      sumBox('Akurasi', k.akurasi + '%', k.kataBenar + ' benar dari ' + k.kataDiketik + ' kata') +
      sumBox('Perangkat', k.perangkat, k.perangkatInfo && k.perangkatInfo.keyboardLayar ? 'keyboard layar' : (k.perangkatInfo && k.perangkatInfo.layar ? 'layar ' + esc(k.perangkatInfo.layar) : '')) +
      '</div>';
    h += '<div class="bars">' +
      '<div class="bar-row"><span class="lab">Progres teks</span><div class="track"><div class="fill" style="width:' + Math.min(100, k.progres) + '%"></div></div><span class="val">' + k.progres + '%</span></div>' +
      '<div class="bar-row hl"><span class="lab">Kecepatan vs target ' + k.target + '</span><div class="track"><div class="fill" style="width:' + Math.min(100, k.wpmBersih / k.target * 100) + '%"></div></div><span class="val">' + k.wpmBersih + '</span></div>' +
      '</div>';
    if (k.indikasiTempel) h += '<div class="alert warn" style="margin-top:12px">Ada indikasi teks ditempel (paste) atau diisi otomatis: ' + (k.tempel ? k.tempel + ' kali percobaan tempel diblokir; ' : '') + 'jumlah karakter (' + k.karakter + ') jauh lebih banyak dari ketukan tombol (' + k.tombol + '). Mohon dicek.</div>';
    h += '<p class="r-note">Durasi dihitung ' + k.menit + ' menit. Kata benar = kata yang sama persis dan berurutan dengan teks asli (huruf besar-kecil & tanda baca ikut dinilai). ' +
      'Nilai = 70% kecepatan bersih (' + k.target + ' kata/menit = 100) + 30% akurasi. Tombol hapus dipakai ' + k.hapus + ' kali. ' +
      (k.perangkat === 'HP/Tablet' ? 'Kandidat memakai HP/tablet — kecepatan biasanya lebih rendah dibanding keyboard fisik.' : '') + '</p>';
    if (k.teks) h += '<details><summary>Lihat teks yang diketik kandidat</summary><div class="typed mono">' + esc(k.teks) + '</div></details>';
    return h + '</section>';
  };

  // ================= BANK SOAL =================
  var BANK = { idx: null, cache: {}, showKey: false, q: '' };
  try { BANK.showKey = sessionStorage.getItem('gt_bank_key') === '1'; } catch (e) {}

  X.viewBank = function (kode) {
    if (kode) return bankDetail(kode);
    $app.innerHTML = '<div class="head"><div><h1>Bank Soal</h1><p>Soal hard skill tiap posisi beserta kunci jawaban, plus soal soft skill, ketelitian, dan teks mengetik.</p></div></div>' +
      '<div class="filters"><input type="search" id="bq" placeholder="Cari posisi atau paket soal" value="' + esc(BANK.q) + '"></div>' +
      '<div id="bl"><div class="center-load"><div class="spinner"></div></div></div>';
    document.getElementById('bq').oninput = function (e) { BANK.q = e.target.value; drawIdx(); };
    var p = BANK.idx ? Promise.resolve(BANK.idx) : X.call('adminBank').then(function (r) { BANK.idx = r; return r; });
    p.then(drawIdx).catch(function (e) { if (!e.auth) document.getElementById('bl').innerHTML = '<div class="alert err">' + esc(e.message) + '</div>'; });
  };

  function drawIdx() {
    var el = document.getElementById('bl'); if (!el || !BANK.idx) return;
    var q = BANK.q.trim().toLowerCase(), r = BANK.idx;
    var hs = r.hs.filter(function (x) { return !q || (x.nama + ' ' + x.posisi.join(' ') + ' ' + x.kode).toLowerCase().indexOf(q) >= 0; });
    el.innerHTML = '<h2 class="bank-h">Hard skill per posisi <small>' + r.hs.length + ' paket · 25 soal · ' + r.menitHs + ' menit · lulus ≥ ' + r.lulus + '</small></h2>' +
      (hs.length ? '<div class="bank-grid">' + hs.map(function (x) {
        return '<a class="bank-card" href="#bank/' + encodeURIComponent(x.kode) + '"><b>' + esc(x.nama) + '</b><span>' + x.jumlah + ' soal pilihan ganda</span>' +
          (x.posisi.length && x.posisi.join() !== x.nama ? '<em>' + esc(x.posisi.join(', ')) + '</em>' : '') + '</a>';
      }).join('') + '</div>' : '<div class="tbl-wrap"><div class="empty">Tidak ada paket yang cocok.</div></div>') +
      '<h2 class="bank-h">Soal umum (semua posisi)</h2><div class="bank-grid">' + r.lain.map(function (x) {
        return '<a class="bank-card alt" href="#bank/' + x.kode + '"><b>' + esc(x.nama) + '</b><span>' + (x.kode === 'KETIK' ? 'Teks cerpen' : x.jumlah + ' soal') + '</span></a>';
      }).join('') + '</div>';
  }

  function bankDetail(kode) {
    $app.innerHTML = '<div class="center-load"><div class="spinner"></div></div>';
    var p = BANK.cache[kode] ? Promise.resolve(BANK.cache[kode]) : X.call('adminBankGet', { kode: kode }).then(function (r) { BANK.cache[kode] = r; return r; });
    p.then(drawDetail).catch(function (e) { if (!e.auth) $app.innerHTML = '<div class="alert err">' + esc(e.message) + '</div><a class="btn ghost" href="#bank">Kembali</a>'; });
  }

  function keyToggle() {
    return '<label class="switch"><input type="checkbox" id="kSw"' + (BANK.showKey ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span><span>Tampilkan kunci</span></label>';
  }

  function drawDetail(d) {
    var title = d.nama, meta = '', body = '';
    if (d.jenis === 'HS') {
      meta = d.soal.length + ' soal pilihan ganda · waktu ' + d.menit + ' menit · batas lulus ' + d.lulus + (d.posisi.length ? ' · posisi: ' + esc(d.posisi.join(', ')) : '');
      body = '<ol class="bq-list">' + d.soal.map(function (q, i) {
        return '<li class="bq"><p class="bq-t"><span class="bq-n">' + (i + 1) + '.</span>' + esc(q.q) + '</p><ol class="bq-o">' + q.opts.map(function (o, j) {
          return '<li class="' + (j === q.key ? 'key' : '') + '"><span class="L">' + LET[j] + '</span><span>' + esc(o) + '</span></li>';
        }).join('') + '</ol></li>';
      }).join('') + '</ol>' +
        '<div class="key-table"><h3>Kunci jawaban</h3><div class="kt-grid">' + d.soal.map(function (q, i) { return '<span><b>' + (i + 1) + '</b> ' + LET[q.key] + '</span>'; }).join('') + '</div></div>';
    } else if (d.jenis === 'SOFT') {
      meta = '9 aspek × 10 soal situasi kerja · kunci berupa poin 1–4 per pilihan (4 = paling tepat)';
      body = d.aspek.map(function (a, ai) {
        return '<h3 class="bq-asp">Situasi Kerja ' + (ai + 1) + ' — ' + esc(a.nama) + '</h3><ol class="bq-list">' + a.soal.map(function (q, i) {
          return '<li class="bq"><p class="bq-t"><span class="bq-n">' + (i + 1) + '.</span>' + esc(q.q) + '</p><ol class="bq-o">' + q.opts.map(function (o, j) {
            return '<li class="' + (q.pts[j] === 4 ? 'key' : '') + '"><span class="L">' + LET[j] + '</span><span>' + esc(o) + '</span><span class="pt">' + q.pts[j] + ' poin</span></li>';
          }).join('') + '</ol></li>';
        }).join('') + '</ol>';
      }).join('');
    } else if (d.jenis === 'TEKS') {
      meta = d.soal.length + ' pasang teks · kunci: Sama / Tidak sama';
      body = '<table class="r-tbl bq-teks"><thead><tr><th>No</th><th>Teks kiri</th><th>Teks kanan</th><th class="kcol">Kunci</th></tr></thead><tbody>' +
        d.soal.map(function (x, i) { return '<tr><td>' + (i + 1) + '</td><td class="mono">' + esc(x.a) + '</td><td class="mono">' + esc(x.b) + '</td><td class="kcol">' + (x.sama ? 'Sama' : '<b>Tidak sama</b>') + '</td></tr>'; }).join('') +
        '</tbody></table>';
    } else if (d.jenis === 'KETIK') {
      var nw = d.teks.split(/\s+/).filter(Boolean).length;
      meta = 'Judul: “' + esc(d.judul) + '” · ' + nw + ' kata · waktu ' + d.menit + ' menit';
      body = '<div class="card soft"><p class="r-p" style="margin:0">Kandidat mengetik ulang teks ini persis sama. Penilaian: kata benar dihitung berurutan (huruf besar-kecil & tanda baca dinilai). ' +
        'Nilai = 70% kecepatan bersih (' + d.target + ' kata benar/menit = 100) + 30% akurasi. Tempel (paste) diblokir dan dicatat.</p></div>' +
        '<div class="ketik-teks">' + d.teks.split(/\n\s*\n/).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>';
    }
    var hasKey = d.jenis !== 'KETIK';
    $app.innerHTML = '<div class="toolbar"><a class="btn ghost" href="#bank">Kembali</a><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      (hasKey ? keyToggle() : '') + '<button class="btn" id="bPrB">Unduh PDF</button></div></div>' +
      '<article class="report bank-doc' + (BANK.showKey ? ' show-key' : '') + '" id="bankDoc">' +
      '<header class="r-head"><img src="assets/logo.png" alt="Granostic"><div class="ttl"><h1>Bank Soal: ' + esc(title) + '</h1><p>' + meta + '</p><p class="pk">' +
      (hasKey ? '<span class="on-key">Versi dengan kunci jawaban — RAHASIA</span><span class="off-key">Lembar soal (tanpa kunci)</span>' : 'Teks tes mengetik') + '</p></div></header>' +
      body + '</article>';
    if (hasKey) document.getElementById('kSw').onchange = function (e) {
      BANK.showKey = e.target.checked;
      try { sessionStorage.setItem('gt_bank_key', BANK.showKey ? '1' : '0'); } catch (x) {}
      document.getElementById('bankDoc').classList.toggle('show-key', BANK.showKey);
    };
    document.getElementById('bPrB').onclick = function () {
      var old = document.title;
      document.title = 'Bank Soal - ' + title + (hasKey ? (BANK.showKey ? ' - dengan kunci' : ' - tanpa kunci') : '');
      window.print(); setTimeout(function () { document.title = old; }, 1000);
    };
  }

  // ================= FORMULIR DATA PELAMAR (lihat & cetak) =================
  X.viewForm = function (kode) {
    $app.innerHTML = '<div class="center-load"><div class="spinner"></div></div>';
    X.call('adminDetail', { kode: kode }).then(drawForm)
      .catch(function (e) { if (!e.auth) $app.innerHTML = '<div class="alert err">' + esc(e.message) + '</div><a class="btn ghost" href="#kandidat">Kembali</a>'; });
  };

  function v(x) { return x == null || x === '' ? '–' : esc(x); }
  function row(l, x) { return '<tr><th>' + esc(l) + '</th><td>' + v(x) + '</td></tr>'; }
  function row2(l1, x1, l2, x2) { return '<tr><th>' + esc(l1) + '</th><td>' + v(x1) + '</td><th>' + esc(l2) + '</th><td>' + v(x2) + '</td></tr>'; }
  function bln(s) { if (!s || !/^\d{4}-\d{2}/.test(s)) return s || ''; var p = s.split('-'); return ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][+p[1] - 1] + ' ' + p[0]; }

  function drawForm(det) {
    var k = det.identitas, bio = det.biodata;
    if (!bio) {
      $app.innerHTML = '<div class="toolbar"><a class="btn ghost" href="#kandidat">Kembali</a></div><div class="alert info">Kandidat ini belum mengisi Formulir Data Pelamar' + (k.versi < 3 ? ' (akun dibuat sebelum formulir tersedia)' : '') + '.</div>';
      return;
    }
    var d = bio.data || {}, p = d.pribadi || {}, lw = d.lowongan || {}, q = d.pertanyaan || {}, kh = d.keahlian || {}, ps = d.pernyataan || {};
    var h = '<div class="toolbar"><a class="btn ghost" href="#kandidat">Kembali</a><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<a class="btn ghost" href="#hasil/' + encodeURIComponent(k.kode) + '">Hasil tes</a><button class="btn" id="bPrF">Cetak / simpan PDF</button></div></div>';
    h += '<article class="report fdoc">';
    h += '<header class="r-head"><img src="assets/logo.png" alt="Granostic"><div class="ttl"><h1>Formulir Data Pelamar</h1><p>PT Persada Medika Utama — Granostic Center</p><p>Diisi ' + tgl(bio.waktu, true) + '</p></div></header>';
    h += '<div class="f-pos"><span>Posisi yang dilamar</span><b>' + esc(k.posisi) + '</b></div>';

    h += '<h2 class="f-h">A. Data pribadi</h2><table class="f-tbl">' +
      row2('Nama lengkap', p.nama_lengkap, 'Nama panggilan', p.panggilan) +
      row2('NIK', p.nik, 'Jenis kelamin', p.jenis_kelamin) +
      row2('Tempat, tanggal lahir', [p.tempat_lahir, p.tgl_lahir ? tgl(p.tgl_lahir) : ''].filter(Boolean).join(', '), 'Usia', k.usia != null ? k.usia + ' tahun' : '') +
      row2('Agama', p.agama, 'Status perkawinan', p.status_kawin + (p.jumlah_anak ? ', ' + p.jumlah_anak + ' anak' : '')) +
      row2('Tinggi / berat badan', [p.tinggi ? p.tinggi + ' cm' : '', p.berat ? p.berat + ' kg' : ''].filter(Boolean).join(' / '), 'Golongan darah', p.gol_darah) +
      row2('No. HP / WA', p.no_hp, 'Email', p.email) +
      row2('Anak ke-', p.anak_ke, 'Kontak darurat', [p.darurat_nama, p.darurat_hubungan, p.darurat_hp].filter(Boolean).join(' · ')) +
      '<tr><th>Alamat KTP</th><td colspan="3">' + v(p.alamat_ktp) + '</td></tr>' +
      '<tr><th>Alamat domisili</th><td colspan="3">' + v(p.alamat_domisili) + '</td></tr></table>';

    var pend = d.pendidikan || [];
    h += '<h2 class="f-h">B. Pendidikan</h2>' + (pend.length ? '<table class="f-grid"><thead><tr><th>Jenjang</th><th>Nama sekolah / kampus</th><th>Jurusan</th><th>Kota</th><th>Tahun</th><th>Nilai</th></tr></thead><tbody>' +
      pend.map(function (x) { return '<tr><td>' + v(x.jenjang) + '</td><td>' + v(x.nama_sekolah) + '</td><td>' + v(x.jurusan) + '</td><td>' + v(x.kota) + '</td><td>' + v(x.tahun_masuk ? x.tahun_masuk + '–' + (x.tahun_lulus || 'sekarang') : (x.tahun_lulus || '')) + '</td><td>' + v(x.nilai) + '</td></tr>'; }).join('') +
      '</tbody></table>' : '<p class="muted">–</p>');
    h += '<table class="f-tbl">' + row('Bahasa asing', kh.bahasa) + row('Komputer / aplikasi', kh.komputer) + row('Sertifikat / STR / pelatihan', kh.sertifikat) + row('Keahlian lain', kh.lain) + '</table>';

    var kerja = d.pekerjaan || [];
    h += '<h2 class="f-h">C. Riwayat pekerjaan</h2>' + (d.kerja && d.kerja.fresh ? '<p class="r-p">Belum pernah bekerja (lulusan baru).</p>' : (kerja.length ?
      '<table class="f-grid"><thead><tr><th>Perusahaan</th><th>Posisi</th><th>Periode</th><th>Gaji terakhir</th><th>Alasan berhenti</th></tr></thead><tbody>' +
      kerja.map(function (x) {
        return '<tr><td>' + v(x.perusahaan) + '</td><td>' + v(x.posisi) + '</td><td>' + v(x.mulai ? bln(x.mulai) + ' – ' + (x.selesai ? bln(x.selesai) : 'sekarang') : (x.selesai ? 's.d. ' + bln(x.selesai) : '')) + '</td><td>' + (x.gaji_terakhir ? 'Rp ' + X.rp(x.gaji_terakhir) : '–') + '</td><td>' + v(x.alasan_berhenti) + '</td></tr>' +
          (x.tugas ? '<tr class="sub"><td colspan="5"><span class="muted">Tugas:</span> ' + esc(x.tugas) + '</td></tr>' : '');
      }).join('') + '</tbody></table>' : '<p class="muted">–</p>'));

    h += '<h2 class="f-h">D. Informasi lowongan & gaji</h2><table class="f-tbl">' +
      row('Mengetahui lowongan dari', [lw.sumber, lw.sumber_detail].filter(Boolean).join(': ')) +
      row('Kisaran gaji menurut sumber lowongan', lw.gaji_info_tidak_ada ? 'Sumber tidak menyebutkan gaji' : [lw.gaji_info_min, lw.gaji_info_max].filter(Boolean).map(function (x) { return 'Rp ' + X.rp(x); }).join(' – ')) +
      row('Harapan gaji (take home pay)', lw.harapan_gaji ? 'Rp ' + X.rp(lw.harapan_gaji) + ' per bulan' : '') +
      row('Harapan fasilitas lain', lw.harapan_fasilitas) +
      row('Bisa mulai bekerja', lw.siap_mulai) +
      row('Pernah melamar sebelumnya', lw.pernah_melamar) +
      row('Kerabat di Granostic', lw.kerabat ? lw.kerabat + (lw.kerabat_detail ? ' — ' + lw.kerabat_detail : '') : '') + '</table>';

    var QS = [['rencana_5_tahun', 'Rencana / target 5 tahun ke depan'], ['alasan_melamar', 'Alasan tertarik dengan posisi & Granostic'], ['kontribusi', 'Kontribusi yang bisa diberikan'],
      ['kelebihan', 'Kelebihan'], ['kekurangan', 'Kekurangan & cara mengatasinya'], ['pencapaian', 'Pencapaian yang paling dibanggakan'],
      ['masalah', 'Masalah terberat & penyelesaiannya'], ['lingkungan', 'Lingkungan kerja yang membuat nyaman'], ['tekanan', 'Cara menghadapi tekanan / target']];
    h += '<h2 class="f-h">E. Tentang kandidat</h2><div class="f-qa">' + QS.map(function (x) {
      return '<div><div class="r-sub">' + esc(x[1]) + '</div><p class="r-p">' + v(q[x[0]]).replace(/\n/g, '<br>') + '</p></div>';
    }).join('') + '</div>';
    h += '<table class="f-tbl yn">' + row2('Bersedia lembur', q.lembur, 'Bersedia shift', q.shift) + row2('Bersedia ke luar kota', q.luar_kota, 'Bersedia di posisi lain', q.posisi_lain) + '</table>';

    h += '<h2 class="f-h">F. Pernyataan</h2><p class="r-p f-stmt">Dengan ini saya menyatakan bahwa seluruh data dan jawaban yang saya isi dalam formulir ini adalah benar, lengkap, dan dapat dipertanggungjawabkan. ' +
      'Apabila di kemudian hari ditemukan data yang tidak benar, saya bersedia menerima konsekuensi sesuai ketentuan perusahaan, termasuk pembatalan proses rekrutmen atau pemutusan hubungan kerja.</p>';
    var path = String(bio.ttd || '').replace(/[^MLQ0-9 .,\-]/g, '');
    h += '<div class="f-sign"><div><span class="muted">' + esc(ps.kota || '') + ', ' + tgl(ps.tanggal || bio.waktu) + '</span>' +
      '<svg viewBox="0 0 600 200" class="ttd-svg" role="img" aria-label="Tanda tangan kandidat"><path d="' + path + '" fill="none" stroke="#1D2733" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<b>' + esc(p.nama_lengkap || k.nama) + '</b><span class="muted">Tanda tangan digital pelamar</span></div></div>';
    h += '</article>';
    $app.innerHTML = h;
    document.getElementById('bPrF').onclick = function () {
      var old = document.title; document.title = 'Formulir Pelamar - ' + k.nama;
      window.print(); setTimeout(function () { document.title = old; }, 1000);
    };
  }
})();
