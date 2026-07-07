# Email HTML Export

Seçili Thunderbird e-postalarını, seçtiğiniz bir klasöre kendi içinde bütün
(self-contained) HTML olarak ve ekleriyle birlikte dışa aktaran bir Thunderbird
eklentisi (MailExtension).

**English:** A Thunderbird MailExtension that exports selected emails to a folder
you choose, as self-contained HTML files with their attachments.

## Özellikler

- Mesaj listesinde sağ tık → **"HTML olarak dışa aktar"**.
- Gerçek bir **klasör seçici** açılır (yerel disk veya ağ sürücüsü — her yere yazılabilir).
- Her e-posta, **tüm başlıkları** (header) ve **orijinal gövdesiyle** birlikte
  `<uuidv7>.html` olarak kaydedilir.
- Ekler `attachments/` alt klasörüne `<uuidv7>.<uzantı>` olarak yazılır; HTML'den
  **göreli (relative)** yolla referans verilir.
- Ek dosyaları **UUIDv7** (zaman sıralı) ile yeniden adlandırılır; **orijinal uzantı korunur**.
- Uzantısı olmayan görsel ekler (ör. `ScreenCapture`) MIME tipinden tanınır ve
  doğru uzantıyla (`.png`, `.jpg` vb.) kaydedilir; görsel olarak tanınamayan
  uzantısız ekler atlanır.
- Gövdedeki **inline `cid:` görseller** çevrimdışı görüntülenecek şekilde yeniden yazılır.
- **Arşivler ve çalıştırılabilir dosyalar** güvenlik için atlanır.
- Dışa aktarma sonunda özet bildirim gösterilir.
- **Ağ erişimi yoktur; hiçbir veri makineden dışarı çıkmaz.**

## Klasör yapısı (çıktı)

```
<seçtiğiniz-klasör>/
├── 018f9a2c-....html          # e-posta 1
├── 018f9a3d-....html          # e-posta 2
└── attachments/
    ├── 018f9b01-....pdf       # ek (UUIDv7 + orijinal uzantı)
    ├── 018f9b02-....png       # inline cid: görsel de buraya
    └── 018f9b03-....docx
```

## Mimari

İki katman:

1. **Standart WebExtension katmanı** (ayrıcalıksız, birim testli):
   - `src/background.js` — sağ tık menüsü + orkestrasyon.
   - `src/lib/` — saf mantık: `uuidv7`, `attachment-filter`, `mime`, `filename`,
     `html-escape`, `cid-rewrite`, `html-builder`.
2. **İnce Experiment API katmanı** (ayrıcalıklı, minimal):
   - `src/api/FileExport/` — yalnızca (1) `nsIFilePicker` klasör seçici ve
     (2) `IOUtils`/`PathUtils` ile disk yazımı.

Ayrıntı için: [tasarım dokümanı](docs/superpowers/specs/2026-07-07-thunderbird-email-html-export-design.md)
ve [implementasyon planı](docs/superpowers/plans/2026-07-07-thunderbird-email-html-export.md).

## Gereksinimler

- **Thunderbird 128 – 153**
- Geliştirme için: **Node 21+** ve **npm**

## Geliştirme

```bash
npm install            # bağımlılıkları kur (web-ext)
npm test               # birim testlerini çalıştır (node --test)
npm run run:tb         # eklentiyi geçici Thunderbird profilinde çalıştır
npm run build          # dağıtım paketini üret (web-ext-artifacts/*.zip)
```

Kendi profilinizle (gerçek e-postalarla) test için:

```bash
npx web-ext run --source-dir=src \
  --firefox="C:\Program Files\Mozilla Thunderbird\thunderbird.exe" \
  --keep-profile-changes \
  --firefox-profile="C:\Users\<kullanıcı>\AppData\Roaming\Thunderbird\Profiles\<profil>.default-release"
```

> Not: Aynı profil iki kez açılamaz — önce çalışan Thunderbird'ü tamamen kapatın.

### İkonlar

İkon seti (mavi zemin + beyaz zarf + yeşil dışa aktarma oku) bağımlılıksız
üretilir:

```bash
node scripts/generate-icons.mjs   # src/icons/export-{16,32,64}.png
```

## Paketleme ve yayınlama (ATN)

```bash
npm run build
# üretilen .zip'i .xpi olarak kopyala (ATN .xpi kabul eder)
```

Yayınlama adımları ve mağaza listeleme metni: [docs/STORE_LISTING.md](docs/STORE_LISTING.md).

Özet:
1. https://addons.thunderbird.net → oturum aç.
2. **Submit a New Add-on** → **"On this site"** (herkese açık) veya **"On your own"** (yerel/imzalı test).
3. `web-ext-artifacts/email_html_export-<sürüm>.xpi` yükle.

## Lisans

[MIT](LICENSE) © 2026 Selman Gülmez
