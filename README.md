# Felvétel → YouTube konverter

Képernyőfelvételek tömörítése YouTube-kompatibilis MP4-re, **teljesen a böngészőben**.
Az [ffmpeg.wasm](https://ffmpegwasm.netlify.app/) (WebAssembly-re fordított ffmpeg)
végzi a kódolást — a videó **nem töltődik fel sehova**, minden a felhasználó gépén történik.

## Mit csinál

- H.264 (`libx264`, `high` profil, `yuv420p`) + AAC hang, `+faststart` — a YouTube ajánlott formátuma
- Állítható minőség (CRF), felbontás-korlát (csak lefelé skáláz), fps-korlát, kódolási sebesség
- A kész fájl az eredeti néven, `_small` végződéssel töltődik le

## Élő verzió

GitHub Pages-en: `https://<felhasznalonev>.github.io/<repo-nev>/`

## GitHub Pages bekapcsolása

1. Töltsd fel az `index.html` fájlt a repo gyökerébe.
2. **Settings → Pages**
3. **Source: Deploy from a branch**, branch: `main`, mappa: `/ (root)`, majd **Save**.
4. Pár perc múlva elérhető a fenti URL-en.

## Korlátok

- A böngésző biztonsági okból a **Letöltések mappába** menti a kimenetet (nem az eredeti mappába).
- Az egyszálú WASM-kódolás lassabb és memóriaérzékenyebb a natív ffmpeg-nél: pár perces
  klipekhez / néhány száz MB-ig kényelmes. Nagy (1 GB feletti) fájlokhoz natív ffmpeg ajánlott.

## Technika

Egyetlen statikus `index.html`, build-lépés nélkül. Az ffmpeg.wasm magot a jsDelivr CDN-ről
tölti (`@ffmpeg/ffmpeg@0.12.10`, `@ffmpeg/core@0.12.10`). Az egyszálú mag nem igényel
`SharedArrayBuffer`-t, így sima statikus hosztolás (pl. GitHub Pages) elég — nincs szükség
COOP/COEP fejlécekre.
