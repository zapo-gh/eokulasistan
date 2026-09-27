// ============================================================
// popup.js — PDF Parse & UI Kontrolü
// ============================================================

const ui = {
  pdfDosya:         document.getElementById('pdfDosya'),
  uploadZone:       document.getElementById('uploadZone'),
  uploadIcon:       document.getElementById('uploadIcon'),
  btnAnaliz:        document.getElementById('btnAnaliz'),
  statusDot:        document.getElementById('statusDot'),
  statusText:       document.getElementById('statusText'),
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

// ── Durum göstergesi ──────────────────────────────────────
function setStatus(renk, metin) {
  ui.statusDot.className = `status-dot ${renk}`;
  ui.statusText.textContent = metin;
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
  const secilenDosya = ui.pdfDosya.files[0];
  if (!secilenDosya) {
    setStatus('red', 'Lütfen önce bir PDF dosyası seçin.');
    return;
  }

  ui.btnAnaliz.disabled = true;
  setStatus('blue', 'Adım 1: PDF okunuyor...');

  try {
    const arrayBuffer = await secilenDosya.arrayBuffer();
    const pdfData = Array.from(new Uint8Array(arrayBuffer));
    
    setStatus('blue', 'Adım 2: PDF kütüphanesi yükleniyor...');
    const pdfjsLib = await import('./libs/pdf.min.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('libs/pdf.worker.min.mjs');

    setStatus('blue', 'Adım 3: Belge parse ediliyor...');
    const doc = await pdfjsLib.getDocument({ 
        data: new Uint8Array(pdfData),
        disableWorker: true,
        isEvalSupported: false 
    }).promise;
    
    const sayfalar = [];
    for (let i = 1; i <= doc.numPages; i++) {
        setStatus('blue', `Adım 4: Sayfa ${i}/${doc.numPages} çıkarılıyor...`);
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const satirlar = itemleriSatirlara(content.items);
        sayfalar.push({ satirlar });
    }
    
    setStatus('blue', 'Adım 5: Haftalık program oluşturuluyor...');
    const veri = pdfVeriOlusturKoord(sayfalar);
    
    if (Object.keys(veri.dersOgretmen).length === 0) {
        setStatus('red', 'PDF\'te hiçbir şube bulunamadı.');
        ui.btnAnaliz.disabled = false;
        return;
    }
    
    setStatus('blue', 'Adım 6: Veriler kaydediliyor...');
    chrome.storage.local.set({ eokul_pdf_veri: veri }, () => {
        setStatus('green', '✓ ' + Object.keys(veri.dersOgretmen).length + ' şube yüklendi');
        gosterSubeListesi(veri.subeOzet);
        ui.btnDogrula.disabled = false;
        ui.btnOgretmenAta.disabled = false;
        ui.btnHaftalikDoldur.disabled = false;
        ui.btnEkDersDoldur.disabled = false;
    });
  } catch (err) {
    setStatus('red', 'Hata: ' + err.message);
    ui.btnAnaliz.disabled = false;
  }
});


// ── Şube listesini göster ─────────────────────────────────
function gosterSubeListesi(subeler) {
  ui.subeSection.style.display = 'block';
  ui.subeSecimAlani.style.display = 'block';
  ui.subeListesi.innerHTML = '';
  
  // Dropdown'u temizle ve varsayılan seçeneği ekle
  ui.subeManuelSecici.innerHTML = '<option value="">(Otomatik Algıla)</option>';

  subeler.forEach(s => {
    // Listeye ekle
    const div = document.createElement('div');
    div.className = 'sube-item';
    const tag = s.birlesi ? '<span style="color: #ff9800; font-size: 11px; margin-left: 5px;">(Birleşik)</span>' : '';
    div.innerHTML = `
      <span class="sube-item-name">${s.kod} ${tag}</span>
      <span class="sube-item-detail">${s.dersAdet} ders / ${s.ogrAdet} öğretmen</span>
    `;
    ui.subeListesi.appendChild(div);

    // Dropdown'a ekle (GRUP vb. dahil tümünü listele)
    const opt = document.createElement('option');
    opt.value = s.anahtar || s.kod;
    opt.textContent = s.kod + (s.birlesi ? ' (Birleşik)' : '');
    ui.subeManuelSecici.appendChild(opt);
  });
}

// ── Aktif şubeyi göster ───────────────────────────────────
function guncellAktifSube() {
  chrome.storage.local.get(['eokul_bot_durum', 'eokul_pdf_veri'], (res) => {
    const veri = res.eokul_pdf_veri;
    if (veri && Object.keys(veri.dersOgretmen || {}).length > 0) {
      ui.btnDogrula.disabled = false;
      ui.btnOgretmenAta.disabled = false;
      ui.btnHaftalikDoldur.disabled = false;
      ui.btnEkDersDoldur.disabled = false;
      
      // subeOzet varsa onu kullan, yoksa eski method (geriye dönük uyumluluk)
      if (veri.subeOzet) {
        setStatus('green', `✓ ${veri.subeOzet.length} şube önceden yüklü`);
        gosterSubeListesi(veri.subeOzet);
      } else {
        const subeKodlari = Object.keys(veri.dersOgretmen);
        setStatus('green', `✓ ${subeKodlari.length} şube önceden yüklü`);
        gosterSubeListesi(subeKodlari.map(k => ({
          kod: k.replace(/^\w+_/, ''), // Örn "GENEL_9A" -> "9A"
          anahtar: k,
          dersAdet: veri.dersOgretmen[k]?.length || 0,
          ogrAdet: [...new Set((veri.dersOgretmen[k] || []).map(d => d.ogr))].length
        })));
      }
    }
  });
}

// ── Eşleştirmeyi Doğrula ────────────────────────────────────
ui.btnDogrula.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { 
      islem: 'DOGRULA_ESLESME', 
      seciliSube: ui.subeManuelSecici.value 
    });
    window.close();
  });
});

// ── Öğretmen Atama ────────────────────────────────────────
ui.btnOgretmenAta.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { 
      islem: 'OGRETMEN_ATA', 
      seciliSube: ui.subeManuelSecici.value 
    });
    window.close();
  });
});

// ── Haftalık Tablo ────────────────────────────────────────
ui.btnHaftalikDoldur.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { 
      islem: 'HAFTALIK_DOLDUR', 
      seciliSube: ui.subeManuelSecici.value 
    });
    window.close();
  });
});

// ── Ek Ders (Seçmeli/Ortak) Doldurma ──────────────────────
ui.btnEkDersDoldur.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { 
      islem: 'EK_DERS_DOLDUR', 
      seciliSube: ui.subeManuelSecici.value 
    });
    window.close();
  });
});

// ── Durdur / Sıfırla ─────────────────────────────────────
ui.btnSifirla.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { islem: 'DURDUR' });
    window.close();
  });
});

// ── Debug koordinat göster ────────────────────────────────
const btnDbg = document.getElementById('btnDebugGoster');
const debugAlani = document.getElementById('debugAlani');
const debugMetin = document.getElementById('debugMetin');
if (btnDbg) {
  btnDbg.addEventListener('click', () => {
    chrome.storage.local.get(['_haftalik_debug'], (res) => {
      debugAlani.style.display = debugAlani.style.display === 'none' ? 'block' : 'none';
      debugMetin.value = res._haftalik_debug || '(Henüz veri yok — önce PDF analiz edin)';
    });
  });
}

// ── Sayfa yüklenince önceki veriyi kontrol et ─────────────
guncellAktifSube();



const norm = (s) => (s || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]/g, '');

// 2) PDF PARSE MOTORU — Koordinat Tabanlı, Format-Agnostik
    // ============================================================

    /**
     * PDF sayfasındaki text item'larını satır gruplarına ayırır.
     * Her item'ın transform[4]=X, transform[5]=Y koordinatlarını kullanır.
     * Yakın Y değerleri (±yTol puan) aynı satır olarak birleştirilir.
     *
     * Döndürür: [{y, items:[{x,str,w}], text}] — Y'ye göre azalan (sayfa başı en üstte)
     */
    function itemleriSatirlara(pdfItems, yTol = 3) {
        const satirlar = [];
        for (const item of pdfItems) {
            if (!item.str || !item.str.trim()) continue;
            const y = item.transform[5];
            const x = item.transform[4];
            const w = item.width || 0;

            let eklendi = false;
            for (const satir of satirlar) {
                if (Math.abs(satir.y - y) <= yTol) {
                    satir.items.push({ x, str: item.str, w });
                    eklendi = true;
                    break;
                }
            }
            if (!eklendi) satirlar.push({ y, items: [{ x, str: item.str, w }] });
        }

        for (const satir of satirlar) {
            satir.items.sort((a, b) => a.x - b.x);
            satir.text = satir.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
        }

        satirlar.sort((a, b) => b.y - a.y); // Sayfanın başı (yüksek Y) önce
        return satirlar;
    }

    /**
     * Satır listesinde belirtilen label'ın (örn: "Sınıf :") sağındaki metni döndürür.
     * Label item'ı bulunur, aynı satırdaki sağdaki item'lar birleştirilir.
     * maxX: bu X koordinatından sağa bakılmaz (başka bir etiketin başlangıcı).
     */
    function labelSaginiOku(satirlar, labelStr, maxX = Infinity) {
        const labelNorm = labelStr.toLowerCase().replace(/\s+/g, '');
        for (const satir of satirlar) {
            for (let i = 0; i < satir.items.length; i++) {
                const item = satir.items[i];
                // Label item'ı bul: "Sınıf :", "Sınıf : 9-A" gibi item'lar dahil
                const birlesikStr = satir.items
                    .slice(i, Math.min(i + 3, satir.items.length))
                    .map(it => it.str).join('').toLowerCase().replace(/\s+/g, '');
                if (!birlesikStr.includes(labelNorm)) continue;

                // Label'ın bitiş X'ini bul (son iki nokta üst üste ':' sonrası)
                const labelBitisX = item.x + item.w;

                // Aynı satırda, label'dan sonra, maxX'den önce gelen tüm item'ları topla
                const sagdakiler = satir.items
                    .filter(it => it.x > labelBitisX && it.x < maxX)
                    .map(it => it.str)
                    .join(' ')
                    .trim();

                // Label kendi içinde değer barındırıyor olabilir ("Sınıf : 9-A" tek item)
                // Bu durumda ':' işaretinin sağındaki kısmı al
                if (!sagdakiler && item.str.includes(':')) {
                    const kolonSonrasi = item.str.substring(item.str.indexOf(':') + 1).trim();
                    if (kolonSonrasi) return { deger: kolonSonrasi, y: satir.y, x: item.x };
                }

                if (sagdakiler) return { deger: sagdakiler, y: satir.y, x: item.x };
            }
        }
        return null;
    }

    /**
     * Sınıf ve şube bilgisini koordinat tabanlı çıkarır.
     *
     * "Sınıf :" label'ının hemen sağındaki metin = ham sınıf adı.
     * Ham metni yapısal olarak ayrıştırır:
     *   - GRUP sayfaları: "9-A - GRUP1 - GRUP1"  → sinif=9A, grup=GRUP1
     *   - Tire-harf:      "9-A"                   → sinif=9A
     *   - ATP/AMP birleş: "AMP10G-I", "AMP11/G-I" → [9A, 9I]
     *   - ATP/AMP tek:    "ATP9A OTOM"             → sinif=9A, alan=OTOM
     *   - Meslek bitişik: "11MOT E.A."             → sinif=11MOT
     *   - Özel:           "ÖZEL EĞİTM"             → sinif=ÖZEL EĞİTM
     *
     * Döndürür: [{ tip, sinif, alan, anahtar, birlesi }]
     */
    function subeBilgisiCikarKoord(satirlar) {
        // "Sınıf Öğretmeni :" başladığı X'i bul (sınıf adının sağ sınırı)
        let maxX = Infinity;
        for (const satir of satirlar) {
            for (const item of satir.items) {
                if (item.str.includes('Sınıf Öğretmeni')) {
                    maxX = item.x;
                    break;
                }
            }
            if (maxX < Infinity) break;
        }

        const sinifBilgi = labelSaginiOku(satirlar, 'Sınıf :', maxX);
        if (!sinifBilgi) return null;

        const hamSinif = sinifBilgi.deger.trim();

        // ── Ayrıştırma: GRUP sayfaları — "9-A - GRUP1 - GRUP1" ──────────────────────
        const mGrup = hamSinif.match(/^(\d{1,2})-([A-ZÇĞİÖŞÜ]{1,3})\s+-\s+(GRUP\d+)/i);
        if (mGrup) {
            const sinifNo = mGrup[1], subeKod = mGrup[2].toUpperCase(), grupNo = mGrup[3].toUpperCase();
            const sinif = `${sinifNo}${subeKod}`;
            return [{ tip: 'GENEL', sinif, alan: grupNo, anahtar: `GENEL_${sinif}_${grupNo}`, birlesi: false }];
        }

        // ── ATP/AMP Birleşik şube — "AMP10G-I", "AMP 11 A-E", "AMP12F-G-I" ──────────
        const mBirlesi = hamSinif.match(/^(ATP|AMP)\s*(\d{1,2})\s*\/?([A-ZÇĞİÖŞÜ]{1,3})[\/\-]([A-ZÇĞİÖŞÜ]{1,3})(?:[\/\-]([A-ZÇĞİÖŞÜ]{1,3}))?(?:\s+(\S+))?/i);
        if (mBirlesi) {
            const tip = mBirlesi[1].toUpperCase(), sinifNo = mBirlesi[2];
            const sube1 = mBirlesi[3].toUpperCase(), sube2 = mBirlesi[4].toUpperCase();
            const sube3 = mBirlesi[5] ? mBirlesi[5].toUpperCase() : null;
            const alan  = mBirlesi[6] || 'BİRLEŞİK';
            const sonuc = [
                { tip, sinif: `${sinifNo}${sube1}`, alan, anahtar: `${tip}_${sinifNo}${sube1}`, birlesi: true },
                { tip, sinif: `${sinifNo}${sube2}`, alan, anahtar: `${tip}_${sinifNo}${sube2}`, birlesi: true },
            ];
            if (sube3) sonuc.push({ tip, sinif: `${sinifNo}${sube3}`, alan, anahtar: `${tip}_${sinifNo}${sube3}`, birlesi: true });
            return sonuc;
        }

        // ── ATP/AMP Tek şube — "ATP9A OTOM", "AMP 10 I PAZ" ─────────────────────────
        const mATPTek = hamSinif.match(/^(ATP|AMP)\s*(\d{1,2})\s*([A-ZÇĞİÖŞÜ]{1,3})(?:\s+(\S+))?/i);
        if (mATPTek) {
            const tip = mATPTek[1].toUpperCase(), sinifNo = mATPTek[2];
            const subeKod = mATPTek[3].toUpperCase(), alan = mATPTek[4] || '';
            const sinif = `${sinifNo}${subeKod}`;
            return [{ tip, sinif, alan, anahtar: `${tip}_${sinif}`, birlesi: false }];
        }

        // ── Tire-harf format — "9-A", "10-B" ─────────────────────────────────────────
        const mTire = hamSinif.match(/^(\d{1,2})-([A-ZÇĞİÖŞÜ]{1,3})(?:\s|$)/i);
        if (mTire) {
            const sinifNo = mTire[1], subeKod = mTire[2].toUpperCase();
            const sinif = `${sinifNo}${subeKod}`;
            return [{ tip: 'GENEL', sinif, alan: '', anahtar: `GENEL_${sinif}`, birlesi: false }];
        }

        // ── Meslek kodu bitişik — "11MOT E.A.", "12MUHASEBE" ─────────────────────────
        const mMeslek = hamSinif.match(/^(\d{1,2})([A-ZÇĞİÖŞÜ]{2,})/i);
        if (mMeslek) {
            const sinifNo = mMeslek[1], meslekKod = mMeslek[2].toUpperCase();
            const sinif = `${sinifNo}${meslekKod}`;
            return [{ tip: 'MESLEK', sinif, alan: meslekKod, anahtar: `MESLEK_${sinif}`, birlesi: false }];
        }

        // ── Bölüm/özel — "11/G MUH" ──────────────────────────────────────────────────
        const mBolum = hamSinif.match(/^(\d{1,2})\/([A-ZÇĞİÖŞÜ]{1,3})(?:\s+(\S+))?/i);
        if (mBolum) {
            const sinifNo = mBolum[1], subeKod = mBolum[2].toUpperCase(), alan = mBolum[3] || '';
            const sinif = `${sinifNo}${subeKod}`;
            return [{ tip: 'GRUP', sinif, alan, anahtar: `GRUP_${sinif}${alan ? '_'+alan : ''}`, birlesi: false }];
        }

        // ── Sayı + boşluk + harf — "10 MUHASEB" ─────────────────────────────────────
        const mBoşluk = hamSinif.match(/^(\d{1,2})\s+([A-ZÇĞİÖŞÜ]+)/i);
        if (mBoşluk) {
            const sinif = `${mBoşluk[1]} ${mBoşluk[2].toUpperCase()}`;
            return [{ tip: 'GRUP', sinif, alan: mBoşluk[2].toUpperCase(), anahtar: `GRUP_${sinif.replace(' ','_')}`, birlesi: false }];
        }

        // ── Tamamen harf — "ÖZEL EĞİTM" ──────────────────────────────────────────────
        if (/^[A-ZÇĞİÖŞÜ\s]{3,}/i.test(hamSinif)) {
            const sinif = hamSinif.trim().toUpperCase();
            return [{ tip: 'OZEL', sinif, alan: '', anahtar: `OZEL_${sinif.replace(/\s+/g,'_')}`, birlesi: false }];
        }

        // ── Bilinmeyen format: ham metni aynen kullan ────────────────────────────────
        const sinif = hamSinif.trim();
        return [{ tip: 'BILINMIYOR', sinif, alan: '', anahtar: `BILINMIYOR_${norm(sinif)}`, birlesi: false }];
    }

    /**
     * Koordinat tabanlı ders-öğretmen tablosu çıkarma.
     *
     * PDF'te tablo başlığı "Sr  Ders Kodu  Ders Adı  ...  Öğretmen  Yer" satırından
     * imza satırına kadar olan bölümü ayrıştırır.
     *
     * Tablo sütunları, başlık satırındaki item X koordinatlarından öğrenilir:
     *   Sr(~44) | Ders Kodu(~64) | Ders Adı(~167) | Alan/Dal(~264) | Süre(~303) | Öğretmen(~380) | Yer(~509)
     *
     * Döndürür: [{ders, ogr, yer, alan, sure}]
     */
    function dersOgretmenTablosuCikarKoord(satirlar) {
        // 1. Tablo başlık satırını bul ("Sr" + "Ders Kodu" aynı satırda)
        let tabloBaslikSatiri = null;
        for (const satir of satirlar) {
            const metinler = satir.items.map(i => i.str);
            if (metinler.includes('Sr') && metinler.some(m => m.includes('Ders Kodu'))) {
                tabloBaslikSatiri = satir;
                break;
            }
        }
        if (!tabloBaslikSatiri) return [];

        // 2. Sabit veri sütunu X koordinatları (analiz ile ölçülmüş, her iki PDF'te sabit)
        //    Başlık metninin X'i ≠ veri X'i (başlıklar merkez hizalı olabilir)
        //    Gerçek veri X'leri: Sr≈46 | Kod≈57 | Ad≈107 | Alan≈257 | Süre≈308 | Ogr≈322 | Yer≈472
        const sutunlar = {
            srX:   46,   // Sıra numarası
            kodX:  57,   // Ders kodu
            adX:   107,  // Ders adı (uzun metin)
            alanX: 257,  // Alan/Dal (opsiyonel, sadece sinif2.pdf'te)
            sureX: 308,  // Süre (rakam)
            ogrX:  322,  // Öğretmen adı
            yerX:  472   // Sınıf/yer (opsiyonel)
        };

        const xTol = 25; // X sütun toleransı

        // 3. İmza Y'sini bul (Müdür / Yönetici / tarih satırının Y değeri)
        let imzaY = -Infinity;
        for (const satir of satirlar) {
            const satirNorm = norm(satir.text);
            if (satirNorm.includes('müdür') || /\d{2}\.\d{2}\.\d{4}/.test(satir.text)) {
                if (satir.y > imzaY) imzaY = satir.y;
            }
        }

        // 4. Tablo satırlarını ayrıştır (başlıktan imzaya)
        const tabloY = tabloBaslikSatiri.y;
        const atamalar = [];

        // Tablo satırlarını Y aralığında topla
        const tabloSatirlari = satirlar.filter(s => s.y < tabloY && s.y > imzaY);

        // Aynı tablo satırına ait item'ları Y toleransıyla birleştir (yer bilgisi alt satıra taşabilir)
        // Önce sr numarasına sahip satırları (ana satır) bul
        const anaSatirlar = [];
        for (const satir of tabloSatirlari) {
            const srItem = satir.items.find(i => /^\d{1,2}$/.test(i.str.trim()) && Math.abs(i.x - sutunlar.srX) < xTol);
            if (srItem) {
                const srNo = parseInt(srItem.str.trim(), 10);
                if (srNo >= 1 && srNo <= 30) {
                    anaSatirlar.push({ satir, srNo });
                }
            }
        }

        for (const { satir, srNo } of anaSatirlar) {
            // Bu ana satır + hemen altındaki satırları birleştir (yer bilgisi taşabilir)
            const birlesikItems = [...satir.items];
            for (const alt of tabloSatirlari) {
                const fark = satir.y - alt.y;
                if (fark > 2 && fark < 20) { // alt satır, 2-20 puan aşağıda
                    // Ana satırda sr numarası olmayan alt satır ise ekle
                    const altSrItem = alt.items.find(i => /^\d{1,2}$/.test(i.str.trim()) && Math.abs(i.x - sutunlar.srX) < xTol);
                    if (!altSrItem) birlesikItems.push(...alt.items);
                }
            }

            // Sütunlara göre ayır
            const siraNoItem = birlesikItems.find(i => /^\d{1,2}$/.test(i.str.trim()) && Math.abs(i.x - sutunlar.srX) < xTol);
            if (!siraNoItem) continue;

            // Ders kodu sütunundan gelen item'lar
            // Ders kodu sütunu — sıra numarasını (tek/çift rakam) hariç tut
            const kodItems = birlesikItems.filter(i =>
                i.x >= sutunlar.kodX - xTol && i.x < sutunlar.adX - xTol &&
                !/^\d{1,2}$/.test(i.str.trim())
            );
            // Ders adı sütunundan gelen item'lar
            const adItems  = birlesikItems.filter(i => i.x >= sutunlar.adX - xTol && i.x < (sutunlar.alanX || sutunlar.sureX || sutunlar.ogrX) - xTol);
            // Alan/Dal sütunu (opsiyonel) — bazı sütun düzenlerinde bulunmayabilir
            const alanItems = sutunlar.alanX
                ? birlesikItems.filter(i => i.x >= sutunlar.alanX - xTol && i.x < sutunlar.sureX - xTol)
                : [];
            // Süre
            const sureItems = birlesikItems.filter(i => sutunlar.sureX && Math.abs(i.x - sutunlar.sureX) < xTol && /^\d+$/.test(i.str.trim()));
            // Öğretmen sütunu — sadece sayısal olmayan (süre rakamı, sıra no. gelmesin)
            const ogrItems  = birlesikItems.filter(i =>
                i.x >= sutunlar.ogrX - xTol && i.x < (sutunlar.yerX || Infinity) - xTol &&
                !/^\d{1,2}$/.test(i.str.trim())
            );
            // Yer sütunu
            const yerItems  = sutunlar.yerX ? birlesikItems.filter(i => i.x >= sutunlar.yerX - xTol) : [];

            const dersKodu = kodItems.map(i => i.str).join(' ').trim();
            const dersAdi  = adItems.map(i => i.str).join(' ').trim();
            const alanDal  = alanItems.map(i => i.str).join(' ').trim();
            const sure     = sureItems.length ? parseInt(sureItems[0].str, 10) : null;
            const ogrMetin = ogrItems.map(i => i.str).join(' ').trim();
            const yer      = yerItems.map(i => i.str).join(' ').trim();

            if (!dersAdi || dersAdi.length < 2) continue;

            // Öğretmenleri " - " ile ayır
            const ogretmenler = ogrMetin.split(/\s+-\s+/).map(o => o.trim()).filter(Boolean);
            for (const ogr of ogretmenler) {
                if (ogr.length < 4 || ogr.length > 45) continue;
                const ogrNorm = norm(ogr);
                // Yönetici/sahte öğretmen filtresi
                if (ogrNorm.includes('müdür') || ogrNorm.includes('yardımcısı') ||
                    ogrNorm.includes('müzikçi')) continue;
                atamalar.push({ ders: dersAdi, kod: dersKodu, ogr, yer, alan: alanDal, sure });
            }
        }

        return atamalar;
    }

    /**
     * Koordinat tabanlı haftalık program çıkarma.
     *
     * Günler (Pazartesi–Cuma) sayfanın sol kenarında (X≈42) dikey olarak dizilir.
     * Her gün satırında: ders kodu satırı (üstte) + öğretmen kısaltması satırı (altta) + yer satırı (en altta)
     * Her bloğun yanında zaman damgası ("08:30-09:10") yer alır.
     *
     * Döndürür: {Pazartesi:[d1..], Sali:[..], Carsamba:[..], Persembe:[..], Cuma:[..]}
     */
    function haftalikProgramCikarKoord(satirlar, kodAdHaritasi) {
        const GUNLER = [
            { ad: 'Pazartesi', key: 'Pazartesi' },
            { ad: 'Sal\u0131',      key: 'Sali'      },
            { ad: '\u00c7ar\u015famba',  key: 'Carsamba'  },
            { ad: 'Per\u015fembe',  key: 'Persembe'  },
            { ad: 'Cuma',      key: 'Cuma'       },
        ];
        let tabloBasY = Infinity;
        for (const satir of satirlar) {
            if (satir.items.some(i => i.str === 'Sr') && satir.items.some(i => i.str.includes('Ders Kodu'))) {
                tabloBasY = satir.y; break;
            }
        }
        const programSatirlari = satirlar.filter(s => s.y > tabloBasY);
        const saatPattern = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
        const tumSaatItemlari = [];
        for (const satir of programSatirlari) {
            for (const item of satir.items) {
                if (saatPattern.test(item.str.trim()) && item.x > 80)
                    tumSaatItemlari.push({ saat: item.str.trim(), x: item.x, y: satir.y });
            }
        }
        if (tumSaatItemlari.length === 0) return { haftalik: {}, siraliSaatler: [] };
        const siraliSaatler = [...new Set(tumSaatItemlari.map(s => s.saat))].sort();
        const saatYGruplari = [];
        for (const si of tumSaatItemlari) {
            const g = saatYGruplari.find(g => Math.abs(g.grupY - si.y) <= 5);
            if (g) {
                // Aynı (saat, x) ikilisi zaten eklenmiş ise tekrar ekleme
                if (!g.saatler.some(s => s.saat === si.saat && Math.abs(s.x - si.x) < 3))
                    g.saatler.push(si);
            } else {
                saatYGruplari.push({ grupY: si.y, saatler: [si] });
            }
        }
        saatYGruplari.sort((a, b) => b.grupY - a.grupY);
        const gunItems = [];
        for (const satir of programSatirlari) {
            for (const item of satir.items) {
                if (item.x < 80 && GUNLER.some(g => g.ad === item.str.trim()))
                    gunItems.push({ gun: item.str.trim(), y: satir.y });
            }
        }
        const _dbg = [`tabloBasY=${tabloBasY.toFixed(1)}`];
        _dbg.push('gunItems: ' + gunItems.map(g => `${g.gun}:${g.y.toFixed(1)}`).join(', '));
        _dbg.push('saatGruplari: ' + saatYGruplari.map(g => `y=${g.grupY.toFixed(1)}(${g.saatler.length})`).join(', '));
        programSatirlari.slice(0,50).forEach(s => {
            _dbg.push(`y=${s.y.toFixed(1)}: ` + s.items.slice(0,4).map(i => `[x${i.x.toFixed(0)}]${i.str}`).join(' '));
        });
        chrome.storage.local.set({ _haftalik_debug: _dbg.join('\n') });
        const haftalik = {};
        const gunKeys = GUNLER.map(g => g.key);
        for (let gi = 0; gi < saatYGruplari.length; gi++) {
            const grup = saatYGruplari[gi];
            let enYakinGun = null, enYakinMesafe = Infinity;
            for (const gi2 of gunItems) {
                const m = Math.abs(gi2.y - grup.grupY);
                if (m < enYakinMesafe) { enYakinMesafe = m; enYakinGun = gi2; }
            }
            if (!enYakinGun || enYakinMesafe > 60) continue;
            const gunDef = GUNLER.find(g => g.ad === enYakinGun.gun);
            if (!gunDef) continue;
            if (!haftalik[gunDef.key]) haftalik[gunDef.key] = Array(siraliSaatler.length).fill('');
            const dersler = haftalik[gunDef.key];
            const ustGrupY = gi > 0 ? saatYGruplari[gi-1].grupY : Infinity;
            const altGrupY = gi < saatYGruplari.length-1 ? saatYGruplari[gi+1].grupY : -Infinity;
            // ustSinir: bir önceki saat grubunun hemen altına kadar genişlet
            // (Midpoint yerine üst gruba 4pt yaklaşık — ders kodu satırları arada kalmasın)
            const ustSinir = ustGrupY === Infinity ? Infinity : ustGrupY - 4;
            const altSinir = (grup.grupY + altGrupY) / 2;
            grup.saatler.sort((a,b) => a.x - b.x);
            const saatXleri = grup.saatler.map(s => s.x);
            for (const si of grup.saatler) {
                const slotIdx = siraliSaatler.indexOf(si.saat);
                if (slotIdx === -1) continue;
                const xi = saatXleri.indexOf(si.x);
                const solX = xi > 0 ? (saatXleri[xi-1]+si.x)/2 : si.x-28;
                const sagX = xi < saatXleri.length-1 ? (si.x+saatXleri[xi+1])/2 : si.x+50;
                const adaylar = [];
                for (const satir of programSatirlari) {
                    if (satir.y <= altSinir || satir.y > ustSinir) continue;
                    if (Math.abs(satir.y - grup.grupY) < 2) continue;
                    for (const item of satir.items.filter(i => i.x>=solX && i.x<sagX && !saatPattern.test(i.str.trim()))) {
                        if (item.str.trim()) adaylar.push({ str: item.str.trim(), y: satir.y });
                    }
                }
                let dersKodu = '';
                for (const aday of adaylar) {
                    const na = norm(aday.str);
                    for (const k of Object.keys(kodAdHaritasi)) {
                        const nk = norm(k);
                        if (na===nk||na.startsWith(nk)||nk.startsWith(na)) { dersKodu=aday.str; break; }
                    }
                    if (dersKodu) break;
                }
                if (!dersKodu) {
                    // Önce içinde rakam olan (kod benzeri) öğeleri tercih et
                    const kodGibi = adaylar.filter(a => a.str.length<=20 && /[A-Z\u00c7\u011e\u0130\u00d6\u015e\u00dc]{2,}\d/.test(a.str));
                    if (kodGibi.length) {
                        dersKodu = kodGibi[0].str;
                    } else {
                        // Eğer rakamlı kod yoksa, en az 4 büyük harften oluşan kelimeleri ders adı kabul et
                        const harfli = adaylar.filter(a => a.str.length<=30 && /[A-Z\u00c7\u011e\u0130\u00d6\u015e\u00dc]{4,}/.test(a.str));
                        if (harfli.length) dersKodu = harfli[0].str;
                    }
                }
                if (!dersKodu) continue;
                const kn = norm(dersKodu);
                let dersAdi = '';
                for (const [k,v] of Object.entries(kodAdHaritasi)) {
                    if ((kn===k||kn.startsWith(k)||k.startsWith(kn)) && k.length>norm(dersAdi).length) dersAdi=v;
                }
                dersler[slotIdx] = dersAdi || dersKodu;
            }
        }
        for (const key of gunKeys) if (!haftalik[key]) haftalik[key]=Array(siraliSaatler.length).fill('');
        return { haftalik, siraliSaatler };
    }

    /**
     * pdfjs ile PDF sayfalarını yükler ve her sayfa için yapısal veri döndürür.
     * Metin düz string yerine satır+item yapısı (koordinatlar dahil) olarak döner.
     */
    async function pdfdenSayfaCikar(pdfBytes) {
        const pdfjsLib = await import('./libs/pdf.min.mjs');
        // Worker'ı tamamen iptal et (popup içinde MV3 worker sorunları olmaması için)
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';

        const doc = await pdfjsLib.getDocument({ 
            data: new Uint8Array(pdfBytes),
            disableWorker: true,
            isEvalSupported: false 
        }).promise;
        const sayfalar = [];
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            const satirlar = itemleriSatirlara(content.items);
            // Geriye dönük uyumluluk için düz metin de sakla
            const text = content.items.map(item => item.str).join(' ');
            sayfalar.push({ satirlar, text });
        }
        return sayfalar;
    }

    /**
     * PDF sayfalarını parse edip veri yapısı oluşturur.
     * Koordinat tabanlı ayrıştırma kullanır.
     * Döndürür: { dersOgretmen: {...}, haftalikProg: {...}, subeOzet: [...] }
     */
    function pdfVeriOlusturKoord(sayfalar) {
        const dersOgretmen  = {};
        const haftalikProg  = {};
        const subeOzet      = [];
        const eklenenSubeler = new Set();

        for (const { satirlar } of sayfalar) {
            // 1. Şube bilgisini koordinat tabanlı çıkar
            const subeListesi = subeBilgisiCikarKoord(satirlar);
            if (!subeListesi || subeListesi.length === 0) continue;

            // 2. Ders-öğretmen tablosunu koordinat tabanlı çıkar
            const atamalar = dersOgretmenTablosuCikarKoord(satirlar);

            // 3. Kod → Ad haritasını oluştur (tablo verilerinden)
            const kodAdHaritasi = {};
            for (const atama of atamalar) {
                if (atama.kod && atama.ders) {
                    kodAdHaritasi[norm(atama.kod)] = atama.ders;
                    kodAdHaritasi[atama.kod] = atama.ders; // ham key de sakla
                }
            }

            // 4. Haftalık programı koordinat tabanlı çıkar
            const { haftalik } = haftalikProgramCikarKoord(satirlar, kodAdHaritasi);

            // 5. Tüm şubelere kaydet
            for (const subeInfo of subeListesi) {
                const anahtar = subeInfo.anahtar;

                if (atamalar.length > 0) {
                    dersOgretmen[anahtar] = atamalar;
                    if (!eklenenSubeler.has(anahtar)) {
                        const ogrSet = new Set(atamalar.map(a => a.ogr));
                        subeOzet.push({
                            kod: subeInfo.sinif + (subeInfo.alan ? ' ' + subeInfo.alan : ''),
                            anahtar: anahtar,
                            dersAdet: atamalar.length,
                            ogrAdet: ogrSet.size,
                            birlesi: subeInfo.birlesi
                        });
                        eklenenSubeler.add(anahtar);
                    }
                }

                if (haftalik && Object.keys(haftalik).length > 0) {
                    haftalikProg[anahtar] = haftalik;
                }
            }
        }

        return { dersOgretmen, haftalikProg, subeOzet };
    }




    
