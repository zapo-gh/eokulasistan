
// ============================================================
// content.js — e-Okul Ders Programı Sayfasında Çalışan Kodlar
// ============================================================

const norm = (s) => (s || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]/g, '');

// Birden çok aday ("...includes..." ile eşleşen) arasından, normalize edilmiş
// metin uzunluğu hedefe en yakın olanı seçer. Basit "ilk eşleşme" yaklaşımı
// dropdown sırasına göre yanlış (alakasız ama içeren) seçeneği kazanabiliyordu.
function enYakinSecenegiBul(hedefNorm, adaylar, metinFn) {
    let en = null, enFark = Infinity;
    for (const aday of adaylar) {
        const adayNorm = metinFn(aday);
        if (adayNorm.length <= 3) continue;
        if (adayNorm === hedefNorm) return aday; // tam eşleşme varsa hemen döndür
        if (adayNorm.includes(hedefNorm) || hedefNorm.includes(adayNorm)) {
            const fark = Math.abs(adayNorm.length - hedefNorm.length);
            if (fark < enFark) { en = aday; enFark = fark; }
        }
    }
    return en;
}

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
    // 4) ÖĞRETMEN ATAMA MOTORU
    // ============================================================

    // e-Okul'un gerçek "Kaydet" araç çubuğu resmine tıklayıp (onclick="AlanKontrolveKayit()")
    // kaydı tetikler; satır kendiliğinden boşalıp hazır hale gelince döngüyü devam ettirir.
    function eOkulKaydetTetikle() {
        const kaydetImg = document.querySelector('#OOMToolbarActive1_kaydet_b img');
        if (!kaydetImg) { setTimeout(eOkulKaydetTetikle, 500); return; }
        kaydetImg.click();
        setTimeout(siradakiDersiAta, 900);
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
                setTimeout(siradakiDersiAta, 800);
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
                const opt = enYakinSecenegiBul(hDers, Array.from(ddlDers.options), o => norm(o.text));
                if (opt) {
                    opt.selected = true; ddlDers.selectedIndex = opt.index; ddlDers.value = opt.value;
                    ddlDers.dispatchEvent(new Event('change', { bubbles: true }));
                    dersBulundu = true;
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
                const opt = enYakinSecenegiBul(hOgr, Array.from(ddlOgr.options), o => norm(o.text));
                if (opt) {
                    opt.selected = true; ddlOgr.selectedIndex = opt.index; ddlOgr.value = opt.value;
                    ddlOgr.dispatchEvent(new Event('change', { bubbles: true }));
                    ogrBulundu = true;
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
                        const opt = enYakinSecenegiBul(aranan, Array.from(el.options), o => norm(o.text));
                        if (opt) {
                            el.value = opt.value;
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            sayac++;
                            bulundu = true;
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
            }
        });
    });

