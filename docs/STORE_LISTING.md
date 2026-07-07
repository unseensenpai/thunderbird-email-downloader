# ATN Store Listing — Email HTML Export

## Temel bilgiler

- **Ad / Name:** Email HTML Export
- **Sürüm / Version:** 0.1.1
- **Add-on ID:** email-html-export@guralporselen.com.tr
- **Desteklenen Thunderbird:** 128.0 – 153.*
- **Yüklenecek dosya:** `web-ext-artifacts/email_html_export-0.1.1.xpi`

## Kısa özet (summary)

Seçili e-postaları, seçtiğiniz bir klasöre kendi içinde bütün (self-contained) HTML olarak ve ekleriyle birlikte dışa aktarın.

**English:** Export selected emails to a folder you choose, as self-contained HTML with their attachments.

## Açıklama (description)

Bir veya daha fazla e-posta seçin, sağ tıklayın ve **"HTML olarak dışa aktar"** deyin. Gerçek bir klasör seçici açılır — yerel disk veya ağ sürücüsü, istediğiniz yeri seçin.

- Her e-posta, tüm başlıkları (header) ve orijinal gövdesiyle birlikte kendi içinde bütün bir HTML dosyası olarak kaydedilir.
- Ekler, `attachments/` alt klasörüne kaydedilir ve HTML'den göreli (relative) yolla referans verilir.
- Ek dosyaları, zaman sıralı bir UUID (UUIDv7) ile yeniden adlandırılır; orijinal uzantı korunur.
- Uzantısı olmayan görsel ekler (ör. `ScreenCapture`) MIME tipinden tanınır ve doğru uzantıyla (`.png`, `.jpg` vb.) kaydedilir; görsel olarak tanınamayan uzantısız ekler atlanır.
- Gövdedeki inline (cid:) görseller, çevrimdışı görüntülenecek şekilde yeniden yazılır.
- Arşivler ve çalıştırılabilir dosyalar güvenlik için atlanır.

**English:** Select one or more emails, right-click, and choose "Export as HTML". Pick any folder (local disk or network drive). Each email is saved as a self-contained HTML file (all headers + original body), and its attachments are saved into an `attachments/` subfolder, referenced relatively from the HTML. Attachment files are renamed with a time-ordered UUID (UUIDv7) while keeping their original extension. Extensionless image attachments are recognized by MIME type and saved with the correct extension; unrecognized extensionless attachments are skipped. Inline (cid:) images are rewritten to display offline. Archives and executables are skipped for safety.

## İzin gerekçeleri (inceleme ekibi için / for reviewers)

- **`messagesRead`** — Seçili mesajları ve eklerini dışa aktarmak için okur.
- **`menus`** — Mesaj listesine sağ tık "HTML olarak dışa aktar" eylemini ekler.
- **`notifications`** — Dışa aktarma sonunda özet bildirim gösterir.
- **Experiment API `FileExport`** — Yalnızca iki iş için kullanılır: (1) yerel klasör seçici (`nsIFilePicker`, `modeGetFolder`) açmak, (2) dosyaları `IOUtils`/`PathUtils` ile diske yazmak. **Ağ erişimi yoktur; hiçbir veri makineden dışarı çıkmaz.**

**Ayrıcalıklı kod yalnızca** `src/api/FileExport/implementation.js` içindedir (klasör seçici + dosya yazımı). Diğer tüm mantık ayrıcalıksız `src/lib/` modüllerindedir ve birim testleriyle kaplıdır.

## Gizlilik notu (privacy)

Bu eklenti hiçbir ağ isteği yapmaz. Tüm işlem yereldir: e-postalar okunur, kullanıcının seçtiği klasöre HTML ve ekler yazılır. Hiçbir telemetri, analitik veya uzak sunucu iletişimi yoktur.

## Dağıtım adımları (add-on sahibi kendi ATN hesabıyla yapar)

1. https://addons.thunderbird.net adresinde oturum aç.
2. **Submit a New Add-on** → dağıtım türünü seç:
   - **"On your own"** — yerel test için imzalı bir yapı almak istiyorsan (herkese listelenmez).
   - **"On this site"** — inceleme sonrası herkese açık listelemek için (asıl hedef budur).
3. `web-ext-artifacts/email_html_export-0.1.1.xpi` dosyasını yükle.
4. Bu listeleme metnini ve ekran görüntülerini sağla.
5. İnceleme ekibinin sorularına yanıt ver (ayrıcalıklı experiment kodu manuel incelenir; yukarıdaki izin gerekçeleri ve gizlilik notu bu inceleme için yeterli bağlamı verir).

## Sürüm bakımı

- Yeni bir Thunderbird serisi çıktığında `manifest.json` içindeki `strict_max_version` güncellenir ve yeni bir sürüm yayınlanır.

## Lisans

**MIT** — kök dizindeki `LICENSE` dosyasına bakın.

## İkonlar

Tasarlanmış ikon seti (mavi zemin + beyaz zarf + yeşil dışa aktarma oku), 16/32/64
px boyutlarında `src/icons/` altında. `node scripts/generate-icons.mjs` ile
bağımlılıksız yeniden üretilebilir.

## Açık uçlar (herkese açık listelemeden önce)

- **Ekran görüntüleri** — ATN listelemesi için sağ tık menüsü ve örnek HTML çıktısı ekran görüntüleri hazırlanacak.
