# Recommendation System Implementation Plan

## Overview

Dodajemy na dashboardzie badge "Recommended" na jednej karcie ćwiczenia. Algorytm: least-used exercise type (animated_pacer | focus_sprint | speed_scan) z historii completions użytkownika. Remis lub brak historii → alphabetically first (animated_pacer). Nowa funkcja serwisowa `getRecommendedExerciseType()` + rozszerzenie `ExerciseCard` o prop `isRecommended`.

## Current State Analysis

Dashboard (`src/pages/dashboard.astro`) renderuje 3 karty ćwiczeń: animated_pacer, focus_sprint, speed_scan. Pobiera ćwiczenia przez `getNextExerciseForType()` (z `src/lib/services/exerciseService.ts`). `ExerciseCard` (`src/components/dashboard/ExerciseCard.tsx`) wyświetla type badge i difficulty badge, ale nie przyjmuje żadnej flagi rekomendacji.

Tabela `exercise_completions` zawiera `exercise_id` (FK do `exercises`) z kolumną `exercises.exercise_type`. Wzorzec JOIN `exercises!inner` jest już używany w `progressService.ts` (linia ~20).

## Desired End State

Na dashboardzie dokładnie jedna karta ma badge "Recommended" (żółty chip w nagłówku karty, analogiczny do type badge). Algorytm działa poprawnie:
- Nowy użytkownik (0 completions): animated_pacer otrzymuje badge
- Użytkownik z historią: typ z najmniejszą liczbą completions; remis → alphabetically first

**Weryfikacja:** zaloguj się jako nowy użytkownik → animated_pacer oznaczony; ukończ 2× animated_pacer → badge przechodzi na focus_sprint.

### Key Discoveries

- `exercise_completions` nie ma kolumny `exercise_type` — potrzebny JOIN: `.select("exercises!inner(exercise_type)")` — `src/lib/services/progressService.ts:~20` pokazuje ten wzorzec
- Dashboard hardcoduje tablicę typów: `["animated_pacer", "focus_sprint", "speed_scan"]` — użyjemy tej samej listy w service
- `const result = await supabase...` to kanoniczny pattern w całym projekcie (lessons.md)
- `createClient` może zwrócić `null` — dashboard.astro już obsługuje ten case (linia ~8)
- `ExerciseCard` przyjmuje `exercise: Exercise` jako jedyny prop — dodamy opcjonalny `isRecommended?: boolean`

## What We're NOT Doing

- Migracje bazy danych — żadnych zmian schematu
- Nowe API endpoints — logika wyłącznie server-side w Astro frontmatter
- Rekomendacja per exercise instance — tylko per exercise type
- Uwzględnianie smart_questions (w DB, ale nie na dashboardzie)
- Zapamiętywanie rekomendacji między requestami (każdy load dashboardu oblicza fresh)

## Implementation Approach

1. Nowy `src/lib/services/recommendationService.ts` z funkcją `getRecommendedExerciseType()` — zlicza completions per type dla użytkownika, zwraca typ z minimum, remis → sort + first
2. `ExerciseCard.tsx` — dodanie opcjonalnego prop `isRecommended?: boolean` i warunkowego badge'a
3. `dashboard.astro` — wywołanie `getRecommendedExerciseType()` w frontmatter, przekazanie `isRecommended` do kart

## Phase 1: Service + ExerciseCard badge

### Overview

Nowa logika biznesowa (recommendationService) i UI badge (ExerciseCard). Obie zmiany są niezależne od siebie i można je implementować równolegle, ale obie muszą być gotowe przed Phase 2.

### Changes Required

#### 1. Nowy plik `src/lib/services/recommendationService.ts`

**File**: `src/lib/services/recommendationService.ts`

**Intent**: Eksportuje funkcję `getRecommendedExerciseType(supabase, userId)` która zwraca string z rekomendowanym exercise_type.

**Contract**:
```typescript
export async function getRecommendedExerciseType(
  supabase: SupabaseClient,
  userId: string,
): Promise<"animated_pacer" | "focus_sprint" | "speed_scan">
```

Algorytm:
1. Pobierz wszystkie completions użytkownika z JOIN na `exercises.exercise_type` — filtruj do 3 widocznych typów
2. Zlicz completions per type (Map: type → count)
3. Dla typów z brakiem completions — count = 0
4. Zwróć typ z min count; remis → sort alphabetically, weź first
5. Cold-start (0 completions łącznie) → zwraca `"animated_pacer"` (alphabetically first)

Zapytanie Supabase wzorowane na `progressService.ts`:
```typescript
const result = await supabase
  .from("exercise_completions")
  .select("exercises!inner(exercise_type)")
  .eq("user_id", userId)
  .in("exercises.exercise_type", VISIBLE_EXERCISE_TYPES);
```

Gdzie `VISIBLE_EXERCISE_TYPES = ["animated_pacer", "focus_sprint", "speed_scan"] as const`.

Obsługa błędu: jeśli `result.error` → zwróć `"animated_pacer"` (graceful fallback).

#### 2. Rozszerzenie `src/components/dashboard/ExerciseCard.tsx`

**File**: `src/components/dashboard/ExerciseCard.tsx`

**Intent**: Dodaje opcjonalny prop `isRecommended?: boolean`. Gdy `true`, wyświetla żółty badge "Recommended" obok type badge w nagłówku karty.

**Contract**: Prop jest opcjonalny i domyślnie `false`. Badge powinien być wizualnie spójny z istniejącymi badge'ami (pattern: `bg-yellow-500/20 text-yellow-300` lub podobny, żeby pasował do dark theme dashboardu).

### Success Criteria

#### Automated Verification

- TypeScript: `npm run lint` przechodzi bez błędów (brak `any`, poprawne typy)
- Żaden istniejący test nie failu (jeśli projekt ma testy: `npm test`)

#### Manual Verification

- `src/lib/services/recommendationService.ts` istnieje i eksportuje `getRecommendedExerciseType`
- `ExerciseCard.tsx` przyjmuje prop `isRecommended` i renderuje badge gdy `true`
- Storybook/standalone: ExerciseCard z `isRecommended={true}` pokazuje badge (jeśli dostępny)

**Implementation Note**: Po ukończeniu tej fazy — zrób pause i ręcznie sprawdź TypeScript przed przejściem do Phase 2.

---

## Phase 2: Dashboard Integration

### Overview

Podłączenie `getRecommendedExerciseType()` w `dashboard.astro` i przekazanie `isRecommended` do kart.

### Changes Required

#### 1. `src/pages/dashboard.astro` — wywołanie service i przekazanie prop

**File**: `src/pages/dashboard.astro`

**Intent**: W sekcji frontmatter (server-side), po pobraniu ćwiczeń, wywołaj `getRecommendedExerciseType(supabase, user.id)` i przechowaj wynik. Podczas renderowania grid kart — przekaż `isRecommended={exercise.exercise_type === recommendedType}` do każdego `<ExerciseCard>`.

**Contract**: Import z `@/lib/services/recommendationService`. Wywołanie można wykonać równolegle z istniejącymi zapytaniami (np. `Promise.all`) lub sekwencyjnie — wybór implementatora. Wynik: `recommendedType: "animated_pacer" | "focus_sprint" | "speed_scan"`.

Dashboard.astro już obsługuje null-check na `supabase` (linia ~8) — nie ma potrzeby powielania tej logiki w service (service dostaje gotowy klient).

### Success Criteria

#### Automated Verification

- `npm run lint` przechodzi
- `npm run build` kończy się bez błędów TypeScript

#### Manual Verification

- Dashboard ładuje się bez błędów w konsoli przeglądarki
- Dokładnie jedna karta ma badge "Recommended"
- Nowy użytkownik (brak historii): animated_pacer ma badge
- Po ukończeniu ćwiczenia innego niż animated_pacer: badge pozostaje na animated_pacer (lub przesuwa się jeśli animowad_pacer miał 0, inne mają 1)
- Odświeżenie dashboardu po nowym completion aktualizuje rekomendację

**Implementation Note**: Sprawdź manualnie scenariusz cold-start i po 1 completion.

---

## Testing Strategy

### Manual Testing Steps

1. **Cold-start**: zaloguj się nowym kontem → tylko animated_pacer ma badge "Recommended"
2. **Po 1 completion animated_pacer**: ukończ animated_pacer → badge przesuwa się na focus_sprint (lub speed_scan — zależy od alphabetical sort przy remisie 0 vs 1)
3. **Wyrównanie**: ukończ po jednym z każdego typu → badge wraca na animated_pacer (remis → first alphabetically)
4. **Brak regresji**: inne karty nie mają badge, type/difficulty badge nadal działają

### Brak nowych unit testów

Algorytm jest czysty (Map + min + sort) — wystarczą testy manualne powyżej. Jeśli projekt doda testy w przyszłości, `recommendationService.ts` będzie łatwy do unit-testowania (czysta funkcja z mockowalnym supabase).

## Performance Considerations

Jedno dodatkowe zapytanie Supabase przy każdym load dashboardu. Zapytanie jest lekkie (COUNT per type dla jednego user_id z indeksem `idx_exercise_completions_user_date`). Akceptowalne — dashboard już wykonuje 4-5 zapytań.

## References

- Roadmap: `context/foundation/roadmap.md` §S-04
- PRD: `context/foundation/prd.md` FR-005, FR-020
- Wzorzec JOIN: `src/lib/services/progressService.ts`
- Wzorzec service: `src/lib/services/exerciseService.ts`
- Lessons: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Service + ExerciseCard badge

#### Automated

- [x] 1.1 `npm run lint` przechodzi bez błędów TypeScript — 0266f53

#### Manual

- [x] 1.2 `src/lib/services/recommendationService.ts` istnieje i eksportuje `getRecommendedExerciseType` — 0266f53
- [x] 1.3 `ExerciseCard.tsx` renderuje badge gdy `isRecommended={true}` — 0266f53

### Phase 2: Dashboard Integration

#### Automated

- [x] 2.1 `npm run lint` przechodzi
- [x] 2.2 `npm run build` kończy się bez błędów

#### Manual

- [x] 2.3 Dashboard ładuje się bez błędów w konsoli
- [x] 2.4 Dokładnie jedna karta ma badge "Recommended"
- [x] 2.5 Cold-start: animated_pacer ma badge
- [x] 2.6 Rekomendacja aktualizuje się po nowym completion
