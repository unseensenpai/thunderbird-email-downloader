# ATN "Yeni Eklenti Gönder" Formu — Doldurma Rehberi

> Bu dosya, addons.thunderbird.net (ATN) gönderim formunun **her alanına ne yazılacağını** kayıt altında tutar.
> Sonraki sürümlerde aynı değerleri tekrar kullanmak / hatırlamak için saklanır.
> Son güncelleme: 2026-07-07 · Sürüm: 0.1.2

---

## 1. Kaynak kodu göndermem gerekiyor mu? → **HAYIR**

Formun ilk sorusuna (Do You Need to Submit Source Code?) cevap: **"No"**.

Gerekçe: XPI içeriği `src/` klasörüyle **birebir aynı** (SHA-256 hash'leri eşit, 0 fark).
`web-ext build` bir paketleyicidir, derleyici değil — minify/obfuscate/webpack/template motoru **yok**.
İkonlar (`generate-icons.mjs`) görsel üretir, JS işlemez ve üretilen PNG'ler zaten `src/icons/` içindedir.

---

## 2. "Eklentinizi tanımlayın" formu

| Alan | Değer |
|---|---|
| **İsim** | `Email HTML Export` |
| **Eklenti URL'si** | `email-html-export` |
| **Özet (Summary)** | `Export selected emails to a chosen folder as HTML with attachments.` |
| **Bu eklenti deneyseldir** | ☑️ **İşaretle** (0.1.x erken sürüm) |
| **Ödeme/servis/donanım gerektirir** | ☐ İşaretsiz |
| **Kategori (max 2)** | ☑️ **İçeri/Dışarı Aktar** |
| **Destek e-postası** | `selman.gulmez@guralporselen.com.tr` |
| **Destek sitesi** | (boş) |
| **Lisans** | **MIT/X11 License** |
| **Bu eklentinin Gizlilik Kuralları var** | ☐ İşaretsiz (aşağıdaki nota bak) |
| **Notes to Reviewer** | Aşağıdaki metni yapıştır |

### Özet — alternatif (daha açıklayıcı istersen)

```
Export selected emails to a folder you choose, as self-contained HTML files with their attachments. Local-only; no network access.
```

### "Gizlilik Kuralları" kutusu hakkında

İşaretlersen ayrı bir gizlilik politikası METNİ istenir. Bu eklenti **hiçbir veri toplamadığı ve ağ erişimi olmadığı** için ayrı bir politika şart değildir — kutuyu **işaretsiz** bırak ve gizlilik durumunu "Notes to Reviewer" içinde açıkla (aşağıda var). İleride kurumsal politika gerekirse işaretleyip metin eklersin.

---

## 3. Notes to Reviewer (kopyala–yapıştır)

```
This add-on uses a Thunderbird Experiment API (FileExport). It is used ONLY for two
things: (1) opening a local folder picker (nsIFilePicker, modeGetFolder), and
(2) writing files to disk via IOUtils/PathUtils. There is NO network access; no data
ever leaves the machine. No telemetry, no analytics, no remote servers.

Privileged code lives only in src/api/FileExport/implementation.js (folder picker +
file writing). All other logic is in unprivileged src/lib/ modules, covered by unit tests.

Permission justifications:
- messagesRead — reads the selected messages and their attachments to export them.
- menus — adds the "Export as HTML" action to the message-list context menu.
- notifications — shows a summary notification when the export finishes.
- Experiment API FileExport — local folder picker + writing files to disk (see above).

The XPI contents are byte-identical to the src/ source tree (web-ext build only zips
src/; no minification/bundling/transpilation). strict_max_version (153.*) is present
because ATN requires it for add-ons that use Experiment APIs.
```

---

## 4. Yüklenecek dosya

`web-ext-artifacts/email_html_export-0.1.2.xpi`

---

## 5. Açık uç (herkese açık listeleme öncesi)

- **Ekran görüntüleri**: sağ tık menüsü + örnek HTML çıktısı ekran görüntüleri hazırlanacak.
  (Deneysel/kararsız listelemede zorunlu değil ama listeleme kalitesini artırır.)

---

## 6. Dağıtım türü seçimi (bir önceki adım)

- **"On this site"** — inceleme sonrası herkese açık listeleme (asıl hedef).
- **"On your own"** — sadece imzalı yerel yapı almak istersen (listelenmez).
