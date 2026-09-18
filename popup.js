import { pdfVeriOlustur } from './parser.js';

const ui = {
  pdfDosya:         document.getElementById('pdfDosya'),
  uploadZone:       document.getElementById('uploadZone'),
  uploadIcon:       document.getElementById('uploadIcon'),
  btnAnaliz:        document.getElementById('btnAnaliz'),
  toast:            document.getElementById('toast'),
  subeSection:      document.getElementById('subeSection'),
  subeListesi:      document.getElementById('subeListesi'),
  subeAktif:        document.getElementById('subeAktif'),
  subeAktifAdi:     document.getElementById('subeAktifAdi'),
  btnDogrula:       document.getElementById('btnDogrula'),
  btnOgretmenAta:   document.getElementById('btnOgretmenAta'),
  btnHaftalikDoldur:document.getElementById('btnHaftalikDoldur'),
  btnEkDersDoldur:  document.getElementById('btnEkDersDoldur'),
  btnSifirla:       document.getElementById('btnSifirla'),
  subeSecimAlani:   document.getElementById('subeSecimAlani'),
  subeManuelSecici: document.getElementById('subeManuelSecici')
};

let secilenDosya = null;

// ── Durum bildirimi (küçük, kendiliğinden kaybolan toast) ──
let toastTimer = null;
function setStatus(renk, metin) {
  ui.toast.textContent = metin;
  ui.toast.className = `toast show ${renk}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2600);
}

// ── PDF seçilince ─────────────────────────────────────────
ui.pdfDosya.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  secilenDosya = f;
  ui.uploadZone.classList.add('has-file');
  ui.uploadIcon.textContent = '✅';
  document.querySelector('.upload-text').innerHTML =
    `<span style="color:#68d391;font-weight:600">${f.name}</span>
     <strong style="color:#68d391">${(f.size/1024).toFixed(0)} KB</strong>`;
  ui.btnAnaliz.disabled = false;
  setStatus('gray', 'Analiz için butona basın');
});

// ── Analiz butonu ─────────────────────────────────────────
ui.btnAnaliz.addEventListener('click', async () => {
  if (!secilenDosya) return;
  ui.btnAnaliz.disabled = true;
  setStatus('blue', 'PDF yerel olarak analiz ediliyor...');

  try {
    const arrayBuffer = await secilenDosya.arrayBuffer();
    const bytes = Array.from(new Uint8Array(arrayBuffer));
    
    // PDF'i popup context'inde ayrıştır (CSP hatasını engeller)
    const veri = await pdfVeriOlustur(bytes);
    
    chrome.storage.local.set({ 'eokul_pdf_veri': veri }, () => {
      setStatus('green', `✓ Analiz Tamamlandı`);
      gosterSubeListesi(veri.subeOzet);
      ui.btnDogrula.disabled = false;
      ui.btnOgretmenAta.disabled = false;
      ui.btnHaftalikDoldur.disabled = false;
      ui.btnEkDersDoldur.disabled = false;
    });

  } catch (err) {
    console.error("PDF Analiz Hatası:", err);
    setStatus('red', 'Hata: ' + err.message);
    ui.btnAnaliz.disabled = false;
  }
});

// ── Şube Listesini Göster ─────────────────────────────────
function gosterSubeListesi(ozet) {
  ui.subeListesi.innerHTML = '';
  ui.subeManuelSecici.innerHTML = '<option value="">Otomatik Seçim</option>';

  ozet.forEach(o => {
    // Manuel seçici için dropdown'ı doldur
    const opt = document.createElement('option');
    opt.value = o.kod;
    opt.textContent = `${o.kod.replace('_', ' ')} (${o.dersAdet} Ders)`;
    ui.subeManuelSecici.appendChild(opt);

    // Liste görünümü
    const div = document.createElement('div');
    div.className = 'sube-item';
    div.innerHTML = `
      <div class="sube-item-name">${o.kod.replace('_', ' ')}${o.birlesi ? ' <span style="font-size:9px;color:#fbd38d">(Birl.)</span>' : ''}</div>
      <div class="sube-item-detail">${o.dersAdet} Ders ${o.ogrAdet} Öğretmen</div>
    `;
    ui.subeListesi.appendChild(div);
  });

  ui.subeSection.style.display = 'block';
  ui.subeSecimAlani.style.display = 'block';
}

// ── Diğer Butonlar (Doğrula, Ata vb.) ────────────────────
ui.btnDogrula.addEventListener('click', () => {
  const secilenSube = ui.subeManuelSecici.value;
  if (!secilenSube) {
    alert("Lütfen bir şube seçin!");
    return;
  }
  
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, {
      islem: 'AKTIF_SUBE_DOGRULA',
      beklenenSube: secilenSube
    }, response => {
      if (chrome.runtime.lastError) {
        alert("E-Okul sayfasıyla iletişim kurulamadı. Sayfayı yenileyin.");
        return;
      }
      if (response && response.uyusuyor) {
        setStatus('green', `✅ E-Okul şubesi (${response.aktif}) ile PDF (${secilenSube}) uyuşuyor.`);
      } else {
        setStatus('red', `❌ UYUMSUZLUK! E-Okul'da '${response.aktif}' açık, siz '${secilenSube}' için işlem yapacaksınız.`);
      }
    });
  });
});

ui.btnOgretmenAta.addEventListener('click', () => {
  const seciliSube = ui.subeManuelSecici.value;
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    chrome.tabs.sendMessage(tabs[0].id, { islem: 'OGRETMEN_ATA', seciliSube });
  });
});

ui.btnHaftalikDoldur.addEventListener('click', () => {
  const seciliSube = ui.subeManuelSecici.value;
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { islem: 'HAFTALIK_DOLDUR', seciliSube }, (res) => {
      if (chrome.runtime.lastError) {
        alert("E-Okul sayfasıyla iletişim kurulamadı. Sayfayı yenileyin.");
        return;
      }
      if (res && res.hata) {
        alert(res.hata);
      } else if (res && res.sayac !== undefined) {
        let msg = `✅ ${res.sayac} ders başarıyla seçildi.`;
        if (res.temizlenen) {
            msg += `\n🧹 ${res.temizlenen} hücrede önceki programdan kalan seçim temizlendi.`;
        }
        if (res.bulunamayanlar && res.bulunamayanlar.length > 0) {
            msg += `\n\n❌ Şu dersler tabloda eşleştirilemedi:\n` + res.bulunamayanlar.join('\n');
            alert(msg);
        } else {
            alert(msg + " Kontrol edip Kaydet'e basabilirsiniz.");
        }
        setStatus('green', `Tablo Dolduruldu: ${res.sayac} ders.`);
      }
    });
  });
});

ui.btnEkDersDoldur.addEventListener('click', () => {
  const seciliSube = ui.subeManuelSecici.value;
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { islem: 'EK_DERS_DOLDUR', seciliSube });
  });
});

ui.btnSifirla.addEventListener('click', () => {
  if (confirm("Seçimleri ve PDF verisini temizlemek istediğinize emin misiniz?")) {
    secilenDosya = null;
    ui.pdfDosya.value = '';
    ui.uploadZone.classList.remove('has-file');
    ui.uploadIcon.textContent = '📄';
    document.querySelector('.upload-text').innerHTML = 'Tıklayın veya PDF Sürükleyin';
    
    ui.btnAnaliz.disabled = true;
    ui.btnDogrula.disabled = true;
    ui.btnOgretmenAta.disabled = true;
    ui.btnHaftalikDoldur.disabled = true;
    ui.btnEkDersDoldur.disabled = true;
    
    ui.subeSection.style.display = 'none';
    ui.subeListesi.innerHTML = '';
    
    setStatus('gray', 'Sıfırlandı. Yeni bir dosya seçin.');
    
    chrome.storage.local.remove('eokul_pdf_veri'); // Storage'dan da sil

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { islem: 'DURDUR' });
    });
  }
});

// ── Popup açıldığında eski veriyi kontrol et ─────────────────
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['eokul_pdf_veri'], (result) => {
    if (result.eokul_pdf_veri) {
      const veri = result.eokul_pdf_veri;
      
      ui.uploadZone.classList.add('has-file');
      ui.uploadIcon.textContent = '✅';
      document.querySelector('.upload-text').innerHTML =
        `<span style="color:#68d391;font-weight:600">Önceki PDF Yüklü</span>`;
      
      setStatus('green', `✓ Önceki Analiz Yüklü`);
      gosterSubeListesi(veri.subeOzet);
      
      ui.btnDogrula.disabled = false;
      ui.btnOgretmenAta.disabled = false;
      ui.btnHaftalikDoldur.disabled = false;
      ui.btnEkDersDoldur.disabled = false;
    }
  });
});