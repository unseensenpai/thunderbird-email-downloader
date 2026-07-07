# Thunderbird Email HTML Export Eklentisi — Tasarım Dokümanı

**Tarih:** 2026-07-07
**Durum:** Onaylandı (implementasyon planına hazır)

## 1. Amaç

Thunderbird masaüstü istemcisi için bir eklenti (MailExtension) geliştirmek: kullanıcının seçtiği e-postaları, seçtiği bir klasöre HTML olarak export eden; eklerini indirip aynı klasördeki `attachments/` alt klasörüne yazan ve HTML'den bu eklere relative referans veren bir araç. Eklenti resmi Thunderbird eklenti mağazasına (addons.thunderbird.net, ATN) yayınlanacak.

## 2. Kapsam ve Gereksinimler

### 2.1 Fonksiyonel gereksinimler

- Kullanıcı mesaj listesinde bir veya birden fazla e-posta seçer.
- Sağ tık menüsünden **"HTML olarak export et"** ile başlatır.
- Gerçek bir **"Klasör seç"** penceresi açılır; kullanıcı hedef klasörü seçer (yerel disk, D:, ağ sürücüsü — her yer yazılabilir).
- Her e-posta `<guidv7>.html` olarak seçilen klasöre yazılır.
- Ekler `<guidv7>.<orijinal-uzantı>` olarak `<hedef>/attachments/` alt klasörüne yazılır; uzantı korunur.
- HTML dosyaları eklere **relative** referans verir (`attachments/<guidv7>.<uzantı>`).
- Body içindeki inline `cid:` görseller de birer ek gibi `attachments/` altına yazılır ve HTML'deki `cid:` referansları relative yola çevrilir.
- Sadece desteklenen ek türleri export edilir; arşivler ve çalıştırılabilirler atlanır (bkz. 4.3).
- Export bitince özet bildirimi gösterilir.

### 2.2 Fonksiyonel olmayan gereksinimler

- MV3 (Manifest V3) tabanlı, güncel Thunderbird API'lerine göre yazılmış.
- Ayrıcalıklı (Experiment API) kod minimal tutulur — bakım ve mağaza inceleme yükünü azaltmak için.
- Çıktı HTML'leri self-contained: harici CDN/stil/script yok, minimal inline CSS.
- UTF-8 kodlama.

## 3. Mimari

Eklenti iki katmandan oluşur.

### 3.1 Standart WebExtension katmanı (ayrıcalıksız, test edilebilir)

`background.js` (MV3, event-driven) + built-in `messages`/`menus` API'leri.

Sorumlulukları:
- `menus` API ile mesaj listesi sağ tık menüsünü kurmak.
- Seçili mesajları almak, her mesajın header'larını ve body'sini okumak (`messages.getFull`).
- Ekleri listelemek ve okumak (`messages.listAttachments`, `messages.getAttachmentFile`).
- HTML üretmek, `cid:` inline görselleri yeniden yazmak, GUIDv7 dosya adları üretmek, ek türü filtresi uygulamak.
- Header değerlerini ve orijinal dosya adlarını HTML metin alanlarında escape etmek.

Bu katmandaki iş mantığı saf/ayrıcalıksızdır ve birim testlerle doğrulanabilir.

### 3.2 İnce Experiment API katmanı (ayrıcalıklı, minimal)

`experiment_apis` bloğu ile tanımlanan, Thunderbird iç API'lerine erişen küçük bir katman. MV3 ile uyumludur (Thunderbird, Firefox'un aksine release/beta sürümlerde Experiment API'lere izin verir).

Yalnızca iki iş yapar:
1. **Klasör seçici:** `Ci.nsIFilePicker` + `modeGetFolder` → gerçek "Klasör seç" penceresi açar, seçilen klasörün tam yolunu döndürür.
2. **Disk yazımı:** `IOUtils.writeUTF8` / `IOUtils.write` + `PathUtils.join` + `IOUtils.makeDirectory` → HTML dosyalarını ve `attachments/` altındaki ekleri seçilen klasöre yazar.

Referans desen: ImportExportTools NG'nin `ExportMessages` experiment API'si (aynı `nsIFilePicker`/`IOUtils`/`PathUtils` yaklaşımı), ancak burada çok daha küçük ve odaklı tutulur.

### 3.3 Manifest

- `manifest_version: 3`
- `strict_min_version: "128.0"` (MV3 tabanı)
- `strict_max_version`: güncel seriye sabitlenir (ör. `"152.*"`), yeni TB serileri çıktıkça güncellenir.
- Gerekli izinler: `messagesRead`, `menus`, ve Experiment API tanımı.

## 4. Klasör yapısı, isimlendirme ve filtreleme

### 4.1 Disk yapısı

Kullanıcının seçtiği klasör `<hedef>`:

```
<hedef>/
├── 018f9a2c-....html          # e-posta 1 (GUIDv7.html)
├── 018f9a3d-....html          # e-posta 2
├── 018f9a4e-....html          # e-posta 3
└── attachments/
    ├── 018f9b01-....pdf       # ek (GUIDv7 + orijinal uzantı)
    ├── 018f9b02-....png       # inline cid: görsel de buraya
    └── 018f9b03-....docx
```

### 4.2 İsimlendirme kuralları

- **HTML dosyaları:** `<guidv7>.html`. Konu HTML içeriğinde yer alır, dosya adında değil.
- **Ekler:** `<guidv7>.<orijinal-uzantı>`. Uzantı değiştirilmez.
- Her ek benzersiz bir GUIDv7 alır (deduplication yok — aynı dosya iki e-postada varsa iki kez yazılır).
- Inline `cid:` görseller de birer ek gibi işlenir: `attachments/` altına GUIDv7 ile yazılır, body'deki `cid:` referansı `attachments/<guidv7>.<uzantı>` relative yoluna çevrilir.
- GUIDv7 kullanıldığı için dosya adı çakışması pratikte olmaz.

### 4.3 Ek türü filtresi

- **Atlanan türler:** arşivler (`zip`, `rar`, `7z`, `tar`, `gz`) ve çalıştırılabilirler / script'ler (`exe`, `msi`, `bat`, `cmd`, `com`, `scr`, `dll`, `js`, `vbs`).
- **Export edilen türler:** yukarıdakiler dışındaki her şey (görseller, PDF, Office/ODF dokümanları, metin/veri dosyaları vb.).
- Atlanan ekler HTML'in ek listesinde "export edilmedi (tür desteklenmiyor)" notuyla gösterilir, link verilmez.

## 5. HTML çıktısı

Her e-posta için üretilen `<guidv7>.html`:

1. **Header bloğu (üstte):** Tüm mevcut header'lar okunaklı bir tabloda — From, To, Cc, Bcc, Date, Subject, Reply-To, Message-ID vb. Header değerleri escape edilir.
2. **Body:** E-postanın orijinal HTML body'si **olduğu gibi** gömülür (sanitize/temizleme yok — tracking pixel dahil değiştirilmez). Sadece düz-metin body varsa escape edilip `<pre>` içinde gösterilir. `cid:` referansları relative yola çevrilir.
3. **Ek listesi (altta):** Her export edilen ek için orijinal ad (`teklif.pdf`) görünür; link `attachments/<guidv7>.pdf`'e gider. Atlanan ekler notla listelenir, link verilmez.

**Güvenlik notu:** Body olduğu gibi korunur; ancak header değerleri ve orijinal dosya adları gibi metin alanları HTML injection'a karşı escape edilir (body'nin kendi HTML'ine dokunulmaz).

## 6. Hata yönetimi

- Kullanıcı "Klasör seç" penceresini iptal ederse: sessizce çıkılır, hiçbir dosya yazılmaz.
- Bir ek okunamaz/yazılamazsa: o ek atlanır, diğerlerine devam edilir, özette bildirilir.
- Seçilen klasöre yazma izni yoksa: anlaşılır hata bildirimi.
- Başarı özeti: "N e-posta + M ek export edildi → `<klasör>`. K ek atlandı."

## 7. Test stratejisi

- **Birim testleri (ayrıcalıksız iş mantığı):** HTML üretimi, GUIDv7 isimlendirme, `cid:` yeniden yazma, ek türü filtresi, header/dosya-adı escape. Gerçek Thunderbird gerektirmeden saf fonksiyonlar olarak test edilir.
- **Entegrasyon/manuel test (Experiment API katmanı):** Klasör seçici ve disk yazımı gerçek Thunderbird'de `web-ext run` ile doğrulanır.
- **Test verisi:** çoklu ek, inline `cid:` görsel, düz-metin-only e-posta, arşiv/exe içeren e-posta (atlanmalı), Türkçe/özel karakterli konu.

## 8. Yayınlama (addons.thunderbird.net / ATN)

### 8.1 Paketleme

- `web-ext build` ile paket üretilir.
- **Paket uzantısı `.xpi` (veya `.zip`) olmalıdır** — ATN yalnızca `.zip`, `.xpi`, `.crx`, `.jar`, `.xml` uzantılarını kabul eder.

### 8.2 İki aşamalı yayın

1. **Geliştirme/test aşaması — "On your own" (self-distribution):** ATN üzerinden imzalı `.xpi` alınır, kendi Thunderbird kurulumunda gerçek test yapılır.
2. **Yayın aşaması — "On this site" (listeleme):** Kod incelemesinden geçtikten sonra ATN mağazasında herkese listelenir; otomatik güncelleme ATN'den gelir. Kullanıcının asıl hedefi budur.

### 8.3 İnceleme

- Experiment API içeren eklentiler kaynak koduyla gönderilir ve **manuel insan incelemesinden** geçer. Bu yüzden Experiment katmanı minimal tutulmuştur (inceleme hızlanır).
- `strict_max_version` her yeni TB serisinde güncellenip yeni sürüm yayınlanır.

### 8.4 Sorumluluk paylaşımı

- **Hazırlık (kimlik gerektirmeyen):** `.xpi` paketi, manifest, mağaza metinleri, temiz kaynak kod — geliştirme sürecinde hazırlanır.
- **Yükleme (hesap gerektiren):** ATN'ye giriş, "Submit a New Add-on", `.xpi` yükleme, sözleşme onayı, listeleme bilgileri ve ekran görüntüleri — kullanıcı kendi ATN hesabıyla yapar.

## 9. Açık uçlar / sonraya bırakılanlar

- Lisans seçimi (MIT / GPLv3 vb.) — sonra netleştirilecek.
- Eklenti klasör adı / mağaza listeleme metinleri ve ikonlar — implementasyon sırasında hazırlanacak.

## 10. Referanslar

- Thunderbird MV3 dökümanı: https://webextension-api.thunderbird.net/en/mv3/
- Experiment API'ler (MV3'te destekli): https://webextension-api.thunderbird.net/en/mv3/guides/experiments.html
- Experiment API giriş / mağaza politikası: https://developer.thunderbird.net/add-ons/mailextensions/experiments
- Referans eklenti (nsIFilePicker + IOUtils deseni): https://github.com/thunderbird/import-export-tools-ng
- `downloads` / `messages` API'leri: https://webextension-api.thunderbird.net/en/mv3/
