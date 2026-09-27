# Sürüm Geçmişi (Changelog)

## v2.0 (Güncel)
- **Yeni Özellik:** Haftalık ders programı tablosunu doldurma (Koordinat tabanlı ayrıştırma altyapısıyla)
- **Yeni Özellik:** Ek ders, seçmeli ve ortak ders kutucuklarını otomatik doldurma yeteneği.
- **Performans/Hata Giderimi:** Harf-frekansı bazlı hatalı eşleştirme algoritması kaldırılarak Levenshtein Distance temelli fuzzy eşleştirme eklendi (false-positive oranları düşürüldü).
- **Güvenlik:** `manifest.json`'da gereksiz olan `scripting` izni kaldırıldı; dışarıya açık kaynaklar (`web_accessible_resources`) sadece `e-okul.meb.gov.tr` ile sınırlandırıldı.
- **Optimizasyon:** `norm` fonksiyonu kod tekrarını önlemek için `utils.js` dosyasına taşındı ve her iki script'te de ortak kullanıma açıldı. Gereksiz değişken gölgelenmeleri (shadowing) giderildi.
- **Optimizasyon:** Eşleştirme sonrasında debug datası basan gereksiz storage/UI blokları kaldırıldı.

## v1.0
- **İlk Sürüm:** e-Okul Ders Programı asistanı temel özelliklerle yayınlandı.
- **Özellik:** Sınıf/şube ve öğretmen listesi analiz edilip öğretmen atama dropdown'ları üzerinden işlemlerin kısmen otomatikleştirilmesi.
