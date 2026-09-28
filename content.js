(function () {
    'use strict';

    // ============================================================
    // 1) YARDIMCI FONKSİYONLAR
    // ============================================================


    const escHtml = (s) => (s || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');



    function enIyiEslesmeyiBul(aranan, secenekler, minSkor = 30) {
        let enIyi = null, enYuksekSkor = 0;
        for (const opt of secenekler) {
            if (!opt.value) continue;
            const skor = benzerlikSkoru(aranan, opt.text);
            if (skor > enYuksekSkor) {
                enYuksekSkor = skor;
                enIyi = { value: opt.value, text: opt.text, skor };
            }
        }
        return enYuksekSkor >= minSkor ? enIyi : null;
    }

    /**
     * Dropdown'da 3 aşamalı eşleştirme:
     * 1. Tam value, 2. Tam norm metin, 3. Kısmi (substring) metin
     */
    function eslestirDropdown(ddl, hedefValue, hedefNorm) {
        if (hedefValue) {
            for (const opt of ddl.options) {
                if (opt.value === hedefValue) {
                    opt.selected = true; ddl.selectedIndex = opt.index; ddl.value = opt.value;
                    ddl.dispatchEvent(new Event('change', { bubbles: true })); return true;
                }
            }
        }
        
        let enIyiOpt = null;
        let enYuksekSkor = 0;

        for (const opt of ddl.options) {
            if (!opt.value) continue;
            
            if (norm(opt.text) === hedefNorm) {
                opt.selected = true; ddl.selectedIndex = opt.index; ddl.value = opt.value;
                ddl.dispatchEvent(new Event('change', { bubbles: true })); return true;
            }
            
            const skor = benzerlikSkoru(hedefNorm, opt.text);
            if (skor > enYuksekSkor) {
                enYuksekSkor = skor;
                enIyiOpt = opt;
            }
        }

        if (enIyiOpt && enYuksekSkor >= 40) {
            enIyiOpt.selected = true; ddl.selectedIndex = enIyiOpt.index; ddl.value = enIyiOpt.value;
            ddl.dispatchEvent(new Event('change', { bubbles: true })); return true;
        }

        return false;
    }

    function eOkulYeniKayitTetikle() {
        let btn = document.querySelector(
            '#OOMToolbarActive1_yeni_b, a[title*="Yeni"], img[src*="yeni.jpg"], input[src*="yeni.jpg"], img[alt="Yeni Kayıt"]'
        );
        if (btn) {
            if (btn.tagName === 'IMG' && btn.parentElement &&
                (btn.parentElement.tagName === 'A' || btn.parentElement.tagName === 'BUTTON')) {
                btn = btn.parentElement;
            }
            btn.click(); return true;
        }
        console.error('[e-Okul Asistanı] Yeni Kayıt butonu bulunamadı. Doğru sayfada mısınız?');
        return false;
    }

    function eOkulKaydetTetikle() {
        let btn = document.querySelector(
            '#OOMToolbarActive1_kaydet_b, a[title*="Kaydet"], img[src*="save.jpg"], input[src*="save.jpg"]'
        );
        if (btn) {
            if (btn.tagName === 'IMG' && btn.parentElement &&
                (btn.parentElement.tagName === 'A' || btn.parentElement.tagName === 'BUTTON')) {
                btn = btn.parentElement;
            }
            btn.click();
        } else {
            console.error('[e-Okul Asistanı] Kaydet butonu bulunamadı, döngü ilerleyemiyor.');
        }
    }

    // ============================================================
    // 2) AKTİF ŞUBE TESPİTİ
    // ============================================================

    /**
     * Desteklenen formatlar:
     *   "AMP - 9. Sınıf / A Şubesi (BİL)" → AMP_9A
     *   "9. Sınıf / A Şubesi"              → GENEL_9A (genel lise desteği)
     */
    function aktifSubeyiBul() {
        const sel = document.querySelector("select[name*='Sube'], select[id*='Sube'], select[id*='sube']");
        const t = sel ? sel.options[sel.selectedIndex]?.text : '';
        if (!t) return null;
        if (/\(-\)|\(- \)|\( - \)/.test(t)) return null;

        const sinifMatch = t.match(/(\d+)[\.\s]*Sınıf/i);
        if (!sinifMatch) return null;
        const sinifNo = sinifMatch[1];

        const subeMatch = t.match(/\/\s*([A-ZÇĞİÖŞÜ]+)\s*Şubesi/i);
        if (!subeMatch) return null;
        const subeKod = subeMatch[1].toUpperCase();

        const turMatch = t.match(/\b(ATP|AMP)\b/i);
        const tur = turMatch ? turMatch[1].toUpperCase() : 'GENEL';

        return { anahtar: `${tur}_${sinifNo}${subeKod}`, sinifSube: `${sinifNo}${subeKod}`, tur, sinifNo, subeKod };
    }

    function subeAnahtariBul(subeInfo, pdfVeri) {
        if (!subeInfo || !pdfVeri) return null;
        const veriSeti = pdfVeri.dersOgretmen || pdfVeri.haftalikProg || {};

        if (veriSeti[subeInfo.anahtar]) return subeInfo.anahtar;

        const hedef = subeInfo.sinifSube;
        const eslesen = Object.keys(veriSeti).filter(k => k.endsWith(`_${hedef}`) && !k.includes('_GRUP'));
        if (eslesen.length === 1) return eslesen[0];
        if (eslesen.length > 1) {
            return eslesen.find(k => k.startsWith(subeInfo.tur + '_')) || eslesen[0];
        }

        // GRUP dahil son çare
        const tumEslesen = Object.keys(veriSeti).filter(k => k.endsWith(`_${hedef}`));
        return tumEslesen.length >= 1 ? tumEslesen[0] : null;
    }

    function subeInfoOlustur(seciliSube) {
        if (!seciliSube) return aktifSubeyiBul();
        return { anahtar: seciliSube, sinifSube: seciliSube.replace(/^\w+_/, ''), tur: seciliSube.split('_')[0] };
    }

    // ============================================================
    // 3) EŞLEŞTİRME DOĞRULAMA MOTORU
    // ============================================================

    function eslesmePlaniHazirla(sube, pdfVeri) {
        const ddlDers = document.getElementById('ddlDersler');
        const ddlOgr  = document.getElementById('ddlOgretmen');
        if (!ddlDers || !ddlOgr) return null;

        const dersSecenekler = Array.from(ddlDers.options);
        const ogrSecenekler  = Array.from(ddlOgr.options);
        const liste = pdfVeri.dersOgretmen[sube] || [];

        return liste.map(atama => {
            const dersEsleme = enIyiEslesmeyiBul(atama.ders, dersSecenekler);
            const ogrEsleme  = enIyiEslesmeyiBul(atama.ogr,  ogrSecenekler);
            const minSkor    = Math.min(dersEsleme?.skor || 0, ogrEsleme?.skor || 0);
            return {
                pdfDers:        atama.ders,
                pdfOgr:         atama.ogr,
                dersEsleme:     dersEsleme || { value: '', text: '—', skor: 0 },
                ogrEsleme:      ogrEsleme  || { value: '', text: '—', skor: 0 },
                durum:          minSkor >= 85 ? 'iyi' : minSkor >= 50 ? 'belirsiz' : 'hata',
                dersSecenekler: dersSecenekler.map(o => ({ value: o.value, text: o.text })),
                ogrSecenekler:  ogrSecenekler.map(o => ({ value: o.value, text: o.text })),
            };
        });
    }

    function dogrulamaModaliniGoster(sube, plan) {
        const eskiModal = document.getElementById('eokul-asistan-modal');
        if (eskiModal) eskiModal.remove();

        const iyi      = plan.filter(p => p.durum === 'iyi').length;
        const belirsiz = plan.filter(p => p.durum === 'belirsiz').length;
        const hata     = plan.filter(p => p.durum === 'hata').length;

        const satirlar = plan.map((p, i) => {
            const renk = p.durum === 'iyi' ? '#276749' : p.durum === 'belirsiz' ? '#744210' : '#742a2a';
            const ikon = p.durum === 'iyi' ? '✅' : p.durum === 'belirsiz' ? '⚠️' : '❌';
            const dersOpts = p.dersSecenekler.map(o =>
                `<option value="${escHtml(o.value)}" ${o.value === p.dersEsleme.value ? 'selected' : ''}>${escHtml(o.text)}</option>`
            ).join('');
            const ogrOpts = p.ogrSecenekler.map(o =>
                `<option value="${escHtml(o.value)}" ${o.value === p.ogrEsleme.value ? 'selected' : ''}>${escHtml(o.text)}</option>`
            ).join('');
            return `<tr style="border-bottom:1px solid #1e2535;background:${renk}22">
              <td style="padding:6px 8px;font-size:11px;color:#a0aec0;white-space:nowrap">
                ${ikon} <span style="color:#e2e8f0;font-weight:600">${escHtml(p.pdfDers)}</span><br>
                <span style="font-size:10px;color:#718096">${escHtml(p.pdfOgr)}</span>
              </td>
              <td style="padding:6px 8px">
                <select data-idx="${i}" data-tip="ders" style="width:100%;background:#141824;border:1px solid #2d3748;color:#e2e8f0;border-radius:5px;padding:3px 5px;font-size:10px">${dersOpts}</select>
                <div style="font-size:9px;color:${p.dersEsleme.skor>=85?'#68d391':p.dersEsleme.skor>=50?'#f6ad55':'#fc8181'};margin-top:2px">Uyum: ${p.dersEsleme.skor}%</div>
              </td>
              <td style="padding:6px 8px">
                <select data-idx="${i}" data-tip="ogr" style="width:100%;background:#141824;border:1px solid #2d3748;color:#e2e8f0;border-radius:5px;padding:3px 5px;font-size:10px">${ogrOpts}</select>
                <div style="font-size:9px;color:${p.ogrEsleme.skor>=85?'#68d391':p.ogrEsleme.skor>=50?'#f6ad55':'#fc8181'};margin-top:2px">Uyum: ${p.ogrEsleme.skor}%</div>
              </td></tr>`;
        }).join('');

        document.body.insertAdjacentHTML('beforeend', `
        <div id="eokul-asistan-modal" style="position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.85);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;font-family:'Segoe UI',sans-serif;">
          <div style="background:#0f1117;border:1px solid #2d3748;border-radius:14px;width:100%;max-width:900px;box-shadow:0 25px 60px rgba(0,0,0,0.8);">
            <div style="padding:18px 22px;border-bottom:1px solid #1e2535;display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:16px;font-weight:700;color:#63b3ed">🔗 Eşleştirme Doğrulama — ${escHtml(sube)}</div>
                <div style="font-size:11px;color:#718096;margin-top:4px">PDF verisi ↔ e-Okul dropdown eşleştirmesi. Kırmızı/sarı satırları kontrol edin.</div>
              </div>
              <button onclick="document.getElementById('eokul-asistan-modal').remove()" style="background:#742a2a;border:none;color:#feb2b2;border-radius:7px;padding:7px 12px;cursor:pointer;font-size:12px;font-weight:600">✕ Kapat</button>
            </div>
            <div style="padding:12px 22px;display:flex;gap:12px;border-bottom:1px solid #1e2535">
              <span style="background:#276749;color:#9ae6b4;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600">✅ Otomatik: ${iyi}</span>
              <span style="background:#744210;color:#fbd38d;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600">⚠️ Belirsiz: ${belirsiz}</span>
              <span style="background:#742a2a;color:#feb2b2;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600">❌ Eşleşmedi: ${hata}</span>
              <span style="color:#718096;font-size:11px;margin-left:auto">Toplam: ${plan.length} atama</span>
            </div>
            <div style="padding:16px 22px;max-height:60vh;overflow-y:auto">
              <table style="width:100%;border-collapse:collapse">
                <thead><tr style="border-bottom:1px solid #2d3748">
                  <th style="text-align:left;padding:6px 8px;font-size:10px;color:#4a5568;text-transform:uppercase;letter-spacing:1px;width:30%">PDF Verisi</th>
                  <th style="text-align:left;padding:6px 8px;font-size:10px;color:#4a5568;text-transform:uppercase;letter-spacing:1px;width:35%">e-Okul Dersi</th>
                  <th style="text-align:left;padding:6px 8px;font-size:10px;color:#4a5568;text-transform:uppercase;letter-spacing:1px;width:35%">e-Okul Öğretmeni</th>
                </tr></thead>
                <tbody id="eokul-esleme-tbody">${satirlar}</tbody>
              </table>
            </div>
            <div style="padding:16px 22px;border-top:1px solid #1e2535;display:flex;gap:10px;justify-content:flex-end">
              <button onclick="document.getElementById('eokul-asistan-modal').remove()" style="background:#1e2535;border:1px solid #2d3748;color:#a0aec0;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:12px">İptal</button>
              <button id="eokul-onayla-btn" style="background:linear-gradient(135deg,#276749,#22543d);border:1px solid #2f855a;color:#9ae6b4;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">✅ Onayla &amp; Öğretmenleri Ata</button>
            </div>
          </div>
        </div>`);

        document.getElementById('eokul-onayla-btn').addEventListener('click', () => {
            const tbody         = document.getElementById('eokul-esleme-tbody');
            const dersSelectler = tbody.querySelectorAll('select[data-tip="ders"]');
            const ogrSelectler  = tbody.querySelectorAll('select[data-tip="ogr"]');

            const onayliHarita = plan.map((p, i) => ({
                pdfDers:   p.pdfDers,  pdfOgr:    p.pdfOgr,
                dersValue: dersSelectler[i].value,
                dersText:  dersSelectler[i].options[dersSelectler[i].selectedIndex]?.text || '',
                ogrValue:  ogrSelectler[i].value,
                ogrText:   ogrSelectler[i].options[ogrSelectler[i].selectedIndex]?.text || '',
            })).filter(p => p.dersValue && p.ogrValue);

            if (onayliHarita.length === 0) { alert('Hiçbir geçerli eşleştirme yok. Lütfen kontrol edin.'); return; }
            document.getElementById('eokul-asistan-modal').remove();

            // Mevcut haritayı al ve merge et — diğer şubelerin verileri korunur
            chrome.storage.local.get(['eokul_onay_harita'], (res) => {
                const mevcutHarita = res.eokul_onay_harita || {};
                mevcutHarita[sube] = onayliHarita;
                chrome.storage.local.set({
                    eokul_onay_harita: mevcutHarita,
                    eokul_bot_durum: { aktif: true, islem: 'OGRETMEN_ATA_ONAYLANMIS', sube, index: 0, deneme: 0 }
                }, () => siradakiDersiAtaOnaylanmis());
            });
        });
    }

    // ============================================================
    // 4) ÖĞRETMEN ATAMA MOTORU (ONAYLANMIŞ HARİTA)
    // ============================================================

    function siradakiDersiAtaOnaylanmis() {
        chrome.storage.local.get(['eokul_bot_durum', 'eokul_onay_harita'], function (res) {
            if (!res.eokul_bot_durum || res.eokul_bot_durum.islem !== 'OGRETMEN_ATA_ONAYLANMIS') return;
            const state  = res.eokul_bot_durum;
            const liste  = res.eokul_onay_harita?.[state.sube];

            if (!liste || state.index >= liste.length) {
                alert(`🎉 ${state.sube} şubesinin tüm (${liste?.length || 0}) öğretmen atamaları tamamlandı!`);
                chrome.storage.local.remove('eokul_bot_durum'); return;
            }

            const ddlDers = document.getElementById('ddlDersler');
            const ddlOgr  = document.getElementById('ddlOgretmen');
            if (!ddlDers || !ddlOgr) { setTimeout(siradakiDersiAtaOnaylanmis, 800); return; }

            if (ddlDers.disabled || ddlOgr.disabled) {
                const bulundu = eOkulYeniKayitTetikle();
                if (!bulundu) {
                    state.deneme = (state.deneme || 0) + 1;
                    if (state.deneme >= 5) {
                        alert('⚠️ Bot 5 kez takıldı. İşlem durduruldu. Doğru sayfada olduğunuzdan emin olun.');
                        chrome.storage.local.remove('eokul_bot_durum'); return;
                    }
                    chrome.storage.local.set({ eokul_bot_durum: state }, () => setTimeout(siradakiDersiAtaOnaylanmis, 2000));
                }
                return;
            }

            state.deneme = 0;
            const hedef       = liste[state.index];
            const dersBulundu = eslestirDropdown(ddlDers, hedef.dersValue, norm(hedef.dersText || hedef.pdfDers));
            const ogrBulundu  = eslestirDropdown(ddlOgr,  hedef.ogrValue,  norm(hedef.ogrText  || hedef.pdfOgr));

            if (!dersBulundu || !ogrBulundu) {
                const skip = confirm(`⚠️ Onaylı eşleşme artık geçersiz (${state.index + 1}/${liste.length}):\nDers: ${hedef.pdfDers}\nÖğretmen: ${hedef.pdfOgr}\n\nAtlayıp devam?`);
                if (skip) { state.index++; chrome.storage.local.set({ eokul_bot_durum: state }, () => window.location.reload()); }
                else { chrome.storage.local.remove('eokul_bot_durum'); }
                return;
            }

            state.index++;
            chrome.storage.local.set({ eokul_bot_durum: state }, () => {
                setTimeout(eOkulKaydetTetikle, Math.floor(Math.random() * 400) + 1200);
            });
        });
    }

    // ============================================================
    // 5) ÖĞRETMEN ATAMA MOTORU (OTOMATİK — ONAYSIZ)
    // ============================================================

    function siradakiDersiAta() {
        chrome.storage.local.get(['eokul_bot_durum', 'eokul_pdf_veri'], function (res) {
            if (!res.eokul_bot_durum || res.eokul_bot_durum.islem !== 'OGRETMEN_ATA') return;
            const state = res.eokul_bot_durum;
            const veri  = res.eokul_pdf_veri;

            if (!veri || !veri.dersOgretmen) {
                alert('Hata: PDF verisi bulunamadı. Lütfen önce PDF analiz edin.');
                chrome.storage.local.remove('eokul_bot_durum'); return;
            }

            const liste = veri.dersOgretmen[state.sube];
            if (!liste || state.index >= liste.length) {
                alert(`🎉 ${state.sube} şubesinin tüm (${liste ? liste.length : 0}) öğretmen atamaları başarıyla tamamlandı!`);
                chrome.storage.local.remove('eokul_bot_durum'); return;
            }

            const ddlDers = document.getElementById('ddlDersler');
            const ddlOgr  = document.getElementById('ddlOgretmen');
            if (!ddlDers || !ddlOgr) { setTimeout(siradakiDersiAta, 800); return; }

            if (ddlDers.disabled || ddlOgr.disabled) {
                const bulundu = eOkulYeniKayitTetikle();
                if (!bulundu) {
                    state.deneme = (state.deneme || 0) + 1;
                    if (state.deneme >= 5) {
                        alert('⚠️ Bot 5 kez takıldı. İşlem durduruldu. Doğru sayfada olduğunuzdan emin olun.');
                        chrome.storage.local.remove('eokul_bot_durum'); return;
                    }
                    chrome.storage.local.set({ eokul_bot_durum: state }, () => setTimeout(siradakiDersiAta, 2000));
                }
                return;
            }

            state.deneme = 0;
            const hedef = liste[state.index];

            let hDers = norm(hedef.ders);
            const upperDers = hedef.ders.toUpperCase();
            if (upperDers.includes('REHBERLİK'))   { hDers = norm('REHBERLİK'); }
            else if (upperDers.includes('DİN KÜLTÜRÜ')) { hDers = norm('DİN KÜLT'); }

            const dersBulundu = eslestirDropdown(ddlDers, '', hDers);
            const ogrBulundu  = eslestirDropdown(ddlOgr,  '', norm(hedef.ogr));

            if (!dersBulundu || !ogrBulundu) {
                const skip = confirm(
                    `⚠️ Eşleştirilemedi (${state.index + 1}/${liste.length}):\n\n` +
                    `Ders: ${hedef.ders}\nÖğretmen: ${hedef.ogr}\n\n` +
                    `Bu kaydı atlayıp devam etmek ister misiniz?\n(İptal = işlemi durdur)`
                );
                if (skip) { state.index++; chrome.storage.local.set({ eokul_bot_durum: state }, () => window.location.reload()); }
                else { chrome.storage.local.remove('eokul_bot_durum'); }
                return;
            }

            state.index++;
            chrome.storage.local.set({ eokul_bot_durum: state }, () => {
                setTimeout(eOkulKaydetTetikle, Math.floor(Math.random() * 400) + 1200);
            });
        });
    }

    // ============================================================
    // 6) HAFTALIK TABLO DOLDURMA MOTORU
    // ============================================================

    function haftalikProgramiDoldur(sube) {
        chrome.storage.local.get(['eokul_pdf_veri'], function (res) {
            const veri = res.eokul_pdf_veri;
            if (!veri || !veri.haftalikProg) { alert('Hata: PDF verisi bulunamadı. Lütfen önce PDF analiz edin.'); return; }
            const prog = veri.haftalikProg[sube];
            if (!prog) { alert(`"${sube}" şubesinin haftalık programı PDF'te bulunamadı.`); return; }

            /**
             * Özel eğitim PDF'lerinde ders kodları "ÖZLTÜRKÇE11", "İŞAHL211" gibi gelir.
             * Bunlardan anlamlı anahtar kelimeler çıkarır:
             *   "ÖZLTÜRKÇE11" → ["turkce", "ozlturkce11"]
             *   "İŞAHL211"    → ["işahlhayat", "isahl211", "hayat"]
             *   "ÖZLKÜLTÜR11" → ["kultur", "sozyal"]
             */
            function ozelEgitimAlternatifleri(dersAdi) {
                const n = norm(dersAdi);
                const alts = [n];
                // Baştan ÖZL/İŞ/AHL gibi prefix'leri soy, sondan rakamları at
                const cekirdek = dersAdi.replace(/^[İÖAiöa]{2,4}/i, '').replace(/\d+$/g, '').trim();
                if (cekirdek && cekirdek !== dersAdi) alts.push(norm(cekirdek));
                // Kodun içindeki anlamlı parçaları çıkarmayı dene (TÜRKÇE, KÜLTÜR, DİN...)
                const parcalar = dersAdi.match(/[A-ZÇĞİÖŞÜ]{3,}/gi) || [];
                for (const p of parcalar) {
                    const pn = norm(p);
                    if (pn.length > 3) alts.push(pn);
                }
                return [...new Set(alts)];
            }

            let sayac = 0;
            ['Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma'].forEach(gun => {
                (prog[gun] || []).forEach((dersAdi, index) => {
                    if (!dersAdi) return;
                    const el = document.getElementById(`dgListe_ddlDersAdi${gun}_${index}`);
                    if (!el) return;

                    // -- Kural bazlı normalizasyon --
                    let arananlar = [];
                    const upperDers = dersAdi.toUpperCase();
                    if      (upperDers.startsWith('SEÇMELİ'))   arananlar = [norm('SEÇMELİ DERS')];
                    else if (upperDers.includes('REHBERLİK'))    arananlar = [norm('REHBERLİK')];
                    else if (upperDers.includes('DİN KÜLTÜRÜ')) arananlar = [norm('DİN KÜLTÜRÜ VE AHLAK'), norm('DİN KÜLT')];
                    else                                          arananlar = ozelEgitimAlternatifleri(dersAdi);

                    const opts = Array.from(el.options).filter(o => o.value);

                    // 1. Tam norm eşleşme
                    let secilen = null;
                    for (const aranan of arananlar) {
                        for (const opt of opts) {
                            if (norm(opt.text) === aranan) { secilen = opt; break; }
                        }
                        if (secilen) break;
                    }

                    // 2. En İyi Eşleşmeyi Bul (Substring veya Fuzzy)
                    if (!secilen) {
                        let enYuksek = 0;
                        for (const aranan of arananlar) {
                            for (const opt of opts) {
                                const skor = benzerlikSkoru(aranan, norm(opt.text));
                                if (skor > enYuksek && skor >= 40) { enYuksek = skor; secilen = opt; }
                            }
                        }
                    }

                    if (secilen) {
                        el.value = secilen.value;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        sayac++;
                    }
                });
            });
            alert(`✅ Tablo Dolduruldu!\n\n${sube} şubesi için ${sayac} adet ders kutucuğu seçildi.\nKontrol edip Kaydet'e basabilirsiniz.`);
        });
    }

    // ============================================================
    // 7) EK DERS VE SEÇMELİ DERS TABLOSU DOLDURMA MOTORU
    // ============================================================

    function ekDersTablosunuDoldur(sube) {
        chrome.storage.local.get(['eokul_pdf_veri'], function (res) {
            const veri = res.eokul_pdf_veri;
            if (!veri || !veri.dersOgretmen || !veri.dersOgretmen[sube]) { alert('Hata: PDF verisi bulunamadı. Lütfen önce PDF analiz edin.'); return; }

            const atamalar = veri.dersOgretmen[sube];
            const program  = veri.haftalikProg && veri.haftalikProg[sube];
            if (!program) { alert(`"${sube}" şubesinin haftalık programı bulunamadı.\nEk ders tablosu doldurulamıyor.`); return; }

            let sayac = 0;
            document.querySelectorAll('input[type="checkbox"]').forEach(chk => {
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

                const lbl = document.querySelector(`label[for="${chk.id}"]`);
                if (!lbl) return;
                const text    = lbl.textContent || lbl.innerText;
                const dashIdx = text.indexOf('-');
                if (dashIdx < 0) return;

                const lblOgr  = norm(text.substring(0, dashIdx));
                const lblDers = norm(text.substring(dashIdx + 1).replace(/\(\d+\)\s*$/, ''));

                if (!program[gunKey]) return;
                const hedefNorm = norm(program[gunKey][rowIndex] || '');
                if (!hedefNorm) return;

                // 1. Bu E-Okul kutucuğunun (checkbox) temsil ettiği en iyi Öğretmen/Ders atamasını bul
                let enIyiAtama = null;
                let enIyiAtamaSkor = 0;

                for (const atama of atamalar) {
                    let hDers = norm(atama.ders);
                    const upperDers = atama.ders.toUpperCase();
                    if      (upperDers.includes('DİN KÜLTÜRÜ'))  hDers = norm('DİN KÜLT');
                    else if (upperDers.includes('REHBERLİK'))     hDers = norm('REHBERLİK');
                    
                    const hOgr     = norm(atama.ogr);
                    const dersSkor = benzerlikSkoru(lblDers, hDers);
                    const ogrSkor  = benzerlikSkoru(lblOgr, hOgr);
                    
                    // Öğretmen ismi uyuşuyorsa (>=70) ve ders skoru en iyisiyse kaydet
                    if (ogrSkor >= 70 && dersSkor > enIyiAtamaSkor) {
                        enIyiAtamaSkor = dersSkor;
                        enIyiAtama = atama;
                    }
                }

                // 2. Eğer bu kutucuk PDF'teki bir atamaya denk geliyorsa, atamanın "Haftalık Programdaki" derse uyup uymadığını kontrol et
                if (enIyiAtama && enIyiAtamaSkor >= 40) {
                    const atamaDersNorm = norm(enIyiAtama.ders);
                    const skorTimetable = Math.max(
                        benzerlikSkoru(lblDers, hedefNorm),
                        benzerlikSkoru(atamaDersNorm, hedefNorm)
                    );
                    
                    // Haftalık programda ders adları çok kısa kısaltılabilir ("MAT", "S.TAR." gibi).
                    // Bu yüzden includes veya 35 üstü bir benzerlik yeterlidir.
                    const matchesTimetable = skorTimetable >= 35 || 
                                             lblDers.includes(hedefNorm) || 
                                             atamaDersNorm.includes(hedefNorm);

                    if (matchesTimetable && !chk.checked) {
                        chk.checked = true; sayac++;
                        chk.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            });
            alert(`✅ Ek Ders Tablosu Dolduruldu!\n${sube} şubesi için ${sayac} onay kutusu işaretlendi.`);
        });
    }

    // ============================================================
    // 8) MESAJ DİNLEYİCİSİ
    // ============================================================

    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {

        if (req.islem === 'DOGRULA_ESLESME') {
            const subeInfo = subeInfoOlustur(req.seciliSube);
            if (!subeInfo) { alert('Lütfen e-Okul sayfasından bir şube seçin.'); return; }
            chrome.storage.local.get(['eokul_pdf_veri'], (res) => {
                const pdfVeri = res.eokul_pdf_veri;
                const sube    = subeAnahtariBul(subeInfo, pdfVeri);
                if (!pdfVeri || !sube) { alert(`${subeInfo.sinifSube} şubesi PDF'te bulunamadı.`); return; }
                const plan = eslesmePlaniHazirla(sube, pdfVeri);
                if (!plan) { alert("Ders/Öğretmen dropdown'ları bulunamadı."); return; }
                dogrulamaModaliniGoster(sube, plan);
            });
        }

        else if (req.islem === 'OGRETMEN_ATA') {
            const subeInfo = subeInfoOlustur(req.seciliSube);
            if (!subeInfo) { alert('Lütfen e-Okul sayfasından bir şube seçin veya eklenti menüsünden uygulayacağınız şubeyi manuel seçin.'); return; }
            chrome.storage.local.get(['eokul_pdf_veri', 'eokul_bot_durum'], (res) => {
                const pdfVeri = res.eokul_pdf_veri;
                const sube    = subeAnahtariBul(subeInfo, pdfVeri);
                if (!pdfVeri || !sube) { alert(`"${subeInfo.anahtar}" şubesi için PDF verisi yok.\nÖnce popup'tan PDF analiz edin.\n(Yüklenen PDF'te bu şube: ${subeInfo.sinifSube})`); return; }
                const liste = pdfVeri.dersOgretmen[sube];
                let baslangicIndex = 0;
                if (res.eokul_bot_durum && res.eokul_bot_durum.islem === 'OGRETMEN_ATA' && res.eokul_bot_durum.sube === sube) {
                    const eskiIndex = res.eokul_bot_durum.index;
                    if (eskiIndex > 0 && eskiIndex < liste.length) {
                        if (confirm(`Bu şube için daha önce atama yapılmış ve ${eskiIndex}. kayıtta kalınmış.\n\nKaldığınız yerden devam etmek ister misiniz?\n(İptal derseniz baştan başlar)`)) {
                            baslangicIndex = eskiIndex;
                        }
                    }
                }
                if (confirm(`${sube} şubesi için ${liste.length - baslangicIndex} atama yapılacak.\nOnaylıyor musunuz?`)) {
                    chrome.storage.local.set({
                        eokul_bot_durum: { aktif: true, islem: 'OGRETMEN_ATA', sube, index: baslangicIndex, deneme: 0 }
                    }, () => window.location.reload());
                }
            });
        }

        else if (req.islem === 'HAFTALIK_DOLDUR') {
            const subeInfo = subeInfoOlustur(req.seciliSube);
            if (!subeInfo) { alert('Lütfen e-Okul sayfasından bir şube seçin veya eklenti menüsünden uygulayacağınız şubeyi manuel seçin.'); return; }
            chrome.storage.local.get(['eokul_pdf_veri'], (res) => {
                const sube = subeAnahtariBul(subeInfo, res.eokul_pdf_veri);
                if (!sube) { alert(`"${subeInfo.sinifSube}" şubesi PDF'te bulunamadı.\nÖnce popup'tan PDF analiz edin.`); return; }
                haftalikProgramiDoldur(sube);
            });
        }

        else if (req.islem === 'EK_DERS_DOLDUR') {
            const subeInfo = subeInfoOlustur(req.seciliSube);
            if (!subeInfo) { alert('Lütfen e-Okul sayfasından bir şube seçin veya eklenti menüsünden uygulayacağınız şubeyi manuel seçin.'); return; }
            chrome.storage.local.get(['eokul_pdf_veri'], (res) => {
                const sube = subeAnahtariBul(subeInfo, res.eokul_pdf_veri);
                if (!sube) { alert(`"${subeInfo.sinifSube}" şubesi PDF'te bulunamadı.\nÖnce popup'tan PDF analiz edin.`); return; }
                ekDersTablosunuDoldur(sube);
            });
        }

        else if (req.islem === 'DURDUR') {
            chrome.storage.local.clear(() => { alert('Bot döngüsü durduruldu ve eski yüklü veriler sıfırlandı.'); });
        }
    });

    // ============================================================
    // 9) SAYFA YENİLENME SONRASI DEVAM
    // ============================================================

    window.addEventListener('load', () => {
        chrome.storage.local.get(['eokul_bot_durum'], function (res) {
            if (!res.eokul_bot_durum || !res.eokul_bot_durum.aktif) return;
            const islem = res.eokul_bot_durum.islem;
            if (islem === 'OGRETMEN_ATA')           setTimeout(siradakiDersiAta, 600);
            else if (islem === 'OGRETMEN_ATA_ONAYLANMIS') setTimeout(siradakiDersiAtaOnaylanmis, 600);
        });
    });

})();
