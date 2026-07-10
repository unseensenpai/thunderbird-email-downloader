# ATN "Yeni Eklenti Gönder" Formu — Doldurma Rehberi

> Bu dosya, addons.thunderbird.net (ATN) gönderim formunun **her alanına ne yazılacağını** kayıt altında tutar.
> Sonraki sürümlerde aynı değerleri tekrar kullanmak / hatırlamak için saklanır.
> Son güncelleme: 2026-07-10 · Sürüm: 0.1.4 · Dağıtım: **self-distribution (unlisted)**

---

## 1. Kaynak kodu göndermem gerekiyor mu? → **HAYIR**

Formun ilk sorusuna (Do You Need to Submit Source Code?) cevap: **"No"**.

Gerekçe: XPI içeriği `src/` klasörüyle **birebir aynı** (SHA-256 hash'leri eşit, 0 fark).
`web-ext build` bir paketleyicidir, derleyici değil — minify/obfuscate/webpack/template motoru **yok**.
İkonlar (`generate-icons.mjs`) görsel üretir, JS işlemez ve üretilen PNG'ler zaten `src/icons/` içindedir.

---

## 2. "Eklentinizi tanımlayın" formu

> **Not:** Aşağıdaki alanların çoğu **listeleme** (On this site) içindir.
> Self-distribution ("On your own") yolunda ATN çoğunu sormaz — kategori, özet,
> ekran görüntüsü gibi mağaza vitrini alanları atlanır. Değerler, ileride
> listelemeye dönülürse diye kayıtta tutuluyor.

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

## 2b. Sürüm notları — 0.1.4 (kopyala–yapıştır)

> "Yeni sürüm gönder" ekranındaki **Sürüm notları** kutusu. Kullanıcılara görünür.

```
Duplicate export prevention.

Exported messages are now tracked in a .export-index.json file inside the folder
you choose. If you export the same messages into that folder again, the add-on
asks once what to do: Skip them, Overwrite them, or Cancel the whole export.

Choosing Overwrite reuses the existing HTML file and removes that message's old
attachment files, so repeated exports no longer leave orphaned files behind.

Messages are identified by their Message-ID header, so this works across
Thunderbird restarts and when a message is moved between folders. Messages with
no Message-ID fall back to a content-based fingerprint.

Also fixed: errors during an export are now reported instead of failing silently.
```

---

## 3. Notes to Reviewer (kopyala–yapıştır)

```
This add-on uses a Thunderbird Experiment API (FileExport). It is used ONLY for
local file operations and a folder picker. There is NO network access; no data ever
leaves the machine. No telemetry, no analytics, no remote servers.

Privileged code lives only in src/api/FileExport/implementation.js. All other logic
is in unprivileged src/lib/ modules, covered by 62 unit tests.

FileExport surface (all local, all in implementation.js):
- pickFolder      — nsIFilePicker, modeGetFolder. Opens the OS folder chooser.
- makeDir         — IOUtils.makeDirectory, for the attachments/ subfolder.
- writeText       — IOUtils.writeUTF8, writes the exported .html and the index file.
- writeBytes      — IOUtils.write, writes attachment bytes.
- joinPath        — PathUtils.join, OS-correct path building.
- readTextIfExists— IOUtils.readUTF8, reads the export index; returns null if absent.
- deleteFile      — IOUtils.remove(ignoreAbsent). See scope note below.
- confirmDuplicates — nsIPromptService.confirmEx, a modal 3-button prompt.

New in 0.1.3: readTextIfExists, deleteFile, confirmDuplicates.

Scope of deleteFile: it is called ONLY on attachment files that this
add-on itself wrote during a previous export, whose relative paths were recorded in
.export-index.json inside the user-chosen folder. It is invoked only when the user
explicitly picks "Overwrite" in the duplicate prompt, and only AFTER the replacement
files have been written successfully. It never touches paths outside the folder the
user selected, and never touches files it did not create.

Permission justifications:
- messagesRead — reads the selected messages and their attachments to export them.
- menus — adds the "Export as HTML" action to the message-list context menu.
- notifications — shows a summary notification when the export finishes.
- Experiment API FileExport — folder picker + local file I/O (see above).

The XPI contents are byte-identical to the src/ source tree (web-ext build only zips
src/; no minification/bundling/transpilation). strict_max_version (153.*) is present
because ATN requires it for add-ons that use Experiment APIs.
```

---

## 4. Yüklenecek dosya

`web-ext-artifacts/email_html_export-0.1.4.xpi`

> **Sürüm numarası neden 0.1.4?** ATN, bir kez yüklenip silinmiş sürüm numarasını
> tekrar kabul etmiyor. 0.1.3 daha önce yüklenip silindiği için 0.1.4'e çıkıldı.
> Kod 0.1.3 ile aynı; yalnızca sürüm numarası arttı.

---

## 5. Açık uç

- **Ekran görüntüleri**: self-distribution'da gerekmez. Yalnızca ileride herkese açık
  listelemeye dönülürse hazırlanır.
- **X ile diyalog kapatma** (0.1.3): `confirmEx`'in pencere X'iyle kapatıldığında `1`
  döndürdüğü varsayımıyla "İptal" o indekse konuldu. Bu davranış Mozilla belgesinden
  alındı, çalışırken doğrulanmadı. Yanlışsa X'e basan kullanıcı uyarısız üzerine yazar.
  **Test edilmeli.**

---

## 6. Dağıtım türü seçimi — **"On your own"**

> **Karar (2026-07-10): "On your own".** Gerekçe aşağıda.

- **"On this site"** — herkese açık listeleme. **Bu yol kapalı.** 0.1.2 bu yoldan
  reddedildi (aşağıya bak).
- **"On your own"** — ATN eklentiyi listelemez, sadece **imzalar**. İmza gerekli,
  çünkü Thunderbird release sürümü imzasız eklenti kurmaz.

ATN inceleme politikası bu yolu açıkça tanıyor:
> "Add-ons that are intended for internal or private use, or for distribution
> testing may not be listed on ATN. Such add-ons may be uploaded for
> self-distribution instead."

---

## 7. 0.1.2 neden reddedildi (2026-07, reviewer: John Bieling)

> ATN şu anda **Experiment API kullanan yeni gönderimleri kabul etmiyor**.
> Tek istisna: `thunderbird/webext-experiments` deposundaki **yayınlanmış API
> taslaklarının değiştirilmemiş kopyaları**.

Bizim `FileExport` API'miz kendi yazdığımız bir API, o listede değil.
Ve olamaz da: o depoda sadece **iki** onaylı taslak var — `Calendar` ve
`NotificationBox`. **Dosya sistemi / dosya seçici / disk yazma için onaylı
taslak yok.** Yani kuralın gereğini yerine getirmenin bir yolu yok.

İnceleyenin önerdiği alternatif
([vfs-toolkit](https://github.com/thunderbird/webext-support/tree/master/modules/vfs-toolkit))
gerçek disk klasörüne erişimi **Native Messaging** üzerinden sağlıyor — kullanıcının
eklentiye ek olarak bir yerel yardımcı program kurması gerekir. Tek tıkla kurulan
bir eklenti olmaktan çıkar. Bu yüzden self-distribution seçildi.

**Sonuç:** Bu sürümü "On this site" ile göndermek anlamsız — `FileExport` API'si
üç fonksiyon (`readTextIfExists`, `deleteFile`, `confirmDuplicates`) daha eklenerek
**büyüdü**, yani reddi tetikleyen yüzey genişledi. Bu yüzden self-distribution.

### Experiment API'lerin geleceği

TB 153'te Experiment API'leri release kanalında kapatma planı **bir yıl ertelendi**.
Kısıtlama yalnızca **aylık release** kanalını etkiliyor; **ESR (140, 153 ESR)
etkilenmiyor**. Yakın vadede eklenti çalışmaya devam eder, ama uzun vadede
Experiment API'den çıkış yolu düşünülmeli.
