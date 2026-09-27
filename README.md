# e-Okul Asistanı

e-Okul üzerinde öğretmenlerin işlerini kolaylaştıran bir Chrome Eklentisi.

## Kurulum

1. Bu depoyu bilgisayarınıza indirin veya klonlayın.
2. Chrome tarayıcınızda adres çubuğuna `chrome://extensions/` yazın ve eklentiler sayfasına gidin.
3. Sağ üst köşede bulunan **"Geliştirici modu"** (Developer mode) seçeneğini aktif edin.
4. Sol üst köşede beliren **"Paketlenmemiş öğe yükle"** (Load unpacked) butonuna tıklayın.
5. İndirdiğiniz bu proje klasörünü seçin.
6. Eklenti tarayıcınıza yüklenecek ve kullanıma hazır hale gelecektir.

## Kullanım

Eklenti e-Okul sayfalarındayken aktif hale gelir. Bir `SinifProgrami.pdf` dosyasını sisteme yüklediğinizde, sayfaları (koordinat tabanlı okuma yardımıyla) otomatik olarak analiz eder ve şubeleri tespit eder. Ardından menü üzerinden otomatik öğretmen atamalarını ve haftalık program işlemlerini gerçekleştirebilirsiniz.

### PDF Formatı ve Desteklenen Sınıf Şablonları

Eklenti ders programlarının standart tablolama formatında ve dijital PDF olarak verildiği dosyaları ayrıştırabilmektedir. Sınıf adlarının ayrıştırılması için çok sayıda Regex deseni mevcuttur. Eklenti aşağıdaki formatları başarıyla tespit edebilir:

* **Genel / Düz Liseler:** `9-A`, `10-B`
* **Grup Sınıfları:** `9-A - GRUP1`, `11/G MUH`, `10 MUHASEB`
* **ATP / AMP Birleşik Şubeler:** `AMP10G-I`, `AMP 11 A-E`, `AMP12F-G-I`
* **ATP / AMP Tekil Şubeler:** `ATP9A OTOM`, `AMP 10 I PAZ`
* **Bitişik Meslek Kodları:** `11MOT E.A.`, `12MUHASEBE`
* **Özel Sınıflar:** `ÖZEL EĞİTM`

> PDF parse işlemi, sayfanın X,Y koordinatlarına dayanır. Standart dışına çıkan "Sr", "Ders Kodu", "Ders Adı" sıralaması değişmiş sütunlarda koordinatların (`content.js` / `popup.js` içindeki x değerlerinin) uyarlanması gerekebilir.

## Sürüm Geçmişi

Lütfen projedeki değişiklikler için `CHANGELOG.md` dosyasına göz atın.
