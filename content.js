
// ============================================================
// content.js — e-Okul Ders Programı Sayfasında Çalışan Kodlar
// ============================================================

const norm = (s) => (s || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]/g, '');

    // 3) AKTİF ŞUBE TESPİTİ
    // ============================================================

    /**
     * e-Okul dropdown'undan aktif şubenin anahtar kodunu çıkarır.
     * Desteklenen formatlar:
     *   "AMP - 9. Sınıf / A Şubesi (BİL)"
     *   "ATP - 10. Sınıf / I Şubesi (OTOM)"
     *   "AMP - 11. Sınıf / II Şubesi (PAZ)"
     * Döndürür: "AMP_9A", "ATP_10I", "AMP_11II" vb.
     */
    function aktifSubeyiBul() {
        // Önce isim içeren select'i bul (Sube veya SınıfŞube vb.)
        const sel = document.querySelector("select[name*='Sube'], select[id*='Sube'], select[id*='sube']");
        const t = sel ? sel.options[sel.selectedIndex]?.text : '';
        if (!t) return null;
        // Boş seçenek kontrolü
        if (/\(-\)|\(- \)|\( - \)/.test(t)) return null;

        // Okul tipi: ATP veya AMP
        const turMatch = t.match(/\b(ATP|AMP)\b/i);
        if (!turMatch) return null;
        const tur = turMatch[1].toUpperCase();

        // Sınıf numarası: "9. Sınıf", "10. Sınıf" vb.
        const sinifMatch = t.match(/(\d+)[\.\s]*Sınıf/i);
        if (!sinifMatch) return null;
        const sinifNo = sinifMatch[1]; // "9", "10", "11", "12"

        // Şube harfi/kodu: "/ A Şubesi", "/ I Şubesi", "/ II Şubesi"
        const subeMatch = t.match(/\/\s*([A-ZÇĞİÖŞÜ]+)\s*Şubesi/i);
        if (!subeMatch) return null;
        const subeKod = subeMatch[1].toUpperCase(); // "A", "I", "II"

        return `${tur}_${sinifNo}${subeKod}`; // Örn: "AMP_10I", "ATP_9A"
    }

    // ============================================================
    // 4) EŞLEŞTİRME DOĞRULAMA MOTORU
    // ============================================================

    /**
     * e-Okul'daki ders ve öğretmen dropdown'larını okuyup
     * PDF verisindeki her atama için eşleşme skoru hesaplar.
     * Sonuç: [{pdfDers, pdfOgr, dersEsleme, ogrEsleme, durum}, ...]
     * durum: 'iyi' (≥85), 'belirsiz' (50–84), 'hata' (<50)
     */
    function eslesmePlaniHazirla(sube, pdfVeri) {
        const ddlDers = document.getElementById('ddlDersler');
        const ddlOgr  = document.getElementById('ddlOgretmen');

        if (!ddlDers || !ddlOgr) return null;

        const dersSecenekler = Array.from(ddlDers.options);
        const ogrSecenekler  = Array.from(ddlOgr.options);
        const liste = pdfVeri.dersOgretmen[sube] || [];
        const plan = [];

        for (const atama of liste) {
            const dersEsleme = enIyiEslesmeyiBul(atama.ders, dersSecenekler);
            const ogrEsleme  = enIyiEslesmeyiBul(atama.ogr,  ogrSecenekler);

            const dSkor = dersEsleme?.skor || 0;
            const oSkor = ogrEsleme?.skor  || 0;
            const minSkor = Math.min(dSkor, oSkor);

            plan.push({
                pdfDers:    atama.ders,
                pdfOgr:     atama.ogr,
                dersEsleme: dersEsleme || { value: '', text: '—', skor: 0 },
                ogrEsleme:  ogrEsleme  || { value: '', text: '—', skor: 0 },
                durum: minSkor >= 85 ? 'iyi' : minSkor >= 50 ? 'belirsiz' : 'hata',
                // Tam option listeleri (modal'da seçim için)
                dersSecenekler: dersSecenekler.map(o => ({ value: o.value, text: o.text })),
                ogrSecenekler:  ogrSecenekler.map(o => ({ value: o.value, text: o.text })),
            });
        }
        return plan;
    }

    /**
     * Doğrulama modalını sayfaya enjekte eder.
     * Kullanıcı onaylayınca onaylanmış harita storage'a kaydedilir.
     */
    function dogrulamaModaliniGoster(sube, plan) {
        // Varsa eski modalı kaldır
        const eskiModal = document.getElementById('eokul-asistan-modal');
        if (eskiModal) eskiModal.remove();

        const iyi      = plan.filter(p => p.durum === 'iyi').length;
        const belirsiz = plan.filter(p => p.durum === 'belirsiz').length;
        const hata     = plan.filter(p => p.durum === 'hata').length;

        const satırlar = plan.map((p, i) => {
            const renk = p.durum === 'iyi' ? '#276749' : p.durum === 'belirsiz' ? '#744210' : '#742a2a';
            const ikon = p.durum === 'iyi' ? '✅' : p.durum === 'belirsiz' ? '⚠️' : '❌';

            const dersOpts = p.dersSecenekler.map(o =>
                `<option value="${o.value}" ${o.value === p.dersEsleme.value ? 'selected' : ''}>${o.text}</option>`
            ).join('');
            const ogrOpts = p.ogrSecenekler.map(o =>
                `<option value="${o.value}" ${o.value === p.ogrEsleme.value ? 'selected' : ''}>${o.text}</option>`
            ).join('');

            return `
            <tr style="border-bottom:1px solid #1e2535;background:${renk}22">
              <td style="padding:6px 8px;font-size:11px;color:#a0aec0;white-space:nowrap">
                ${ikon} <span style="color:#e2e8f0;font-weight:600">${p.pdfDers}</span><br>
                <span style="font-size:10px;color:#718096">${p.pdfOgr}</span>
              </td>
              <td style="padding:6px 8px">
                <select data-idx="${i}" data-tip="ders"
                  style="width:100%;background:#141824;border:1px solid #2d3748;color:#e2e8f0;border-radius:5px;padding:3px 5px;font-size:10px">
                  ${dersOpts}
                </select>
                <div style="font-size:9px;color:${p.dersEsleme.skor>=85?'#68d391':p.dersEsleme.skor>=50?'#f6ad55':'#fc8181'};margin-top:2px">Uyum: ${p.dersEsleme.skor}%</div>
              </td>
              <td style="padding:6px 8px">
                <select data-idx="${i}" data-tip="ogr"
                  style="width:100%;background:#141824;border:1px solid #2d3748;color:#e2e8f0;border-radius:5px;padding:3px 5px;font-size:10px">
                  ${ogrOpts}
                </select>
                <div style="font-size:9px;color:${p.ogrEsleme.skor>=85?'#68d391':p.ogrEsleme.skor>=50?'#f6ad55':'#fc8181'};margin-top:2px">Uyum: ${p.ogrEsleme.skor}%</div>
              </td>
            </tr>`;
        }).join('');

        const html = `
        <div id="eokul-asistan-modal" style="
          position:fixed;inset:0;z-index:999999;
          background:rgba(0,0,0,0.85);
          display:flex;align-items:flex-start;justify-content:center;
          padding:20px;overflow-y:auto;
          font-family:'Segoe UI',sans-serif;
        ">
          <div style="
            background:#0f1117;border:1px solid #2d3748;
            border-radius:14px;width:100%;max-width:900px;
            box-shadow:0 25px 60px rgba(0,0,0,0.8);
          ">
            <!-- Başlık -->
            <div style="padding:18px 22px;border-bottom:1px solid #1e2535;display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:16px;font-weight:700;color:#63b3ed">🔗 Eşleştirme Doğrulama — ${sube}</div>
                <div style="font-size:11px;color:#718096;margin-top:4px">
                  PDF verisi ↔ e-Okul dropdown eşleştirmesi. Kırmızı/sarı satırları kontrol edin.
                </div>
              </div>
              <button onclick="document.getElementById('eokul-asistan-modal').remove()" style="
                background:#742a2a;border:none;color:#feb2b2;border-radius:7px;
                padding:7px 12px;cursor:pointer;font-size:12px;font-weight:600"
              >✕ Kapat</button>
            </div>

            <!-- Özet -->
            <div style="padding:12px 22px;display:flex;gap:12px;border-bottom:1px solid #1e2535">
              <span style="background:#276749;color:#9ae6b4;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600">✅ Otomatik: ${iyi}</span>
              <span style="background:#744210;color:#fbd38d;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600">⚠️ Belirsiz: ${belirsiz}</span>
              <span style="background:#742a2a;color:#feb2b2;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600">❌ Eşleşmedi: ${hata}</span>
              <span style="color:#718096;font-size:11px;margin-left:auto">Toplam: ${plan.length} atama</span>
            </div>

            <!-- Tablo -->
            <div style="padding:16px 22px;max-height:60vh;overflow-y:auto">
              <table style="width:100%;border-collapse:collapse">
                <thead>
                  <tr style="border-bottom:1px solid #2d3748">
                    <th style="text-align:left;padding:6px 8px;font-size:10px;color:#4a5568;text-transform:uppercase;letter-spacing:1px;width:30%">PDF Verisi</th>
                    <th style="text-align:left;padding:6px 8px;font-size:10px;color:#4a5568;text-transform:uppercase;letter-spacing:1px;width:35%">e-Okul Dersi</th>
                    <th style="text-align:left;padding:6px 8px;font-size:10px;color:#4a5568;text-transform:uppercase;letter-spacing:1px;width:35%">e-Okul Öğretmeni</th>
                  </tr>
                </thead>
                <tbody id="eokul-esleme-tbody">${satırlar}</tbody>
              </table>
            </div>

            <!-- Alt butonlar -->
            <div style="padding:16px 22px;border-top:1px solid #1e2535;display:flex;gap:10px;justify-content:flex-end">
              <button onclick="document.getElementById('eokul-asistan-modal').remove()" style="
                background:#1e2535;border:1px solid #2d3748;color:#a0aec0;
                padding:10px 20px;border-radius:8px;cursor:pointer;font-size:12px"
              >İptal</button>
              <button id="eokul-onayla-btn" style="
                background:linear-gradient(135deg,#276749,#22543d);
                border:1px solid #2f855a;color:#9ae6b4;
                padding:10px 24px;border-radius:8px;cursor:pointer;
                font-size:13px;font-weight:700"
              >✅ Onayla &amp; Öğretmenleri Ata</button>
            </div>
          </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);

        // Onayla butonu
        document.getElementById('eokul-onayla-btn').addEventListener('click', () => {
            // Güncel seçimleri topla
            const tbody = document.getElementById('eokul-esleme-tbody');
            const dersSelectler = tbody.querySelectorAll('select[data-tip="ders"]');
            const ogrSelectler  = tbody.querySelectorAll('select[data-tip="ogr"]');

            const onayliHarita = plan.map((p, i) => ({
                pdfDers: p.pdfDers,
                pdfOgr:  p.pdfOgr,
                dersValue: dersSelectler[i].value,
                dersText:  dersSelectler[i].options[dersSelectler[i].selectedIndex]?.text || '',
                ogrValue:  ogrSelectler[i].value,
                ogrText:   ogrSelectler[i].options[ogrSelectler[i].selectedIndex]?.text || '',
            })).filter(p => p.dersValue && p.ogrValue); // boş seçenekleri çıkar

            if (onayliHarita.length === 0) {
                alert('Hiçbir geçerli eşleştirme yok. Lütfen kontrol edin.'); return;
            }

            // Modalı kapat ve atamayı başlat
            document.getElementById('eokul-asistan-modal').remove();

            chrome.storage.local.set({
                eokul_onay_harita: { [sube]: onayliHarita },
                eokul_bot_durum: { aktif: true, islem: 'OGRETMEN_ATA_ONAYLANMIS', sube, index: 0 }
            }, () => siradakiDersiAtaOnaylanmis());
        });
    }

    // ============================================================
    // 5) ÖĞRETMEN ATAMA MOTORU (ONAYLANMIŞ HARİTA)
    // ============================================================

    function siradakiDersiAtaOnaylanmis() {
        chrome.storage.local.get(['eokul_bot_durum', 'eokul_onay_harita'], function (res) {
            if (!res.eokul_bot_durum || res.eokul_bot_durum.islem !== 'OGRETMEN_ATA_ONAYLANMIS') return;
            const state = res.eokul_bot_durum;
            const harita = res.eokul_onay_harita;
            const liste = harita?.[state.sube];

            if (!liste || state.index >= liste.length) {
                alert(`🎉 ${state.sube} şubesinin tüm (${liste?.length || 0}) öğretmen atamaları tamamlandı!`);
                chrome.storage.local.remove('eokul_bot_durum');
                return;
            }

            const ddlDers = document.getElementById('ddlDersler');
            const ddlOgr  = document.getElementById('ddlOgretmen');

            if (!ddlDers || !ddlOgr) { setTimeout(siradakiDersiAtaOnaylanmis, 800); return; }
            if (ddlDers.disabled || ddlOgr.disabled) { eOkulYeniKayitTetikle(); return; }

            const hedef = liste[state.index];

            // Onaylı value'ları direk kullan — dropdown aramasına gerek yok
            let dersBulundu = false, ogrBulundu = false;

            for (let opt of ddlDers.options) {
                if (opt.value === hedef.dersValue) {
                    opt.selected = true; ddlDers.selectedIndex = opt.index; ddlDers.value = opt.value;
                    ddlDers.dispatchEvent(new Event('change', { bubbles: true }));
                    dersBulundu = true; break;
                }
            }
            // value tam eşleşmezse fuzzy fallback
            if (!dersBulundu) {
                const hDers = norm(hedef.dersText || hedef.pdfDers);
                for (let opt of ddlDers.options) {
                    const oDers = norm(opt.text);
                    if (oDers.length > 3 && (oDers.includes(hDers) || hDers.includes(oDers))) {
                        opt.selected = true; ddlDers.selectedIndex = opt.index; ddlDers.value = opt.value;
                        ddlDers.dispatchEvent(new Event('change', { bubbles: true }));
                        dersBulundu = true; break;
                    }
                }
            }

            for (let opt of ddlOgr.options) {
                if (opt.value === hedef.ogrValue) {
                    opt.selected = true; ddlOgr.selectedIndex = opt.index; ddlOgr.value = opt.value;
                    ddlOgr.dispatchEvent(new Event('change', { bubbles: true }));
                    ogrBulundu = true; break;
                }
            }
            if (!ogrBulundu) {
                const hOgr = norm(hedef.ogrText || hedef.pdfOgr);
                for (let opt of ddlOgr.options) {
                    const oOgr = norm(opt.text);
                    if (oOgr.length > 3 && (oOgr.includes(hOgr) || hOgr.includes(oOgr))) {
                        opt.selected = true; ddlOgr.selectedIndex = opt.index; ddlOgr.value = opt.value;
                        ddlOgr.dispatchEvent(new Event('change', { bubbles: true }));
                        ogrBulundu = true; break;
                    }
                }
            }

            if (!dersBulundu || !ogrBulundu) {
                const skip = confirm(
                    `⚠️ Onaylı eşleşme artık geçersiz (${state.index + 1}/${liste.length}):\n` +
                    `Ders: ${hedef.pdfDers}\nÖğretmen: ${hedef.pdfOgr}\n\nAtlayıp devam?`
                );
                if (skip) {
                    state.index++;
                    chrome.storage.local.set({ eokul_bot_durum: state }, () => {
                        window.location.reload();
                    });
                } else {
                    chrome.storage.local.remove('eokul_bot_durum');
                }
                return;
            }

            state.index++;
            chrome.storage.local.set({ eokul_bot_durum: state }, () => {
                setTimeout(eOkulKaydetTetikle, Math.floor(Math.random() * 400) + 1200);
            });
        });
    }


    function siradakiDersiAta() {
        chrome.storage.local.get(['eokul_bot_durum', 'eokul_pdf_veri'], function (res) {
            if (!res.eokul_bot_durum || res.eokul_bot_durum.islem !== 'OGRETMEN_ATA') return;
            const state = res.eokul_bot_durum;
            const veri  = res.eokul_pdf_veri;

            if (!veri || !veri.dersOgretmen) {
                alert('Hata: PDF verisi bulunamadı. Lütfen önce PDF analiz edin.');
                chrome.storage.local.remove('eokul_bot_durum');
                return;
            }

            const liste = veri.dersOgretmen[state.sube];

            if (!liste || state.index >= liste.length) {
                alert(`🎉 ${state.sube} şubesinin tüm (${liste ? liste.length : 0}) öğretmen atamaları başarıyla tamamlandı!`);
                chrome.storage.local.remove('eokul_bot_durum');
                return;
            }

            const ddlDers = document.getElementById('ddlDersler');
            const ddlOgr  = document.getElementById('ddlOgretmen');

            if (!ddlDers || !ddlOgr) {
                setTimeout(siradakiDersiAta, 800);
                return;
            }

            if (ddlDers.disabled || ddlOgr.disabled) {
                eOkulYeniKayitTetikle();
                return;
            }

            const hedef = liste[state.index];
            let dersBulundu = false, ogrBulundu = false;

            let hDers = norm(hedef.ders);
            const upperDers = hedef.ders.toUpperCase();
            
            // Öğretmen Atama sayfasında seçmeli derslerin gerçek isimleri listelenir,
            // bu yüzden Haftalık Program sayfasındaki gibi 'SEÇMELİ DERS' genellemesi YAPILMAMALIDIR.
            if (upperDers.includes('REHBERLİK')) {
                hDers = norm('REHBERLİK');
            } else if (upperDers.includes('DİN KÜLTÜRÜ')) {
                hDers = norm('DİN KÜLT');
            }

            // DERS İÇİN TAM EŞLEŞME
            for (let opt of ddlDers.options) {
                const oDers = norm(opt.text);
                if (oDers === hDers) {
                    opt.selected = true; ddlDers.selectedIndex = opt.index; ddlDers.value = opt.value;
                    ddlDers.dispatchEvent(new Event('change', { bubbles: true }));
                    dersBulundu = true; break;
                }
            }
            // DERS İÇİN KISMİ EŞLEŞME
            if (!dersBulundu) {
                for (let opt of ddlDers.options) {
                    const oDers = norm(opt.text);
                    if (oDers.length > 3 && (oDers.includes(hDers) || hDers.includes(oDers))) {
                        opt.selected = true; ddlDers.selectedIndex = opt.index; ddlDers.value = opt.value;
                        ddlDers.dispatchEvent(new Event('change', { bubbles: true }));
                        dersBulundu = true; break;
                    }
                }
            }

            const hOgr = norm(hedef.ogr);
            // ÖĞRETMEN İÇİN TAM EŞLEŞME
            for (let opt of ddlOgr.options) {
                const oOgr = norm(opt.text);
                if (oOgr === hOgr) {
                    opt.selected = true; ddlOgr.selectedIndex = opt.index; ddlOgr.value = opt.value;
                    ddlOgr.dispatchEvent(new Event('change', { bubbles: true }));
                    ogrBulundu = true; break;
                }
            }
            // ÖĞRETMEN İÇİN KISMİ EŞLEŞME
            if (!ogrBulundu) {
                for (let opt of ddlOgr.options) {
                    const oOgr = norm(opt.text);
                    if (oOgr.length > 3 && (oOgr.includes(hOgr) || hOgr.includes(oOgr))) {
                        opt.selected = true; ddlOgr.selectedIndex = opt.index; ddlOgr.value = opt.value;
                        ddlOgr.dispatchEvent(new Event('change', { bubbles: true }));
                        ogrBulundu = true; break;
                    }
                }
            }

            if (!dersBulundu || !ogrBulundu) {
                const skip = confirm(
                    `⚠️ Eşleştirilemedi (${state.index + 1}/${liste.length}):\n\n` +
                    `Ders: ${hedef.ders}\nÖğretmen: ${hedef.ogr}\n\n` +
                    `Bu kaydı atlayıp devam etmek ister misiniz?\n` +
                    `(İptal = işlemi durdur)`
                );
                if (skip) {
                    state.index++;
                    chrome.storage.local.set({ eokul_bot_durum: state }, () => {
                        window.location.reload();
                    });
                } else {
                    chrome.storage.local.remove('eokul_bot_durum');
                }
                return;
            }

            state.index++;
            chrome.storage.local.set({ eokul_bot_durum: state }, () => {
                const delay = Math.floor(Math.random() * 400) + 1200;
                setTimeout(eOkulKaydetTetikle, delay);
            });
        });
    }

    // ============================================================
    // 5) HAFTALIK TABLO DOLDURMA MOTORU
    // ============================================================

    function haftalikProgramiDoldur(sube, callback) {
        chrome.storage.local.get(['eokul_pdf_veri'], function (res) {
            const veri = res.eokul_pdf_veri;
            if (!veri || !veri.haftalikProg) {
                if (callback) callback({hata: 'PDF verisi bulunamadı. Lütfen önce PDF analiz edin.'});
                return;
            }

            const prog = veri.haftalikProg[sube];
            if (!prog) {
                if (callback) callback({hata: `"${sube}" şubesinin haftalık programı PDF'te bulunamadı.`});
                return;
            }

            let sayac = 0;
            let bulunamayanlar = [];
            const gunler = ['Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma'];

            gunler.forEach(gun => {
                const dersler = prog[gun] || [];
                dersler.forEach((dersAdi, index) => {
                    if (!dersAdi) return;
                    const el = document.getElementById(`dgListe_ddlDersAdi${gun}_${index}`);
                    if (!el) return;

                    let aranan = norm(dersAdi);
                    // Özel durumlar: Seçmeli dersler ve Rehberlik ve Din Kültürü
                    const upperDers = dersAdi.toUpperCase();
                    if (upperDers.startsWith('SEÇMELİ')) {
                        aranan = norm('SEÇMELİ DERS');
                    } else if (upperDers.includes('REHBERLİK')) {
                        aranan = norm('REHBERLİK');
                    } else if (upperDers.includes('DİN KÜLTÜRÜ')) {
                        aranan = norm('DİN KÜLT'); // E-Okul'da "DİN KÜLT. VE AHL.BİL." olarak kısaltılıyor
                    }

                    let bulundu = false;

                    // 1. AŞAMA: ÖNCE TAM EŞLEŞME ARA (Örn: "MESLEKİ MATEMATİK" ile tam eşleşen)
                    for (let opt of el.options) {
                        const optNorm = norm(opt.text);
                        if (optNorm === aranan) {
                            el.value = opt.value;
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            sayac++;
                            bulundu = true;
                            break;
                        }
                    }

                    // 2. AŞAMA: EĞER TAM EŞLEŞME YOKSA KISMİ EŞLEŞME ARA (Örn: "MATEMATİK")
                    if (!bulundu) {
                        for (let opt of el.options) {
                            const optNorm = norm(opt.text);
                            // Sadece yeterince uzun metinlerde kısmi eşleşme yap
                            if (optNorm.length > 3 && (optNorm.includes(aranan) || aranan.includes(optNorm))) {
                                el.value = opt.value;
                                el.dispatchEvent(new Event('change', { bubbles: true }));
                                sayac++;
                                bulundu = true;
                                break;
                            }
                        }
                    }

                    if (!bulundu) {
                        bulunamayanlar.push(`${gun} ${index+1}.Saat: ${dersAdi}`);
                    }
                });
            });

            if (callback) callback({sayac, bulunamayanlar});
        });
    }

    // ============================================================
    // 6) EK DERS VE SEÇMELİ DERS TABLOSU DOLDURMA MOTORU
    // ============================================================

    function ekDersTablosunuDoldur(sube) {
        chrome.storage.local.get(['eokul_pdf_veri'], function (res) {
            const veri = res.eokul_pdf_veri;
            if (!veri || !veri.dersOgretmen || !veri.dersOgretmen[sube]) {
                alert('Hata: PDF verisi bulunamadı. Lütfen önce PDF analiz edin.');
                return;
            }

            const atamalar = veri.dersOgretmen[sube];
            const program  = veri.haftalikProg && veri.haftalikProg[sube]; // Meslek gruplarında bu null olabilir

            let sayac = 0;
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');

            checkboxes.forEach(chk => {
                // ── Adım 1: ID'den gün ve saat al ──────────────────────
                const idMatch = chk.id.match(/chk([A-Za-z]+)Secim_(\d+)/i);
                if (!idMatch) return;

                const gunAbbr  = idMatch[1].toLowerCase();
                const rowIndex = parseInt(idMatch[2], 10);

                let gunKey = null;
                if      (gunAbbr.includes('pzt') || gunAbbr.includes('paz')) gunKey = 'Pazartesi';
                else if (gunAbbr.includes('sal'))  gunKey = 'Sali';
                else if (gunAbbr.includes('car'))  gunKey = 'Carsamba';
                else if (gunAbbr.includes('per'))  gunKey = 'Persembe';
                else if (gunAbbr.includes('cum'))  gunKey = 'Cuma';

                if (!gunKey) return;

                // ── Adım 2: Label metnini ayrıştır ──────────────────────
                const lbl = document.querySelector(`label[for="${chk.id}"]`);
                if (!lbl) return;

                const text    = lbl.textContent.trim();
                const dashIdx = text.indexOf('-');
                if (dashIdx < 0) return;

                const lblOgr  = norm(text.substring(0, dashIdx));
                const lblDers = norm(text.substring(dashIdx + 1).replace(/\(\d+\)\s*$/, ''));

                // ── Adım 3: PDF Programında bu gün ve saatte hangi ders var? ──
                if (!program || !program[gunKey]) return; // Programı olmayan şubede kontrol yapılamaz

                const hedefNorm = norm(program[gunKey][rowIndex] || '');
                if (!hedefNorm) return; // Bu saatte (rowIndex) PDF'e göre ders yok, atla
                
                // Eğer checkbox'taki ders (lblDers), PDF'in bu saatindeki dersle (hedefNorm) eşleşmiyorsa atla
                if (lblDers !== hedefNorm && !lblDers.includes(hedefNorm) && !hedefNorm.includes(lblDers)) return;

                // ── Adım 4: Atama listesinde bu öğretmen-ders çifti var mı? ──
                let matchFound = false;
                
                for (const atama of atamalar) {
                    let hDers = norm(atama.ders);
                    const upperDers = atama.ders.toUpperCase();
                    if (upperDers.includes('DİN KÜLTÜRÜ')) hDers = norm('DİN KÜLT');
                    else if (upperDers.includes('REHBERLİK')) hDers = norm('REHBERLİK');

                    const hOgr = norm(atama.ogr);

                    const dersUyar = (lblDers === hDers) || (lblDers.length > 3 && (lblDers.includes(hDers) || hDers.includes(lblDers)));
                    const ogrUyar  = (lblOgr  === hOgr)  || (lblOgr.length  > 3 && (lblOgr.includes(hOgr)  || hOgr.includes(lblOgr)));

                    if (dersUyar && ogrUyar) {
                        matchFound = true;
                        break;
                    }
                }

                if (matchFound && !chk.checked) {
                    chk.checked = true;
                    sayac++;
                    chk.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            alert(`✅ Ek Ders Tablosu Dolduruldu!\n\n${sube} şubesi için ${sayac} adet onay kutusu işaretlendi.\nLütfen kontrol edip Kaydet'e basabilirsiniz.`);
        });
    }


    // ============================================================
    // 7) MESAJ DİNLEYİCİSİ
    // ============================================================


    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {

        // ── PDF Parse İsteği (Artık hazır veri geliyor) ───────────
        if (req.islem === 'PDF_VERISI_KAYDET') {
            chrome.storage.local.set({ eokul_pdf_veri: req.veri }, () => {
                sendResponse({ basarili: true });
            });
            return true;
        }

        // ── Eşleştirme Doğrulama ───────────────────────────────────
        if (req.islem === 'DOGRULA_ESLESME') {
            const sube = req.seciliSube || aktifSubeyiBul();
            if (!sube) {
                alert('Lütfen e-Okul sayfasından bir şube seçin veya eklenti menüsünden uygulayacağınız şubeyi manuel seçin.');
                return;
            }
            chrome.storage.local.get(['eokul_pdf_veri'], (res) => {
                if (!res.eokul_pdf_veri || !res.eokul_pdf_veri.dersOgretmen?.[sube]) {
                    alert(`"${sube}" şubesi için PDF verisi yok.\nÖnce popup'tan PDF analiz edin.`);
                    return;
                }
                const plan = eslesmePlaniHazirla(sube, res.eokul_pdf_veri);
                if (!plan) {
                    alert('Ders/Öğretmen dropdown’ları bulunamadı.\nListe sayfasında olduğunuzdan emin olun.');
                    return;
                }
                dogrulamaModaliniGoster(sube, plan);
            });
        }

        // ── Öğretmen Atama ────────────────────────────────────────
        if (req.islem === 'OGRETMEN_ATA') {
            const sube = req.seciliSube || aktifSubeyiBul();
            if (!sube) {
                alert('Lütfen e-Okul sayfasından bir şube seçin veya eklenti menüsünden uygulayacağınız şubeyi manuel seçin.');
                return;
            }
            chrome.storage.local.get(['eokul_pdf_veri', 'eokul_bot_durum'], (res) => {
                if (!res.eokul_pdf_veri || !res.eokul_pdf_veri.dersOgretmen[sube]) {
                    alert(`"${sube}" şubesi için PDF verisi yok.\nÖnce popup'tan PDF analiz edin.`);
                    return;
                }
                const liste = res.eokul_pdf_veri.dersOgretmen[sube];

                let baslangicIndex = 0;
                if (res.eokul_bot_durum && res.eokul_bot_durum.islem === 'OGRETMEN_ATA' && res.eokul_bot_durum.sube === sube) {
                    const eskiIndex = res.eokul_bot_durum.index;
                    if (eskiIndex > 0 && eskiIndex < liste.length) {
                        const devam = confirm(`Bu şube için daha önce atama yapılmış ve ${eskiIndex}. kayıtta kalınmış.\n\nKaldığınız yerden devam etmek ister misiniz?\n(İptal derseniz baştan başlar)`);
                        if (devam) {
                            baslangicIndex = eskiIndex;
                        }
                    }
                }

                if (confirm(`${sube} şubesi için ${liste.length - baslangicIndex} atama yapılacak.\nOnaylıyor musunuz?`)) {
                    chrome.storage.local.set({
                        eokul_bot_durum: { aktif: true, islem: 'OGRETMEN_ATA', sube, index: baslangicIndex }
                    }, () => {
                        window.location.reload();
                    });
                }
            });
        }

        // ── Haftalık Tablo Doldurma ───────────────────────────────
        else if (req.islem === 'HAFTALIK_DOLDUR') {
            const sube = req.seciliSube || aktifSubeyiBul();
            if (!sube) {
                sendResponse({ hata: 'Lütfen e-Okul sayfasından bir şube seçin veya eklenti menüsünden uygulayacağınız şubeyi manuel seçin.' });
                return;
            }
            haftalikProgramiDoldur(sube, (sonuc) => {
                sendResponse(sonuc);
            });
            return true; // Asenkron yanıt için
        }

        // ── Ek Ders (Seçmeli/Ortak) Doldurma ────────────────────────
        else if (req.islem === 'EK_DERS_DOLDUR') {
            const sube = req.seciliSube || aktifSubeyiBul();
            if (!sube) {
                alert('Lütfen e-Okul sayfasından bir şube seçin veya eklenti menüsünden uygulayacağınız şubeyi manuel seçin.');
                return;
            }
            ekDersTablosunuDoldur(sube);
        }


        // ── Aktif Şube Doğrulama ──────────────────────────────────
        else if (req.islem === 'AKTIF_SUBE_DOGRULA') {
            const aktif = aktifSubeyiBul();
            if (aktif) {
                sendResponse({ uyusuyor: (aktif === req.beklenenSube), aktif: aktif });
            } else {
                sendResponse({ uyusuyor: false, aktif: 'Bulunamadı' });
            }
        }
        // ── Durdur ────────────────────────────────────────────────
        else if (req.islem === 'DURDUR') {
            chrome.storage.local.remove('eokul_bot_durum');
            alert('Bot döngüsü durduruldu ve hafıza sıfırlandı.');
        }
    });

    // ============================================================
    // 8) SAYFA YENİLENME SONRASI DEVAM
    // ============================================================

    window.addEventListener('load', () => {
        chrome.storage.local.get(['eokul_bot_durum'], function (res) {
            if (!res.eokul_bot_durum || !res.eokul_bot_durum.aktif) return;
            const islem = res.eokul_bot_durum.islem;
            if (islem === 'OGRETMEN_ATA') {
                setTimeout(siradakiDersiAta, 600);
            } else if (islem === 'OGRETMEN_ATA_ONAYLANMIS') {
                setTimeout(siradakiDersiAtaOnaylanmis, 600);
            }
        });
    });

