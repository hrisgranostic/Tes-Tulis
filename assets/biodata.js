/* Formulir Data Pelamar (diisi kandidat sebelum tes) + tanda tangan digital.
   GT.biodata.open({ kode, kandidat, onDone }) */
(function () {
  var esc = GT.esc;

  var JENJANG = ['SD', 'SMP', 'SMA', 'SMK', 'D1', 'D2', 'D3', 'D4', 'S1', 'Profesi', 'S2', 'S3'];
  var SUMBER = [
    { v: 'Job portal', d: 'Nama job portal (mis. JobStreet, LinkedIn, Glints, Kalibrr)' },
    { v: 'Referensi teman dari luar Granostic', d: 'Nama teman yang memberi info' },
    { v: 'Referensi teman/karyawan Granostic', d: 'Nama & bagian karyawan Granostic' },
    { v: 'Lainnya', d: 'Sebutkan sumbernya (mis. Instagram, kampus, papan pengumuman)' }
  ];
  var STEPS = ['Data pribadi', 'Pendidikan & keahlian', 'Riwayat kerja', 'Lowongan & gaji', 'Tentang Anda', 'Pernyataan'];
  var PERNYATAAN = 'Dengan ini saya menyatakan bahwa seluruh data dan jawaban yang saya isi dalam formulir ini adalah benar, lengkap, dan dapat dipertanggungjawabkan. ' +
    'Apabila di kemudian hari ditemukan data yang tidak benar, saya bersedia menerima konsekuensi sesuai ketentuan perusahaan, termasuk pembatalan proses rekrutmen ' +
    'atau pemutusan hubungan kerja. Saya juga mengizinkan PT Persada Medika Utama (Granostic Center) memverifikasi data ini untuk keperluan rekrutmen.';

  var S, $root;

  function key() { return 'gt_bio_' + S.kode; }
  function draft(v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(key()) || 'null');
      localStorage.setItem(key(), JSON.stringify(v));
    } catch (e) { return null; }
  }
  function clearDraft() { try { localStorage.removeItem(key()); } catch (e) {} }

  function blank(k) {
    return {
      pribadi: { nama_lengkap: k.nama || '', no_hp: k.no_hp || '', email: k.email || '' },
      pendidikan: [{ jenjang: 'SMA' }, {}],
      keahlian: {},
      kerja: { fresh: false },
      pekerjaan: [{}],
      lowongan: {},
      pertanyaan: {},
      pernyataan: { setuju: false }
    };
  }

  // ---------- builder kecil ----------
  function get(path) { return path.split('.').reduce(function (o, p) { return o == null ? undefined : o[p]; }, S.d); }
  function set(path, v) {
    var ps = path.split('.'), o = S.d;
    for (var i = 0; i < ps.length - 1; i++) { if (o[ps[i]] == null) o[ps[i]] = /^\d+$/.test(ps[i + 1]) ? [] : {}; o = o[ps[i]]; }
    o[ps[ps.length - 1]] = v;
    draft({ d: S.d, step: S.step, ttd: S.ttd });
  }
  function req(r) { return r ? ' <b class="req" aria-label="wajib">*</b>' : ''; }
  function input(path, label, o) {
    o = o || {};
    var v = get(path); v = v == null ? '' : v;
    var t = o.type || 'text';
    var attrs = ' data-p="' + path + '"' + (o.req ? ' data-req="1"' : '') + (o.im ? ' inputmode="' + o.im + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') +
      (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.money ? ' data-money="1"' : '') + ' autocomplete="off"';
    var ctl = t === 'textarea' ? '<textarea' + attrs + ' rows="' + (o.rows || 3) + '">' + esc(v) + '</textarea>' :
      '<input type="' + t + '"' + attrs + ' value="' + esc(o.money ? money(v) : v) + '">';
    return '<label class="f' + (o.cls ? ' ' + o.cls : '') + '"><span>' + esc(label) + req(o.req) + '</span>' + (o.hint ? '<em class="hint">' + esc(o.hint) + '</em>' : '') + ctl + '</label>';
  }
  function select(path, label, opts, o) {
    o = o || {};
    var v = get(path) || '';
    return '<label class="f' + (o.cls ? ' ' + o.cls : '') + '"><span>' + esc(label) + req(o.req) + '</span><select data-p="' + path + '"' + (o.req ? ' data-req="1"' : '') + '>' +
      '<option value="">Pilih…</option>' + opts.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label>';
  }
  function radios(path, label, opts, o) {
    o = o || {};
    var v = get(path) || '';
    return '<fieldset class="f radios' + (o.cls ? ' ' + o.cls : '') + '"' + (o.req ? ' data-req-radio="' + path + '"' : '') + '><legend>' + esc(label) + req(o.req) + '</legend>' +
      opts.map(function (x) { return '<label class="rd"><input type="radio" name="' + path + '" data-p="' + path + '" value="' + esc(x) + '"' + (x === v ? ' checked' : '') + '><span>' + esc(x) + '</span></label>'; }).join('') +
      '</fieldset>';
  }
  function yn(path, label) { return radios(path, label, ['Ya', 'Tidak'], { cls: 'inline' }); }
  function money(v) {
    var n = String(v == null ? '' : v).replace(/\D/g, '');
    return n ? n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  }

  // ---------- langkah ----------
  function step0() {
    return '<div class="grid2">' +
      input('pribadi.nama_lengkap', 'Nama lengkap (sesuai KTP)', { req: 1, max: 100, cls: 'span2' }) +
      input('pribadi.panggilan', 'Nama panggilan', { max: 40 }) +
      input('pribadi.nik', 'NIK (16 digit)', { im: 'numeric', max: 16 }) +
      input('pribadi.tempat_lahir', 'Tempat lahir', { req: 1, max: 60 }) +
      input('pribadi.tgl_lahir', 'Tanggal lahir', { req: 1, type: 'date' }) +
      select('pribadi.jenis_kelamin', 'Jenis kelamin', ['Laki-laki', 'Perempuan'], { req: 1 }) +
      select('pribadi.agama', 'Agama', ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Lainnya']) +
      select('pribadi.status_kawin', 'Status perkawinan', ['Belum menikah', 'Menikah', 'Cerai hidup', 'Cerai mati'], { req: 1 }) +
      input('pribadi.jumlah_anak', 'Jumlah anak', { im: 'numeric', max: 2 }) +
      input('pribadi.tinggi', 'Tinggi badan (cm)', { im: 'numeric', max: 3 }) +
      input('pribadi.berat', 'Berat badan (kg)', { im: 'numeric', max: 3 }) +
      select('pribadi.gol_darah', 'Golongan darah', ['A', 'B', 'AB', 'O', 'Tidak tahu']) +
      input('pribadi.anak_ke', 'Anak ke- dari berapa bersaudara', { ph: 'mis. 2 dari 4', max: 20 }) +
      input('pribadi.alamat_ktp', 'Alamat sesuai KTP', { type: 'textarea', rows: 2, max: 250, cls: 'span2' }) +
      '<label class="check sm span2"><input type="checkbox" id="samaKtp"' + (get('pribadi.domisili_sama') ? ' checked' : '') + '><span>Alamat domisili sama dengan alamat KTP</span></label>' +
      input('pribadi.alamat_domisili', 'Alamat domisili (tempat tinggal sekarang)', { type: 'textarea', rows: 2, req: 1, max: 250, cls: 'span2' }) +
      input('pribadi.no_hp', 'No. HP / WhatsApp', { req: 1, type: 'tel', im: 'tel', max: 20 }) +
      input('pribadi.email', 'Email', { type: 'email', im: 'email', max: 80 }) +
      '<h3 class="span2 sub">Kontak darurat</h3>' +
      input('pribadi.darurat_nama', 'Nama', { max: 80 }) +
      input('pribadi.darurat_hubungan', 'Hubungan', { ph: 'mis. Ibu, Suami, Kakak', max: 40 }) +
      input('pribadi.darurat_hp', 'No. HP', { type: 'tel', im: 'tel', max: 20 }) +
      '</div>';
  }

  function step1() {
    var rows = (S.d.pendidikan || []).map(function (_, i) {
      var p = 'pendidikan.' + i + '.';
      return '<div class="rep"><div class="rep-h"><b>Pendidikan ' + (i + 1) + '</b>' + (i ? '<button type="button" class="btn ghost sm" data-del="pendidikan.' + i + '">Hapus</button>' : '') + '</div><div class="grid2">' +
        select(p + 'jenjang', 'Jenjang', JENJANG, { req: i === 0 }) + input(p + 'nama_sekolah', 'Nama sekolah / kampus', { req: i === 0, max: 100 }) +
        input(p + 'jurusan', 'Jurusan', { max: 80 }) + input(p + 'kota', 'Kota', { max: 60 }) +
        input(p + 'tahun_masuk', 'Tahun masuk', { im: 'numeric', max: 4 }) + input(p + 'tahun_lulus', 'Tahun lulus', { im: 'numeric', max: 4, ph: 'kosongkan bila belum' }) +
        input(p + 'nilai', 'IPK / nilai akhir', { max: 10 }) + '</div></div>';
    }).join('');
    return '<p class="muted">Isi dari jenjang terendah yang relevan (minimal SMA/SMK) sampai yang tertinggi.</p>' + rows +
      ((S.d.pendidikan || []).length < 6 ? '<button type="button" class="btn ghost sm" data-add="pendidikan">+ Tambah pendidikan</button>' : '') +
      '<h3 class="sub">Keahlian</h3><div class="grid2">' +
      input('keahlian.bahasa', 'Bahasa asing yang dikuasai & tingkatnya', { ph: 'mis. Inggris – aktif', max: 120, cls: 'span2' }) +
      input('keahlian.komputer', 'Aplikasi/komputer yang dikuasai', { ph: 'mis. Excel (VLOOKUP, pivot), Word, SIMRS', max: 200, cls: 'span2' }) +
      input('keahlian.sertifikat', 'Sertifikat, STR/SIP, atau pelatihan yang dimiliki', { type: 'textarea', rows: 3, max: 600, cls: 'span2' }) +
      input('keahlian.lain', 'Keahlian lain', { max: 200, cls: 'span2' }) + '</div>';
  }

  function step2() {
    var fresh = !!get('kerja.fresh');
    var rows = fresh ? '' : (S.d.pekerjaan || []).map(function (_, i) {
      var p = 'pekerjaan.' + i + '.';
      return '<div class="rep"><div class="rep-h"><b>Pekerjaan ' + (i + 1) + (i === 0 ? ' (terakhir)' : '') + '</b>' + (i ? '<button type="button" class="btn ghost sm" data-del="pekerjaan.' + i + '">Hapus</button>' : '') + '</div><div class="grid2">' +
        input(p + 'perusahaan', 'Nama perusahaan', { req: i === 0, max: 100 }) + input(p + 'posisi', 'Posisi / jabatan', { req: i === 0, max: 80 }) +
        input(p + 'mulai', 'Mulai bekerja', { type: 'month' }) + input(p + 'selesai', 'Berhenti bekerja', { type: 'month', hint: 'Kosongkan bila masih bekerja' }) +
        input(p + 'gaji_terakhir', 'Gaji terakhir (Rp/bulan)', { im: 'numeric', money: 1, max: 15 }) + input(p + 'alasan_berhenti', 'Alasan berhenti / ingin pindah', { max: 200 }) +
        input(p + 'tugas', 'Tugas & tanggung jawab utama', { type: 'textarea', rows: 2, max: 500, cls: 'span2' }) + '</div></div>';
    }).join('');
    return '<label class="check"><input type="checkbox" id="fresh"' + (fresh ? ' checked' : '') + '><span>Saya belum pernah bekerja (lulusan baru)</span></label>' + rows +
      (!fresh && (S.d.pekerjaan || []).length < 5 ? '<button type="button" class="btn ghost sm" data-add="pekerjaan">+ Tambah riwayat kerja</button>' : '');
  }

  function step3() {
    var s = get('lowongan.sumber') || '', sd = SUMBER.filter(function (x) { return x.v === s; })[0];
    var tdk = !!get('lowongan.gaji_info_tidak_ada');
    return radios('lowongan.sumber', 'Dari mana Anda mengetahui lowongan ini?', SUMBER.map(function (x) { return x.v; }), { req: 1 }) +
      (sd ? input('lowongan.sumber_detail', sd.d, { req: s === 'Lainnya', max: 120 }) : '') +
      '<div class="card soft"><p class="q-sm">Berapa kisaran gaji untuk posisi ini yang <strong>tercantum atau diinformasikan</strong> oleh sumber lowongan tersebut' +
      (s ? ' (' + esc(s.toLowerCase()) + ')' : '') + '?</p>' +
      '<label class="check sm"><input type="checkbox" id="gajiTdk"' + (tdk ? ' checked' : '') + '><span>Sumber lowongan tidak menyebutkan gaji</span></label>' +
      (tdk ? '' : '<div class="grid2">' + input('lowongan.gaji_info_min', 'Dari (Rp/bulan)', { im: 'numeric', money: 1, max: 15 }) +
        input('lowongan.gaji_info_max', 'Sampai (Rp/bulan)', { im: 'numeric', money: 1, max: 15 }) + '</div>') + '</div>' +
      '<div class="grid2">' +
      input('lowongan.harapan_gaji', 'Gaji yang Anda harapkan (take home pay, Rp/bulan)', { req: 1, im: 'numeric', money: 1, max: 15, cls: 'span2' }) +
      input('lowongan.harapan_fasilitas', 'Fasilitas/tunjangan lain yang Anda harapkan', { max: 200, cls: 'span2' }) +
      select('lowongan.siap_mulai', 'Kapan Anda bisa mulai bekerja?', ['Segera', 'Dalam 2 minggu', 'Dalam 1 bulan', 'Lebih dari 1 bulan'], { req: 1 }) +
      select('lowongan.pernah_melamar', 'Pernah melamar ke Granostic sebelumnya?', ['Belum pernah', 'Pernah']) +
      '</div>' + yn('lowongan.kerabat', 'Apakah ada keluarga/kerabat yang bekerja di Granostic?') +
      (get('lowongan.kerabat') === 'Ya' ? input('lowongan.kerabat_detail', 'Nama & bagiannya', { max: 120 }) : '');
  }

  function step4() {
    var ta = function (p, l, r) { return input('pertanyaan.' + p, l, { type: 'textarea', rows: 3, max: 1200, req: r }); };
    return '<p class="muted">Jawab dengan jujur dan dengan kata-kata Anda sendiri. Tidak ada jawaban benar atau salah.</p>' +
      ta('rencana_5_tahun', 'Apa rencana atau target Anda dalam 5 tahun ke depan?', 1) +
      ta('alasan_melamar', 'Mengapa Anda tertarik dengan posisi ini dan bekerja di Granostic Center?', 1) +
      ta('kontribusi', 'Kontribusi apa yang bisa Anda berikan bila diterima?') +
      ta('kelebihan', 'Sebutkan 3–5 kelebihan Anda.') +
      ta('kekurangan', 'Sebutkan 3–5 kekurangan Anda dan cara Anda mengatasinya.') +
      ta('pencapaian', 'Pencapaian apa yang paling Anda banggakan?') +
      ta('masalah', 'Ceritakan masalah terberat yang pernah Anda hadapi dan bagaimana Anda menyelesaikannya.') +
      ta('lingkungan', 'Lingkungan kerja seperti apa yang membuat Anda nyaman dan produktif?') +
      ta('tekanan', 'Bagaimana cara Anda menghadapi tekanan atau target kerja yang tinggi?') +
      '<h3 class="sub">Kesediaan</h3><div class="yn-grid">' +
      yn('pertanyaan.lembur', 'Bersedia lembur bila dibutuhkan?') + yn('pertanyaan.shift', 'Bersedia kerja bergiliran (shift)?') +
      yn('pertanyaan.luar_kota', 'Bersedia ditugaskan ke luar kota?') + yn('pertanyaan.posisi_lain', 'Bersedia ditempatkan di posisi lain yang sesuai?') + '</div>';
  }

  function step5() {
    var today = new Date();
    return '<div class="card soft"><p class="pernyataan">' + esc(PERNYATAAN) + '</p>' +
      '<label class="check"><input type="checkbox" id="setuju"' + (get('pernyataan.setuju') ? ' checked' : '') + '><span>Saya telah membaca dan menyetujui pernyataan di atas.</span></label></div>' +
      '<div class="grid2">' + input('pernyataan.kota', 'Ditandatangani di (kota)', { max: 60, req: 1 }) +
      '<label class="f"><span>Tanggal</span><input type="text" value="' + esc(GT.tgl(today.getTime())) + '" disabled></label></div>' +
      '<div class="ttd-wrap"><div class="ttd-h"><span>Tanda tangan' + req(1) + '</span><button type="button" class="btn ghost sm" id="ttdClear">Ulangi</button></div>' +
      '<div class="ttd-box"><canvas id="ttd" aria-label="Kotak tanda tangan"></canvas><span class="ttd-ph" id="ttdPh">Tanda tangan di sini dengan jari atau mouse</span></div>' +
      '<p class="ttd-name">' + esc(get('pribadi.nama_lengkap') || '') + '</p></div>';
  }

  // ---------- tanda tangan (disimpan sebagai path SVG 600×200) ----------
  function initTtd() {
    var cv = document.getElementById('ttd'), box = cv.parentNode, ph = document.getElementById('ttdPh');
    var W = 600, H = 200, ratio = window.devicePixelRatio || 1, ctx = cv.getContext('2d');
    var strokes = parsePath(S.ttd || ''), cur = null;
    function size() {
      var w = box.clientWidth; cv.style.width = w + 'px'; cv.style.height = (w * H / W) + 'px';
      cv.width = Math.round(w * ratio); cv.height = Math.round(w * H / W * ratio);
      draw();
    }
    function draw() {
      var sx = cv.width / W;
      ctx.setTransform(sx, 0, 0, sx, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1D2733';
      strokes.forEach(function (st) {
        ctx.beginPath(); ctx.moveTo(st[0][0], st[0][1]);
        if (st.length === 1) ctx.lineTo(st[0][0] + 0.1, st[0][1] + 0.1);
        for (var i = 1; i < st.length; i++) ctx.lineTo(st[i][0], st[i][1]);
        ctx.stroke();
      });
      ph.classList.toggle('hidden', strokes.length > 0);
    }
    function pt(e) { var r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * W), Math.round((e.clientY - r.top) / r.height * H)]; }
    cv.addEventListener('pointerdown', function (e) { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = [pt(e)]; strokes.push(cur); draw(); });
    cv.addEventListener('pointermove', function (e) {
      if (!cur) return; var p = pt(e), l = cur[cur.length - 1];
      if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) >= 2) { cur.push(p); draw(); }
    });
    function end() { if (!cur) return; cur = null; S.ttd = toPath(strokes); draft({ d: S.d, step: S.step, ttd: S.ttd }); }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('pointerleave', end);
    cv.style.touchAction = 'none';
    document.getElementById('ttdClear').onclick = function () { strokes = []; S.ttd = ''; draft({ d: S.d, step: S.step, ttd: '' }); draw(); };
    window.addEventListener('resize', size); S.offResize = function () { window.removeEventListener('resize', size); };
    size();
  }
  function toPath(strokes) {
    var s = strokes.map(function (st) { return 'M' + st[0][0] + ' ' + st[0][1] + st.slice(1).map(function (p) { return 'L' + p[0] + ' ' + p[1]; }).join(''); }).join('');
    if (s.length > 44000) { // kurangi titik bila terlalu panjang
      strokes = strokes.map(function (st) { return st.filter(function (_, i) { return i % 2 === 0 || i === st.length - 1; }); });
      return toPath(strokes);
    }
    return s;
  }
  function parsePath(s) {
    var out = [], m, re = /([ML])(\d+) (\d+)/g, cur = null;
    while ((m = re.exec(s))) { if (m[1] === 'M') { cur = []; out.push(cur); } if (cur) cur.push([+m[2], +m[3]]); }
    return out;
  }
  function strokeCount() { return parsePath(S.ttd || '').reduce(function (a, s) { return a + s.length; }, 0); }

  // ---------- render & navigasi ----------
  function render() {
    if (S.offResize) { S.offResize(); S.offResize = null; }
    var st = S.step;
    var body = [step0, step1, step2, step3, step4, step5][st]();
    $root.innerHTML = '<section class="bio">' +
      '<p class="q-part">Formulir Data Pelamar</p><h1>' + esc(STEPS[st]) + '</h1>' +
      '<ol class="bio-steps" aria-label="Langkah">' + STEPS.map(function (n, i) {
        return '<li class="' + (i < st ? 'done' : (i === st ? 'cur' : '')) + '"><span>' + (i + 1) + '</span><em>' + esc(n) + '</em></li>';
      }).join('') + '</ol>' +
      (S.err ? '<div class="alert err" role="alert">' + esc(S.err) + '</div>' : '') +
      '<div class="card bio-card">' + (st === 0 ? '<p class="muted">Posisi yang dilamar: <strong>' + esc(S.kandidat.posisi) + '</strong>. Kolom bertanda <b class="req">*</b> wajib diisi. Isian tersimpan otomatis di perangkat ini.</p>' : '') + body + '</div>' +
      '<div class="bio-nav">' + (st ? '<button type="button" class="btn ghost" id="bBioPrev">Kembali</button>' : '<span></span>') +
      '<button type="button" class="btn" id="bBioNext">' + (st === STEPS.length - 1 ? 'Kirim formulir' : 'Lanjut') + '</button></div></section>';
    S.err = '';
    bind();
    if (st === 5) initTtd();
    window.scrollTo(0, 0);
  }

  function bind() {
    $root.querySelectorAll('[data-p]').forEach(function (el) {
      var p = el.getAttribute('data-p');
      var ev = el.type === 'radio' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(ev, function () {
        var v = el.value;
        if (el.getAttribute('data-money')) { v = v.replace(/\D/g, ''); }
        set(p, v);
        el.classList.remove('bad');
        if (p === 'lowongan.sumber' || p === 'lowongan.kerabat') render();
        if (p === 'pribadi.alamat_ktp' && get('pribadi.domisili_sama')) { set('pribadi.alamat_domisili', v); var d = $root.querySelector('[data-p="pribadi.alamat_domisili"]'); if (d) d.value = v; }
      });
      if (el.getAttribute('data-money')) el.addEventListener('blur', function () { el.value = money(el.value); });
    });
    $root.querySelectorAll('[data-add]').forEach(function (b) {
      b.onclick = function () { var k = b.getAttribute('data-add'); S.d[k] = (S.d[k] || []).concat([{}]); set(k, S.d[k]); render(); };
    });
    $root.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { var p = b.getAttribute('data-del').split('.'); S.d[p[0]].splice(Number(p[1]), 1); set(p[0], S.d[p[0]]); render(); };
    });
    function on(id, fn) { var el = document.getElementById(id); if (el) el.onchange = function () { fn(el.checked); }; }
    on('samaKtp', function (c) {
      set('pribadi.domisili_sama', c);
      if (c) { set('pribadi.alamat_domisili', get('pribadi.alamat_ktp') || ''); render(); }
    });
    on('fresh', function (c) { set('kerja.fresh', c); render(); });
    on('gajiTdk', function (c) { set('lowongan.gaji_info_tidak_ada', c); render(); });
    on('setuju', function (c) { set('pernyataan.setuju', c); });
    var pv = document.getElementById('bBioPrev');
    if (pv) pv.onclick = function () { S.step--; render(); };
    document.getElementById('bBioNext').onclick = next;
  }

  function validate() {
    var miss = [];
    $root.querySelectorAll('[data-req]').forEach(function (el) {
      if (!String(el.value || '').trim()) { el.classList.add('bad'); miss.push(el); }
    });
    $root.querySelectorAll('[data-req-radio]').forEach(function (fs) {
      if (!get(fs.getAttribute('data-req-radio'))) { fs.classList.add('bad'); miss.push(fs); }
    });
    if (miss.length) { S.err = 'Masih ada ' + miss.length + ' isian wajib yang kosong (ditandai merah).'; return miss[0]; }
    var nik = get('pribadi.nik');
    if (S.step === 0 && nik && !/^\d{16}$/.test(nik)) { S.err = 'NIK harus 16 digit angka.'; return $root.querySelector('[data-p="pribadi.nik"]'); }
    var em = get('pribadi.email');
    if (S.step === 0 && em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { S.err = 'Format email belum benar.'; return $root.querySelector('[data-p="pribadi.email"]'); }
    if (S.step === 5) {
      if (!get('pernyataan.setuju')) { S.err = 'Centang persetujuan pernyataan terlebih dahulu.'; return document.getElementById('setuju'); }
      if (strokeCount() < 8) { S.err = 'Tanda tangan belum diisi.'; return document.getElementById('ttd'); }
    }
    return null;
  }

  function next() {
    var bad = validate();
    if (bad) {
      var box = $root.querySelector('.alert.err');
      if (!box) { box = document.createElement('div'); box.className = 'alert err'; box.setAttribute('role', 'alert'); $root.querySelector('.bio-card').before(box); }
      box.textContent = S.err; S.err = '';
      (bad.scrollIntoView && bad.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      if (bad.focus) setTimeout(function () { bad.focus({ preventScroll: true }); }, 250);
      return;
    }
    if (S.step < STEPS.length - 1) { S.step++; draft({ d: S.d, step: S.step, ttd: S.ttd }); render(); return; }
    kirim();
  }

  function payload() {
    var d = JSON.parse(JSON.stringify(S.d));
    d.pendidikan = (d.pendidikan || []).filter(function (x) { return x && (x.jenjang || x.nama_sekolah); });
    d.pekerjaan = d.kerja && d.kerja.fresh ? [] : (d.pekerjaan || []).filter(function (x) { return x && (x.perusahaan || x.posisi); });
    d.pernyataan.setuju = !!d.pernyataan.setuju;
    d.pernyataan.tanggal = new Date().toISOString().slice(0, 10);
    d.posisi = S.kandidat.posisi;
    return d;
  }

  function kirim() {
    var b = document.getElementById('bBioNext'); b.disabled = true; b.textContent = 'Mengirim…';
    GT.api('biodata', { kode: S.kode, data: payload(), ttd: S.ttd }, { timeout: 30000 }).then(function () {
      clearDraft();
      if (S.offResize) S.offResize();
      S.onDone();
    }).catch(function (e) {
      b.disabled = false; b.textContent = 'Kirim formulir';
      GT.dialog('<h2>Formulir belum terkirim</h2><p>' + esc(e.message) + '</p>', [{ label: 'Tutup', value: true }]);
    });
  }

  GT.biodata = {
    open: function (o) {
      $root = document.getElementById('app');
      S = { kode: o.kode, kandidat: o.kandidat, onDone: o.onDone, step: 0, ttd: '', err: '' };
      var dr = draft();
      if (dr && dr.d) { S.d = dr.d; S.step = Math.min(dr.step || 0, STEPS.length - 1); S.ttd = dr.ttd || ''; }
      else S.d = blank(o.kandidat);
      render();
    }
  };
})();
