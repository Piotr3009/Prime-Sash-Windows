# Arched Sash Windows — specyfikacja implementacji

Status: **DECYZJE ZAMKNIĘTE (O1–O7, 21.08.2026)** — czeka na akceptację mockupu docelowego, potem „koduj” Faza 1.
Repo: `Piotr3009/Prime-Sash-Windows` @ `091af457` · Data: 2026-08-21

---

## 1. Decyzje podjęte (Piotr, 21.08.2026)

| # | Decyzja | Źródło |
|---|---|---|
| D1 | **Wariant B** — górna sashka SAMA jest łukowa, bez transomu. Wariant A (fanlight) nie wchodzi w rachubę. | Piotr |
| D2 | Górna sashka **otwiera się**, ale z ograniczonym skokiem (nie pełny). | Piotr |
| D3 | Bary w łukowej sashce **takie same jak w arched casement** (hub & spoke, half-hub, double/triple hub, intersecting + siatka H/V). | Piotr |
| D4 | Kształty: 4 istniejące radio w stubie — gothic, segmental, semicircular, elliptical. | stub w HTML |

## 2. Decyzje zamknięte — O1–O7 (Piotr, 21.08.2026)

| # | Pytanie | Decyzja |
|---|---|---|
| O1 | Max skok górnej sashki | `upperMaxDrop = min(300 mm, 25% wysokości prostej części)` |
| O2 | Wycena — struktura | `basePrice_sash(sqm) × 1.6` + premia za wzór barów (tabela jak casement) + bary + opcje dodatkowe |
| O3 | Wycena — mnożnik | **1.6 na cenie bazowej** (gięte IGU wliczone w ten mnożnik — O7) |
| O4 | Min. prosta część pod łukiem | **900 mm** → walidacja `H_total ≥ rise + 900` |
| O5 | Max szerokość | **1500 mm** (jak double) |
| O6 | Kolejność kształtów | **wszystkie 4 naraz** |
| O7 | Gięta szyba zespolona | tak — koszt w mnożniku 1.6, bez osobnej pozycji |

| O8 | Min. prosta część stile GÓRNEJ sashki | **300 mm** → `H_inner/2 − rise ≥ 300` — potwierdzone pomiarem zdjęcia (0.32 × W) |
| O9 | `intersecting` także dla **semicircular** (zdj. 1) | **tak** (Piotr: „ok”, 21.08) — nowa geometria, nie kopia z gothic |
| O10 | Szprosy łuku **na kolumnach V-barów** górnej sashki, nie automat z szerokości | **tak** (Piotr: „ok”, 21.08) — V-bary góra = dół domyślnie |

**Korekta Piotra 21.08 (po mockupie):** (1) bez „springing” — mechanizm to ciężarki i linki, a linia początku łuku nie jest elementem konstrukcji; (2) **górna sashka włącznie z łukiem = dolna sashka wysokościowo**.

**Interpretacja O2/O3 (do potwierdzenia jednym słowem):** mnożnik działa na `basePrice` PRZED dodaniem barów/wzoru/opcji — nie na subtotal jak Glazing Arch (+10%). Czyli: `(base × 1.6) + pattern + bars + options`, potem kolor/ilość jak dziś.

### 2.1 Pomiar zdjęcia referencyjnego (semicircular, Gothic tracery, 21.08)

| Element | Pomiar | Wniosek |
|---|---|---|
| górna sashka apex→meeting rail / dolna | 360 px / 335 px | równe (±7%) ✅ |
| rise / W | 0.48 | semicircular |
| prosta część stile górnej sashki | 0.32 × W | O8 = 300 przy W=1000 ✅ |
| pozioma szprosa na początku łuku | jest | strefa łuku oddzielona od siatki — dodać do `intersecting` (hub ma ją już: `{type:'h', y: springY}`) |
| pionowe szprosy | ciągłe przez obie sashki → maswerk | O10 |

---

## 3. Co JUŻ ISTNIEJE w repo (zweryfikowane grepem, nie z pamięci)

### 3.1 UI — `online-estimate.html`
- `sash-type` radio `value="arched-group"` (linia 412) → pokazuje `#arched-types`
- `#arched-types`: 4 radio `name="arch-style"` (gothic / segmental / semicircular / elliptical) — **wszystkie `disabled`, „Coming Soon"**
- Handler sash-type (~6340): `if (isArchedGroup) return;` — nic nie robi
- `head-type = arch` (Glazing Arch) — **działa end-to-end**, zostaje nietknięte

### 3.2 3D — `3d-src/src/components/`
- `fix-frame/FixFrameWindow.jsx` — **cała geometria łuków**: `arcPoints()`, `makeFrameGeo()`, `ContourBeads()` (metoda pierścieni), `CurvedGlass()`, `FixBars()`, `GothicArchFrame`, `SemiCircleFrame`, `SegmentalFrame`, `EllipticalFrame`
- `casement/ArchedCasementWindow.jsx` — **wzorzec do skopiowania**: łukowa rama zewnętrzna + skrzydło = `FixFrameWindow` w rebate. Dokładnie ten układ, tylko skrzydło zamiast zawiasów dostaje tor pionowy.
- `ParametricSashWindow.jsx` — box, prowadnice, pulleys, cords, weights, `upperOpeningDrop`, `maxLift` (linia 2132)
- Proporcje rise (z `ArchedCasementWindow`, linie 128/164): segmental = 0.2 W, elliptical = 0.325 W, semi = 0.5 W, gothic = 0.866 W

### 3.3 Wycena — `js/price-calculator.js`
- `calculateArchedCasement()` (linia ~64): 1200 + 600/m² + tabela premii za wzory: intersecting 250, half-hub 150, hub-spoke 210, double-hub 270, triple-hub 320
- Sash: `basePrice` per m² z `sizeMultiplier`, triple 950/m², Glazing Arch +10%

### 3.4 SVG wyceny — `js/estimate-renderer.js`
- Arched casement rysowany od linii 2799 (`fc.casArchShape`), `shapeNames` mapa linia 337
- Sash Glazing Arch: krzywa `Q` w górnej szybie (linia 1371)

### 3.5 Edit-mode — `js/edit-mode.js`
- `setRadio('sash-type', fc.sashType)` linia 181; `setRadio('cas-arch-shape', ...)` linia 353 — wzorzec restore istnieje

---

## 4. Model danych

Nowe pola w `specification` (JSON zapisywany do `estimate_items`). Muszą być w 100% odtwarzalne w edit-mode i czytelne w CSV produkcyjnym.

```
sashType:        'arched'                         // NOWA wartość (obok double/triple)
archShape:       'gothic-arch' | 'semi-circle' | 'segmental-arch' | 'elliptical-arch'
                                                  // te same stringi co casArchShape — jeden słownik
archRise:        <mm>                             // policzony z kształtu, zapisany jawnie (produkcja)
straightHeight:  <mm>                             // H_total − rise: wysokość prostej części ramy (bez słowa „springing”)
upperMaxDrop:    <mm>                             // max skok górnej sashki (O1)
archBarPattern:  'none' | 'hub-spoke' | 'half-hub' | 'double-hub-spoke' | 'triple-hub-spoke' | 'intersecting'
archHBars:       <int>                            // siatka w górnej łukowej sashce
archVBars:       <int>
lowerBars:       <istniejące>                     // dolna sashka = zwykłe bary sash (bez zmian)
```

**Decyzja nazewnicza:** `archShape` używa tych samych wartości co `casArchShape` / `fixShape`. Jeden słownik kształtów w całym systemie = jedna mapa nazw w rendererze, jedna logika w produkcji.

**Co NIE wchodzi do danych:** `headType` dla `sashType='arched'` jest ignorowany (Glazing Arch to osobny produkt dla double/triple).

---

## 5. Geometria — reguły

| Parametr | Reguła |
|---|---|
| rise(shape, W) | segmental 0.20 W · elliptical 0.325 W · semi 0.50 W · gothic 0.866 W |
| prosta część | `straightHeight = H_total − rise` |
| meeting rail | **górna sashka (z łukiem) = dolna sashka wysokościowo** → meeting rail w połowie wysokości wewnętrznej (Piotr, 21.08) |
| górna sashka | wysokość = H_inner / 2; prosta część stile = `H_inner / 2 − rise`; górny rygiel = łuk (rama = `FixFrameWindow` kształt) |
| szyba górna | `CurvedGlass` z `innerPts` łuku |
| listwy górne | `ContourBeads` — pierścienie, NIGDY sweep/extrudePath |
| mechanizm | ciężarki + linki + pulleys jak w każdym sashu (NIE sprężyny). Pulleys na szczycie prostych jambów boxu, łukowy head boxu bez mechanizmu |
| skok górny | `min(upperOpening, upperMaxDrop)`, gdzie `upperMaxDrop = min(300, 0.25 × straightHeight)` — osobny clamp, nie `maxLift` z double |
| dolna sashka | bez zmian — zwykła prostokątna, `maxLift` jak dziś |
| walidacja | `H_total ≥ rise + 900` (O4); `H_inner/2 − rise ≥ 300` (O8, propozycja); `400 ≤ W ≤ 1500` (O5) |

**Ryzyko geometryczne (z front-door):** frame face < 64 mm powoduje składanie geometrii łuku. Box sasha ma inne wymiary niż casement — sprawdzić przy pierwszym buildzie, zanim pójdą listwy.

---

## 6. Zakres zmian — per plik

| Plik | Zmiana | Ryzyko |
|---|---|---|
| `online-estimate.html` | odblokować 4 radio; nowe kontrolki: arch bar pattern + H/V (kopia z casement `f-semi-bars`/`f-gothic-bars`); handler `arched-group` → sync 3D/cena/spec; limity wymiarów; spec panel | ⚠️ handler sash-type — klasa B już tam była |
| `3d-src/src/components/ArchedSashWindow.jsx` | **NOWY** — box + prowadnice z `ParametricSashWindow`, łukowa górna sashka z `FixFrameWindow`, dolna bez zmian | ⚠️ największy — geometria |
| `3d-src/src/App.jsx` | state: `archShape`, `archBarPattern`, `archHBars`, `archVBars`, `upperMaxDrop`; routing `sashType==='arched'` → nowy komponent; `captureState`/`restoreState` | — |
| `js/price-calculator.js` | gałąź `sashType==='arched'` → `calculateArchedSash()` wg O2/O3 | ⚠️ produkcja |
| `js/estimate-renderer.js` | SVG: łuk górnej szyby wg `archShape` (reuse z casement 2799), wzór barów, `shapeNames` wspólne | — |
| `js/edit-mode.js` | restore: `arch-style`, bar pattern, H/V — po wzorcu linii 353 | ⚠️ musi odtworzyć 100% |
| `js/specification-controller.js` | `applyProductRange`: etykieta „Arched Sash — Gothic" itd. | — |
| `js/estimate-manager.js` | zapis nowych pól do `specification` | ⚠️ CSV |
| `js/dimension-handler.js` | nic — limity przez `min/max` na inputach z handlera | — |

**Nietknięte:** `head-type` Glazing Arch, triple, casement, fix-only, drzwi, `casementOwnsConfig`, metoda pierścieni.

---

## 7. Fazy implementacji (każda osobno testowalna, osobny ZIP)

### Faza 1 — [CRITICAL] Geometria 3D: 4 kształty, otwieranie, bez barów
0. Klocki do reużycia z `ParametricSashWindow.jsx` (zweryfikowane, linie): `Sash` (999), `PulleySet` (1554), `JambWithPartingBead` (1620), `ExternalBoxElement` (1697), `LowerBottomRail` (632), `GlassPane` (182), `SashStileCore`/`SashRailCore` (288/335), listwy `ExternalStileBead`/`InternalOvoloStileBead` (382/480). Z `FixFrameWindow.jsx`: `arcPoints`, `makeFrameGeo`, `CurvedGlass`, `ContourBeads`. Z `ArchedCasementWindow.jsx`: `semiCirclePoints`/`gothicPoints`/`segmentalPoints`/`ellipticalPoints` (71–196).
1. `ArchedSashWindow.jsx` — NOWY: box z prostymi jambami do `straightHeight` + łukowy head boxu (`makeFrameGeo` po konturze); górna sashka = stile do `H/2 − rise` + łukowy górny rygiel (kontur) + `CurvedGlass` + `ContourBeads`; dolna sashka = istniejący `Sash` bez zmian; `PulleySet` na szczycie prostych jambów
2. Routing w `App.jsx`, state, bucket
3. UI: odblokować 4 radio `arch-style`, handler → `update3D({sashType:'arched', archShape})`; `upperOpening` z clampem `upperMaxDrop`
4. Limity wymiarów dla arched
5. **Dowód:** screenshoty 3D 4 kształty × zamknięte/otwarte; input ≡ 3D; watchdog cicho; double/triple/Glazing Arch bez regresji

### Faza 2 — [HIGH] Linki, ciężarki, horny, kolor, szkło
1. Cord do meeting rail górnej sashki, ciężarki w boxie (jak double)
2. Horny na górnej sashce (zdj. 1 je ma), kolory int/ext, glassType/spacer, frosted
3. **Dowód:** parytet z double na tych samych kontrolkach

### Faza 3 — [HIGH] Bary
1. Kontrolki: wzór łuku (semi: none/half-hub/hub-spoke/double/triple/**intersecting** (O9); gothic: none/intersecting; seg/ell: none) + H/V górnej sashki; V-bary dolnej domyślnie = górnej (O10)
2. 3D: hub-y z `SemiCircleFrame` (promień 0.3/0.6/0.8 × halfW, spokes 4/6/8 — pasuje do zdj. 2); `intersecting` dla gothic z `GothicArchFrame` ale **słupki z V-barów, nie z `round(W/450)`**; `intersecting` dla semicircular — **NOWA** geometria (łuki z podstaw słupków, krzyżujące się, przycięte do półokręgu); pozioma szprosa na początku łuku
3. Dolna sashka: istniejące `lower-bars` / `GlazingBars`
4. **Dowód:** zdj. 1 odtworzone (semi + intersecting + 4 kolumny), zdj. 2 (semi + half-hub + 3 kolumny)

### Faza 4 — [HIGH] Cena + spec + SVG + zapis
1. `calculateArchedSash()`: `base × 1.6` + wzór (150–320) + bary + opcje
2. Spec panel, SVG wyceny, `specification` JSON
3. **Dowód:** cena identyczna z każdej trasy dojścia (macierz jak przy A/B/C)

### Faza 5 — [CRITICAL] Edit-mode + CSV
1. Restore wszystkich pól
2. Weryfikacja CSV: `archShape`, `archRise`, `straightHeight`, `upperSashHeight`, `upperMaxDrop` obecne
3. **Dowód:** zapis → edit → zapis = identyczny JSON

---

## 8. Plan testów (Playwright, headless, ×2 przebiegi)

| Test | Sprawdza |
|---|---|
| T1 | wybór arched → 3D pokazuje łuk, `sashType==='arched'` w `get3DConfig()` |
| T2 | 4 kształty → rise zgodny z tabelą (±1 mm) |
| T3 | width 1000→1200 → 3D, cena, spec nadążają (klasa A) |
| T4 | arched → double → arched: wymiar zachowany jeśli w zakresie (klasa B) |
| T5 | upperOpening = 9999 → clamp do `upperMaxDrop` |
| T6 | H < rise + 900 → input klamrowany, komunikat |
| T7 | wzory barów → `archBarPattern` w configu, cena z premią |
| T8 | add → edit → add: `specification` JSON identyczny |
| T9 | regresja: double/triple/Glazing Arch/casement/fix/drzwi — macierz zielona |

---

## 9. Ryzyka

1. **Box vs łuk** — `ParametricSashWindow` zakłada prostokątny box z pulleys u góry. Łukowy head boxu to nowa geometria; pulleys zostają na szczycie prostych jambów. Jeśli to się rozjedzie, cała faza 1 stoi.
2. **Gothic przy dużych szerokościach** — rise 0.866 W daje przy 1500 mm łuk wyższy niż prosta część. Walidacja O4/O5 musi to złapać PRZED 3D.
3. **Dwie ścieżki barów** (górna: casement-style, dolna: sash-style) — spec panel i SVG muszą pokazać obie czytelnie, CSV nie może ich pomylić.
4. **Edit-mode** — każde nowe pole = jedno miejsce, gdzie restore może zgubić dane. Test T8 jest bramką.
5. **Cena** — mnożnik 1.6 na bazie; jeśli miał być na subtotal, faza 4 wymaga jednej linii zmiany — potwierdzić w sekcji 2.

---

## 10. Stan

O1–O10 zamknięte. Mockup z równymi sashkami zaakceptowany 21.08. Plik leży w `docs/ARCHED-SASH-SPEC.md`. Następny krok: „koduj” → Faza 1.
