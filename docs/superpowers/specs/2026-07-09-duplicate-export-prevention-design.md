# Mükerrer Export Engelleme — Tasarım

Tarih: 2026-07-09
Durum: Onaylandı

## Problem

Şu anda her export yeni bir UUIDv7 üretir ve dosya adı olarak kullanır. Aynı
e-posta iki kez export edilirse iki ayrı `.html` dosyası oluşur. Mükerrerliği
tespit edecek hiçbir mekanizma yoktur.

## Amaç

Bir e-posta bir hedef klasöre daha önce export edildiyse bunu tespit etmek ve
kullanıcıya ne yapmak istediğini sormak.

## Kararlar

| Konu | Karar | Gerekçe |
|---|---|---|
| Kayıt yeri | Hedef klasörde `.export-index.json` | Klasörle birlikte taşınır; farklı klasörlere ayrı export doğal olarak mümkün kalır |
| Mükerrer davranışı | Kullanıcıya sor | Kullanıcı kontrolü |
| Soru sıklığı | Tek sefer, toplu karar | 50 e-postada 50 pencere çıkmasın |
| Kimlik | `headerMessageId`, yoksa içerik özeti | `msg.id` oturumlar arası kalıcı değildir |
| Özet algoritması | SHA-256 (`crypto.subtle`) | Çakışma riski sıfıra yakın; ortamda hazır |

### Neden `msg.id` değil

`msg.id` Thunderbird'ün oturum içi sayısal kimliğidir. Yeniden başlatmada
değişir ve e-posta başka klasöre taşınınca takip etmez. Kalıcı bir index'in
anahtarı olamaz.

### Neden SHA-256, basit hash değil

FNV-1a/djb2 gibi 32-bit hash'ler kısa ve senkrondur, ama çakışma yanlış
pozitif üretir. Yanlış pozitif burada "kullanıcının e-postası export
edilmedi" demektir — sessiz veri kaybı. `crypto.subtle.digest` background
script'te zaten mevcuttur; tek maliyeti asenkronluk, ki akış zaten `async`.

## Mimari

Saf mantık `lib/` altında, I/O ve UI Experiment API'de.

### Yeni modüller (saf, Thunderbird'süz test edilebilir)

**`lib/message-key.js`**
Bir e-postadan kalıcı kimlik üretir.
- `headerMessageId` doluysa: köşeli parantezleri sıyır, küçük harfe çevir.
- Boşsa: `author|date|subject|size` alanlarından SHA-256 üret, `sha256:<hex>` döndür.
- `async` (çünkü `crypto.subtle`).

Fallback hash girdisi kesin olarak şudur (sırayla, `|` ile birleştirilmiş):

| Alan | Normalizasyon |
|---|---|
| `author` | boşsa `""` |
| `date` | `date.toISOString()` — **`toString()` değil** |
| `subject` | boşsa `""` |
| `size` | `String(size)`, boşsa `"0"` |

`date` için `toISOString()` şart: `toString()` yerelleştirilmiş ve saat dilimine
bağlı çıktı verir, aynı e-posta farklı makinede farklı hash üretirdi.

Fallback yolu nadirdir (Message-ID'siz e-posta). Konu satırı hash'e girer; bir
istemci konuyu normalize ederse (`Re:` ekleme vb.) anahtar değişir ve e-posta
"yeni" görünür. Bu kabul edilen bir sınırdır.

**`lib/export-index.js`**
Index nesnesinin ayrıştırılması, doğrulanması, güncellenmesi, serileştirilmesi.
Dosya sistemine dokunmaz.

**`lib/duplicate-plan.js`**
Seçilen e-postaların anahtarlarını index'le karşılaştırıp `{ yeniler, mükerrerler }`
ayrımını yapar. Karar mantığı burada, I/O yok.

### Experiment API'ye eklenecekler

- `readTextIfExists(path)` → `string | null`
- `confirmDuplicates(total, duplicateCount)` → `"skip" | "overwrite" | "cancel"`
  (`nsIPromptService.confirmEx`, üç buton)
- `deleteFile(path)` → `void` (`IOUtils.remove` ile, `ignoreAbsent: true`)

## Index dosya biçimi

Hedef klasörde `.export-index.json`:

```json
{
  "version": 1,
  "entries": {
    "<message-key>": {
      "html": "019f4744-babc-7d67-b906-4e541231c2e0.html",
      "attachments": [
        "attachments/019f4745-1a2b-7c3d-8e4f-5a6b7c8d9e0f.pdf",
        "attachments/019f4746-2b3c-7d4e-9f5a-6b7c8d9e0f1a.png"
      ],
      "exportedAt": "2026-07-09T12:34:56.789Z",
      "subject": "Sipariş onayı"
    }
  }
}
```

- `version` — biçim değişirse eski dosyaları tanımak için.
- `entries` anahtarı — `message-key` (Message-ID veya `sha256:...`).
- `html` — üzerine yazmada **aynı dosyayı** yeniden kullanmak için. Yoksa her
  overwrite yetim bir eski dosya bırakırdı.
- `attachments` — bu e-postanın yazdığı ek dosyalarının hedef klasöre göre
  göreli yolları. Üzerine yazmada eskileri silmek için gerekli. Ek yoksa `[]`.
- `subject` — sadece insan okusun diye; mantıkta kullanılmaz.

Not: `.` öneki Windows'ta dosyayı gizlemez. Kullanıcı `.export-index.json`
dosyasını export klasöründe görecektir. Bu bilinçli: dosyanın görünür olması,
silinmesi hâlinde mükerrer takibinin sıfırlanacağını anlaşılır kılar.

## Akış

1. Klasör seçilir (mevcut davranış).
2. `.export-index.json` okunur; yoksa boş index kabul edilir.
3. Seçili her e-posta için anahtar üretilir.
4. Anahtarlar index'le karşılaştırılır → `yeniler` / `mükerrerler`.
5. Mükerrer **yoksa** hiç soru sorulmaz, doğrudan export.
6. Mükerrer **varsa** tek diyalog:
   *"5 e-postadan 2'si bu klasöre daha önce aktarılmış. Ne yapılsın?"*
   → `[Atla] [Üzerine yaz] [İptal]`
   - **İptal** → hiçbir şey yazılmaz, çıkılır.
   - **Atla** → sadece yeniler export edilir.
   - **Üzerine yaz** → hepsi export edilir; mükerrerler mevcut HTML dosya adını
     yeniden kullanır ve eski ekleri silinir (bkz. silme sırası).
7. Her başarılı e-postadan sonra index bellekte güncellenir (`html`,
   `attachments`, `exportedAt`, `subject`).
8. Döngü bitince index **bir kez** diske yazılır.
9. Bildirim: `3 e-posta, 7 ek aktarıldı. 2 zaten mevcuttu (atlandı). 0 hata.`

### Ödünleşim: index yazım sıklığı

Index döngü sonunda tek seferde yazılır. Her e-postadan sonra yazmak çökmeye
karşı daha dayanıklı olurdu ama 100 e-postada 100 disk yazımı demek. Export
sırasında çökme nadirdir; çöktüğünde dosyalar diskte kalır ve bir sonraki
çalıştırmada "yeni" sayılıp üzerine yazılır. Kabul edilen bir ödünleşim.

### Üzerine yazmada eski eklerin silinmesi

Üzerine yazarken HTML dosyası aynı adla yeniden yazılır (index'teki `html`
alanı sayesinde), ama ekler her export'ta yeni UUID alır. Eski ek dosyalarına
hiçbir HTML işaret etmez — silinmezlerse klasörde ölü ağırlık olarak birikirler.

**Karar: silinirler. Opsiyon yok.**

Kullanıcı "üzerine yaz" dediğinde niyeti bu e-postanın export'unu tazelemektir;
geride ölü dosya bırakmak o niyete hizmet etmez. Bir opsiyon sunmak, kullanıcıyı
hiç düşünmek istemediği bir konuda karar vermeye zorlar ve karşılığında bir ayar
deposu, iki kod yolu ve iki kat test getirir. Fayda yok, maliyet gerçek.

Bunun için index her girdinin ek listesini de tutar (bkz. dosya biçimi).

#### Silme sırası

1. Yeni ekleri yaz
2. Yeni HTML'i yaz
3. **Ancak bundan sonra** eski ek listesini sil
4. Index'i güncelle

Silme en sona bırakılır: adım 1–2 arasında bir hata olursa kullanıcı hem eski
hem yeni dosyalara sahip olur, ki bu hiçbirine sahip olmamaktan iyidir.

#### Silme hatası

Silme başarısız olursa (dosya kilitli, izin yok) export **başarısız sayılmaz** —
dosyalar zaten doğru yazılmıştır. Sadece bildirimde belirtilir.

#### Neden silmek güvenli

İki farklı e-posta aynı ek dosyasını paylaşmaz: her ek, her export'ta yeni bir
UUID alır. Bu yüzden bir e-postanın eski eklerini silmek başka bir e-postanın
HTML'ini bozamaz.

> **Uyarı — gelecek için.** Ekler bir gün içerik hash'ine göre paylaştırılırsa
> (deduplication), bu güvence kaybolur ve silme referans sayımı gerektirir.
> Dedup eklenmeden bu bölüm yeniden düşünülmelidir.

## Hata yönetimi

- **Index okunamıyor/bozuk** → bildirimle dur, hiçbir şey yazma.
  Sessizce yok saymak mükerrer kontrolünü kapatır (her şey "yeni" görünür) —
  sessiz düzeltme yerine gürültülü durma.
- **`confirmEx` hata verirse** → export'u iptal et. Varsayılan olarak
  "üzerine yaz"a düşmek tehlikeli.
- **Tek bir e-posta patlarsa** → mevcut davranış: sayaç artar, döngü devam
  eder, o e-posta index'e **yazılmaz** (yoksa başarısız export "yapıldı"
  sanılır).
- **Index yazımı patlarsa** → dosyalar diskte; bildirimde uyarı: bir dahaki
  sefere mükerrer görünmeyecekler.

### Bonus düzeltme

`background.js:58` — `pickFolder` çağrısı korumasız. Hata olursa yakalanmayan
promise reddi olarak sessizce yutulur ve kullanıcı hiçbir şey görmez. Bu
çalışmada `runExport` tamamı `try/catch`e alınıp hatalar bildirime düşürülecek.
Aksi halde yukarıdaki yeni hata yollarının hiçbiri kullanıcıya görünmez.

## Test

Mevcut `node --test` desenine uygun; saf modüller sayesinde Thunderbird'süz.

- **`message-key.test.js`** — Message-ID normalize (`<abc@x>` → `abc@x`,
  büyük/küçük harf), boş Message-ID'de hash üretimi, aynı girdi → aynı hash,
  farklı girdi → farklı hash.
- **`export-index.test.js`** — boş/geçerli/bozuk JSON ayrıştırma, giriş ekleme,
  serileştirme, bilinmeyen `version` reddi, `attachments` alanının korunması,
  eksik `attachments` alanının `[]` sayılması.
- **`duplicate-plan.test.js`** — hepsi yeni, hepsi mükerrer, karışık, boş seçim;
  mükerrer girdi için silinecek eski ek listesinin doğru döndürülmesi.

Experiment API'deki `readTextIfExists`, `confirmDuplicates` ve `deleteFile`
birim testine girmez (Thunderbird internals); elle doğrulanır.
