// ============================================================
// parser.js — PDF Ayrıştırma İşlemleri (Popup bağlamında çalışır)
// ============================================================

const norm = (s) => (s || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]/g, '');

async function pdfdenMetinCikar(pdfBytes) {
    // Popup context'te çalıştığımız için chrome-extension:// URL'si aynı orjindir, CSP'ye takılmaz.
    if (!window.pdfjsLib) {
        window.pdfjsLib = await import('./libs/pdf.min.mjs');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = './libs/pdf.worker.min.mjs';
    }
    const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
    let sayfalar = [];
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map(item => item.str).join(' ');
        sayfalar.push(text);
    }
    return sayfalar;
}

function subeBilgisiCikar(sayfaMetni) {
    const mBirlesi = sayfaMetni.match(/Sınıf\s*:\s*(ATP|AMP)\s*(\d{1,2})\s*([A-ZÇĞİÖŞÜ]{1,3})-([A-ZÇĞİÖŞÜ]{1,3})/i);
    if (mBirlesi) {
        const tip     = mBirlesi[1].toUpperCase();
        const sinifNo = mBirlesi[2];
        const sube1   = mBirlesi[3].toUpperCase();
        const sube2   = mBirlesi[4].toUpperCase();
        const alanMatch = sayfaMetni.match(/Sınıf\s*:\s*(?:ATP|AMP)\s*\d{1,2}\s*[A-ZÇĞİÖŞÜ]{1,3}-[A-ZÇĞİÖŞÜ]{1,3}\s+(\S+)/i);
        const alan = alanMatch ? alanMatch[1] : 'BİRLEŞİK';
        return [
            { tip, sinif: `${sinifNo}${sube1}`, alan, anahtar: `${tip}_${sinifNo}${sube1}`, birlesi: true },
            { tip, sinif: `${sinifNo}${sube2}`, alan, anahtar: `${tip}_${sinifNo}${sube2}`, birlesi: true },
        ];
    }
    const m = sayfaMetni.match(/Sınıf\s*:\s*(ATP|AMP)\s*(\d{1,2})\s*([A-ZÇĞİÖŞÜ]{1,3})\s+(\S+)/i);
    if (m) {
        return [{ tip: m[1].toUpperCase(), sinif: `${m[2]}${m[3].toUpperCase()}`, alan: m[4], anahtar: `${m[1].toUpperCase()}_${m[2]}${m[3].toUpperCase()}`, birlesi: false }];
    }
    const mOzel = sayfaMetni.match(/Sınıf\s*:\s*(\d{1,2})\s+([A-ZÇĞİÖŞÜ]+)/i);
    if (mOzel) {
        return [{ tip: 'GRUP', sinif: `${mOzel[1]} ${mOzel[2].toUpperCase()}`, alan: mOzel[2].toUpperCase(), anahtar: `GRUP_${mOzel[1]}_${mOzel[2].toUpperCase()}`, birlesi: false }];
    }
    return null;
}

function dersOgretmenTablosuCikar(sayfaMetni) {
    const tabloBaslangic = sayfaMetni.search(/Sr\s+Ders\s+Kodu/i);
    if (tabloBaslangic === -1) return [];
    let tabloMetni = sayfaMetni.substring(tabloBaslangic);
    const imzaIdx = tabloMetni.indexOf('Ahmet TÜZEL');
    if (imzaIdx !== -1) tabloMetni = tabloMetni.substring(0, imzaIdx);

    const atamalar = [];
    // Daha esnek regex: Ders Kodu 1 veya 2 kelime olabilir, ardından 1+ boşluk, ardından Ders Adı (2+ boşluk ile biter), ardından Öğretmenler.
    // Sr no. artık ayrı yakalanıyor (m[1]): "Yer/Alan-Dal" sütunundaki "OTOM 1/2" veya "LAB. 3"
    // gibi rakamlar bu deseni sağladığı için sıra dışı bir Sr no. görülürse eşleşme sahte kabul
    // edilir; ayrıca gerçek Ders Kodu değerleri hiçbir zaman rakamla başlamadığı için kod
    // grubu da harfle başlamaya zorlanır (aksi halde sıra no. tesadüfen doğru çıkabiliyor).
    const satirRegex = /\b(1[0-9]|[1-9])\s+((?:[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9\.\-]*\s)?[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9\.\-]*)\s+([A-ZÇĞİÖŞÜ\s\.]+?)\s{2,}([A-ZÇĞİÖŞÜa-zçğıöşü\s\.\-]{5,})\s+(\d{1,2})\s+/g;
    let m;
    let beklenenSira = 1;
    while ((m = satirRegex.exec(tabloMetni)) !== null) {
        if (parseInt(m[1], 10) !== beklenenSira) {
            satirRegex.lastIndex = m.index + m[1].length;
            continue;
        }
        beklenenSira++;
        const kod = m[2].trim();
        const ad = m[3].trim();
        const ogretmenlerStr = m[4].trim();
        const ogretmenler = ogretmenlerStr.split(/\s+-\s+/).map(o => o.trim()).filter(Boolean);
        for (const ogr of ogretmenler) {
            if (ogr.length < 3 || /müdür|yardımcısı/i.test(ogr)) continue;
            atamalar.push({ ders: ad, ogr });
        }
    }
    return atamalar;
}

function haftalikProgramCikar(sayfaMetni) {
    const kodAd = {};
    const tabloBaslangic = sayfaMetni.search(/Sr\s+Ders\s+Kodu/i);
    if (tabloBaslangic !== -1) {
        let tabloMetni = sayfaMetni.substring(tabloBaslangic);
        const imzaIdx = tabloMetni.indexOf('Ahmet TÜZEL');
        if (imzaIdx !== -1) tabloMetni = tabloMetni.substring(0, imzaIdx);
        // Aynı esnek regex (Sr no. sıralılık + kodın harfle başlama kontrolüyle)
        const re = /\b(1[0-9]|[1-9])\s+((?:[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9\.\-]*\s)?[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9\.\-]*)\s+([A-ZÇĞİÖŞÜ\s\.]+?)\s{2,}/g;
        let m;
        let beklenenSira = 1;
        while ((m = re.exec(tabloMetni)) !== null) {
            if (parseInt(m[1], 10) !== beklenenSira) {
                re.lastIndex = m.index + m[1].length;
                continue;
            }
            beklenenSira++;
            const kod = m[2].trim();
            const ad  = m[3].trim();
            if (ad && ad.length > 3 && !/müdür|yardımcısı/i.test(ad)) {
                kodAd[kod] = ad;
                kodAd[norm(kod)] = ad;
            }
        }
    }

    const programBaşlangic = sayfaMetni.indexOf('Pazartesi');
    const programBitis     = sayfaMetni.search(/Sr\s+Ders\s+Kodu/i);
    if (programBaşlangic === -1 || programBitis === -1) return null;
    const programMetni = sayfaMetni.substring(programBaşlangic, programBitis);
    
    const tumSaatler = [...programMetni.matchAll(/(\d{2}:\d{2}-\d{2}:\d{2})/g)].map(m => m[1]);
    const uniqueTimes = Array.from(new Set(tumSaatler)).sort();
    const haftalik = {};
    const gunAdi = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
    const gunKey = ['Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma'];
    const kodAdKeys = Object.keys(kodAd).sort((a, b) => b.length - a.length);

    for (let gi = 0; gi < gunAdi.length; gi++) {
        const gun = gunAdi[gi];
        const gunStart = programMetni.indexOf(gun);
        if (gunStart === -1) { haftalik[gunKey[gi]] = Array(10).fill(''); continue; }

        let gunBitis = programMetni.length;
        if (gi + 1 < gunAdi.length) {
            const temp = programMetni.indexOf(gunAdi[gi + 1], gunStart + gun.length);
            if (temp !== -1) gunBitis = temp;
        }
        
        const gunMetni = programMetni.substring(gunStart + gun.length, gunBitis);
        const saatler  = [...gunMetni.matchAll(/(\d{2}:\d{2}-\d{2}:\d{2})/g)];
        const dersler  = Array(uniqueTimes.length).fill('');

        saatler.forEach((saatMatch, idx) => {
            const slotIndex = uniqueTimes.indexOf(saatMatch[0]);
            if (slotIndex === -1) return;
            const oncesi = gunMetni.substring(idx > 0 ? saatler[idx - 1].index + saatler[idx - 1][0].length : 0, saatMatch.index).trim();
            if (!oncesi) { dersler[slotIndex] = ''; return; }

            let bulundu = false;
            const oncesiNorm = norm(oncesi);
            for (const k of kodAdKeys) {
                if (oncesi.includes(k) || oncesiNorm.includes(norm(k))) { 
                    dersler[slotIndex] = kodAd[k]; 
                    bulundu = true; 
                    break; 
                }
            }
            if (!bulundu) {
                for (const k of kodAdKeys) {
                    const adNorm = norm(kodAd[k]);
                    if (adNorm.length > 3 && oncesiNorm.includes(adNorm)) {
                        dersler[slotIndex] = kodAd[k];
                        bulundu = true;
                        break;
                    }
                }
            }
            if (!bulundu) dersler[slotIndex] = oncesi.replace(/\(.*?\)/g, '').replace(/\b\d+\b/g, '').trim() || '';
        });
        haftalik[gunKey[gi]] = dersler;
    }
    return haftalik;
}

export async function pdfVeriOlustur(pdfBytes) {
    const sayfalar = await pdfdenMetinCikar(pdfBytes);
    const dersOgretmen = {}, haftalikProg = {}, subeOzet = [];
    const eklenenSubeler = new Set();
    
    for (const sayfa of sayfalar) {
        const subeListesi = subeBilgisiCikar(sayfa);
        if (!subeListesi || subeListesi.length === 0) continue;
        const atamalar = dersOgretmenTablosuCikar(sayfa);
        const haftalik = haftalikProgramCikar(sayfa);
        
        for (const subeInfo of subeListesi) {
            const anahtar = subeInfo.anahtar;
            if (atamalar.length > 0) {
                dersOgretmen[anahtar] = atamalar;
                if (!eklenenSubeler.has(anahtar)) {
                    subeOzet.push({ kod: anahtar, dersAdet: atamalar.length, ogrAdet: new Set(atamalar.map(a => a.ogr)).size, birlesi: subeInfo.birlesi });
                    eklenenSubeler.add(anahtar);
                }
            }
            if (haftalik) haftalikProg[anahtar] = haftalik;
        }
    }
    
    if (subeOzet.length === 0) {
        throw new Error("PDF'den hiçbir şube verisi çıkartılamadı. Format farklı olabilir.");
    }
    
    return { dersOgretmen, haftalikProg, subeOzet };
}
