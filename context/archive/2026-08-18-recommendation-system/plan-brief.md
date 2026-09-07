# Recommendation System — Plan Brief

> Full plan: `context/changes/recommendation-system/plan.md`

## What & Why

Dodajemy badge "Recommended" na jednej karcie ćwiczenia na dashboardzie. Algorytm: least-used exercise type z historii completions użytkownika (FR-005, FR-020). Domyka Stream A core loop (S-01 → S-02 → S-04) — bez rekomendacji dashboard nie prowadzi użytkownika przez zrównoważoną praktykę.

## Starting Point

Dashboard renderuje 3 karty (animated_pacer, focus_sprint, speed_scan) bez żadnego oznaczenia. `ExerciseCard.tsx` nie ma prop `isRecommended`. Tabela `exercise_completions` zawiera wszystkie dane potrzebne do algorytmu — potrzebny tylko JOIN na `exercises.exercise_type`.

## Desired End State

Na dashboardzie dokładnie jedna karta ma żółty badge "Recommended" (spójny z istniejącymi badge'ami type/difficulty). Nowy użytkownik widzi badge na animated_pacer; po sesjach badge przesuwa się na zaniedbany typ. Odświeżenie dashboardu zawsze pokazuje aktualną rekomendację.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Badge UI | Mały chip w nagłówku karty | Spójny z type/difficulty badge, minimalny kod | Plan |
| Cold-start | animated_pacer (alphabetically first) | Deterministyczne, zero dodatkowej logiki, zgodne z PRD | Plan |
| Lokalizacja logiki | `src/lib/services/recommendationService.ts` | Single responsibility, wzorzec z progressService | Plan |
| Scope typów | Tylko 3 widoczne (nie smart_questions) | Rekomendacja dotyczy tego co użytkownik może wybrać | Plan |

## Scope

**In scope:**
- Nowy `recommendationService.ts` z funkcją `getRecommendedExerciseType()`
- Rozszerzenie `ExerciseCard.tsx` o prop `isRecommended?: boolean`
- Podłączenie w `dashboard.astro`

**Out of scope:**
- Migracje DB (żadne)
- Nowe API endpoints
- Rekomendacja per instance (tylko per type)
- Uwzględnianie smart_questions

## Architecture / Approach

Server-side only: `dashboard.astro` frontmatter wywołuje `getRecommendedExerciseType(supabase, userId)` — jedno zapytanie Supabase z GROUP BY (via zliczanie w JS po pobraniu completions). Wynik przekazywany jako prop `isRecommended` do `ExerciseCard`. Brak stanu client-side, brak nowych endpointów.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Service + Badge | `recommendationService.ts` + ExerciseCard z prop | JOIN pattern może wymagać weryfikacji z Supabase TypeScript |
| 2. Dashboard Integration | Pełny flow: obliczenie → renderowanie | Jeden dodatkowy request przy load dashboardu |

**Prerequisites:** S-01 ✓, S-02 ✓ (completions w DB, 3 typy na dashboardzie)
**Estimated effort:** ~1 sesja, 2 fazy

## Open Risks & Assumptions

- Supabase JOIN `exercises!inner(exercise_type)` z filtrem `.in()` — wzorzec działa w progressService, ale filter po join'owanej kolumnie może wymagać innej składni (weryfikacja w Phase 1)
- Jeśli `result.error` → graceful fallback na `"animated_pacer"` zamiast crash

## Success Criteria (Summary)

- Dashboard pokazuje dokładnie jeden badge "Recommended"
- Cold-start: animated_pacer; po sesjach: least-used type
- `npm run build` przechodzi bez błędów
