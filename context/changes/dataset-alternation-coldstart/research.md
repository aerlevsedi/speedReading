---
date: 2026-07-11T11:30:00+02:00
researcher: aerlevsedi
git_commit: 477ae315213b3a9d00ba3ff81b3a98e1793b9500
branch: main
repository: 10xDevs
topic: "Dataset alternation and cold-start — oracle research for Risk #4 and Risk #5"
tags: [research, codebase, alternation, cold-start, exercise-service, dashboard, test-fixtures]
status: complete
last_updated: 2026-07-11
last_updated_by: aerlevsedi
---

# Research: Dataset Alternation and Cold-Start (Risk #4 & #5)

**Date**: 2026-07-11T11:30:00+02:00  
**Researcher**: aerlevsedi  
**Git Commit**: 477ae315213b3a9d00ba3ff81b3a98e1793b9500  
**Branch**: main  
**Repository**: 10xDevs

## Research Question

Co musi zachowywać się poprawnie, żeby testy dla Risk #4 (alternacja datasetów) i Risk #5 (cold-start) mogły udowodnić poprawność — bez kopiowania implementacji jako oracle?

---

## Summary

**Alternation (Risk #4):** Algorytm żyje w jednej funkcji: `getNextExerciseForType` w `src/lib/services/exerciseService.ts:9-49`. Logika jest prosta — jedno zapytanie do DB po ostatnią historię, ternary do alternacji, default na `dataset_1` przy pustej historii. Nie ma SQL-owej funkcji ani procedury — to czysty TypeScript + Supabase query. Test musi dowieść zachowanie przez API endpoint `GET /api/exercises/next-for-type?type=<type>`, nie przez bezpośrednie wywołanie serwisu (zbyt blisko implementacji).

**Cold-start (Risk #5):** Dashboard renderuje się bezpiecznie przy pustych completions — null guard na filtrowaniu exercises (`filter((ex): ex is Exercise => ex !== null)`) i check `exercises.length > 0` zanim nastąpi mapowanie. Strona wyników jest dostępna tylko po faktycznym ukończeniu ćwiczenia — nie jest cold-start entry point. Ryzyko cold-start leży wyłącznie w dashboardzie i (potencjalnie) w scenariuszu gdy żadne exercises nie są zwrócone przez serwis.

**Test strategy decision:**
- Risk #4: integracyjny (real DB + HTTP) — algorytm alternacji zależy od realnych wierszy w `exercise_completions`; mock skłamałby o stanie DB
- Risk #5: integracyjny (HTTP + real DB) — dashboard render przy authenticated session z 0 completions; nie można testować cold-start przez unit test renderera w oderwaniu od warstwy danych

---

## Detailed Findings

### Alternation Algorithm — `src/lib/services/exerciseService.ts`

**Pełna logika** (`src/lib/services/exerciseService.ts:9-49`):

```typescript
export async function getNextExerciseForType(
  supabase: SupabaseClient,
  userId: string,
  exerciseType: "animated_pacer" | "smart_questions" | "focus_sprint" | "speed_scan",
): Promise<Exercise | null>
```

**Krok 1 — query historii** (`src/lib/services/exerciseService.ts:15-22`):
```typescript
const historyResult = await supabase
  .from("exercise_completions")
  .select("exercise_id, exercises!inner(dataset_id)")
  .eq("user_id", userId)
  .eq("exercises.exercise_type", exerciseType)
  .order("completed_at", { ascending: false })
  .limit(1)
  .single();
```

**Krok 2 — alternation logic** (`src/lib/services/exerciseService.ts:24-33`):
```typescript
let selectedDataset = "dataset_1"; // cold-start default

if (historyResult.data) {
  const exercisesData = historyResult.data.exercises as unknown as { dataset_id?: string };
  const lastDataset = exercisesData.dataset_id ?? "dataset_1";
  selectedDataset = lastDataset === "dataset_1" ? "dataset_2" : "dataset_1";
}
```

**Krok 3 — fetch exercise** (`src/lib/services/exerciseService.ts:35-45`):
```typescript
const exerciseResult = await supabase
  .from("exercises")
  .select("*")
  .eq("exercise_type", exerciseType)
  .eq("dataset_id", selectedDataset)
  .limit(1)
  .single();
```

**Kluczowe właściwości algorytmu (oracle):**
- Brak completions → zawsze `dataset_1`
- Ostatnie completion dla `dataset_1` → zwraca `dataset_2`
- Ostatnie completion dla `dataset_2` → zwraca `dataset_1`
- Liczy się tylko **ostatnie** completion (ORDER BY completed_at DESC LIMIT 1), nie suma
- Alternacja jest **per exercise type** — historia `animated_pacer` nie wpływa na `focus_sprint`

### API Endpoint — `src/pages/api/exercises/next-for-type.ts`

Deleguje bezpośrednio do `getNextExerciseForType`. Query param: `?type=<exerciseType>`. Wymaga autentykacji (middleware chroni). Zwraca 200 z Exercise JSON lub 404.

Testy powinny trafić w ten endpoint przez HTTP — nie przez bezpośrednie importowanie serwisu.

### Dashboard — `src/pages/dashboard.astro`

**Wywołanie serwisu** (`src/pages/dashboard.astro:21-30`):
```typescript
const exerciseTypes = ["animated_pacer", "focus_sprint", "speed_scan"] as const;
// smart_questions removed 2026-06-08

const exercisePromises = exerciseTypes.map((type) =>
  getNextExerciseForType(supabase, user.id, type)
);
const exerciseResults = await Promise.all(exercisePromises);
exercises = exerciseResults.filter((ex): ex is Exercise => ex !== null);
```

**Render guard** (`src/pages/dashboard.astro:68-71`):
```astro
{exercises.length > 0
  ? exercises.map(...)
  : <p>No exercises available yet.</p>
}
```

**Cold-start path:** Nowy użytkownik (0 completions) → serwis dostaje pustą historię → domyślnie `dataset_1` → pobiera exercise z `dataset_1` → dashboard renderuje poprawnie. Jeśli exercise nie istnieje w DB — filter wyrzuca null, length check renderuje komunikat. Brak crash.

**Ważne:** Dashboard wywołuje serwis **bezpośrednio** (server-side import), nie przez HTTP endpoint. Test cold-start musi więc renderować stronę przez HTTP, nie testować serwisu w izolacji.

### Cold-Start Risk Assessment

| Punkt wejścia | Zachowanie przy 0 completions | Safe? |
|---|---|---|
| `GET /dashboard` (authenticated, 0 completions) | Serwis defaults do `dataset_1`, exercises zwrócone, dashboard renderuje | ✓ SAFE |
| `GET /dashboard` (0 completions, żadne exercises w DB) | filter nulls, length check, "No exercises available yet." | ✓ SAFE |
| `GET /results/[id]` | Wymaga completion ID z URL — nie jest cold-start entry | ✓ N/A |
| `GET /exercise/[id]` | Guard na braku exercise — redirect do dashboard | ✓ SAFE |
| React components (AnimatedPacer, FocusSprint, SpeedScan) | Receive non-null exercise — TS type gwarantuje content | ✓ SAFE |

**Wniosek:** Jedyne ryzyko cold-start leży na poziomie danych — jeśli `getNextExerciseForType` zwróci null dla wszystkich typów (np. brak seeds w DB), dashboard pokaże "No exercises available yet." zamiast crash. Lokalne Supabase z seed migrations ma wszystkie exercises, więc cold-start = nowy user + seeds = exercises widoczne.

---

## Code References

- `src/lib/services/exerciseService.ts:9-49` — pełna logika alternacji (oracle)
- `src/pages/api/exercises/next-for-type.ts:1-59` — HTTP endpoint delegujący do serwisu
- `src/pages/dashboard.astro:21-34` — wywołanie serwisu, obsługa null, render guard
- `src/pages/dashboard.astro:68-71` — empty-state render guard
- `src/types.ts:2-31` — `Exercise` interface (dataset_id, exercise_type)
- `src/types.ts:33-44` — `Completion` interface
- `tests/helpers/fixtures.ts:4` — `SEEDED_EXERCISE_ID = "a0000000-0000-0000-0000-000000000001"`
- `tests/helpers/fixtures.ts:60-82` — `createFixtureCompletion(admin, userId, exerciseId?)`
- `tests/helpers/supabase.ts:22-26` — `adminClient()`
- `tests/helpers/supabase.ts:28-33` — `authClient(jwt)`
- `tests/globalSetup.ts:3-4` — server port 4322, BASE_URL
- `vitest.config.ts:7-12` — test env, global setup, hook timeout
- `supabase/migrations/20260605000000_create_exercises_schema.sql:5-17` — schema exercises
- `supabase/migrations/20260605000000_create_exercises_schema.sql:30-38` — schema completions
- `supabase/migrations/20260607000000_seed_remaining_exercises.sql` — 7 dodatkowych exercises

---

## Architecture Insights

### Seeded Exercises — mapa ID do alternacji

Wszystkie exercises są seeded z deterministycznymi UUIDs (pattern: `a0000000-0000-0000-0000-0000000000XX`):

| ID | Type | Dataset |
|---|---|---|
| `a0000000-0000-0000-0000-000000000001` | animated_pacer | dataset_1 |
| `a0000000-0000-0000-0000-000000000002` | animated_pacer | dataset_2 |
| `a0000000-0000-0000-0000-000000000021` | focus_sprint | dataset_1 |
| `a0000000-0000-0000-0000-000000000022` | focus_sprint | dataset_2 |
| `a0000000-0000-0000-0000-000000000031` | speed_scan | dataset_1 |
| `a0000000-0000-0000-0000-000000000032` | speed_scan | dataset_2 |

Smart Questions (IDs `011`, `012`) są w DB ale NIE są surfowane w UI — pominąć w testach.

### Testowanie alternacji — wzorzec

Test alternacji **nie może** importować `getNextExerciseForType` bezpośrednio (mirror implementation). Musi trafić w `GET /api/exercises/next-for-type?type=animated_pacer` przez HTTP, z Cookie header (session), i sprawdzić `response.dataset_id` z odpowiedzi.

**Sekwencja dla testu alternacji:**
1. `createFixtureUser` → utwórz usera i zdobądź cookie przez signin
2. `GET /api/exercises/next-for-type?type=animated_pacer` (0 completions) → musi zwrócić exercise z `dataset_1`
3. `adminClient().from("exercise_completions").insert(...)` — wstaw completion z `exercise_id` dla `dataset_1`
4. `GET /api/exercises/next-for-type?type=animated_pacer` → musi zwrócić exercise z `dataset_2`
5. Wstaw completion dla `dataset_2`
6. `GET /api/exercises/next-for-type?type=animated_pacer` → musi wrócić do `dataset_1`

### Istniejące helpers vs. braki

**Dostępne:**
- `createFixtureUser(email, password)` — user + JWT + cookie flow
- `createFixtureCompletion(admin, userId, exerciseId?)` — wstawia completion; domyślnie SEEDED_EXERCISE_ID (dataset_1 animated_pacer)
- `adminClient()`, `authClient(jwt)` — oba gotowe
- Cookie injection pattern z `completion-pipeline.test.ts:39-48` — gotowy do reuse

**Brakuje:**
- Stałe dla exercise IDs po typach/datasetach — trzeba dodać do `tests/helpers/fixtures.ts` (np. `ANIMATED_PACER_DATASET1_ID`, `ANIMATED_PACER_DATASET2_ID` itd.)
- Funkcja `createFixtureCompletion` jest wystarczająca **jeśli** przekazujemy konkretne `exerciseId` — nie trzeba nowej funkcji; potrzeba tylko stałych

---

## Historical Context

`context/changes/all-exercise-types/plan.md:79-100` — Smart Questions usunięto z UI 2026-06-08 (brak treści do czytania). Seeds zostały w DB ale komponent jest martwy. Nie testować alternacji dla tego typu.

`context/archive/2026-06-05-exercise-data-model-seed/` — decyzja o użyciu TEXT CHECK zamiast PostgreSQL ENUM, JSONB dla config, indeks `(user_id, completed_at DESC)` jako wystarczający dla MVP.

---

## Oracle — Co testy MUSZĄ udowodnić (nie co code robi)

### Risk #4 — Dataset alternation

Oracle pochodzi z PRD FR-012 i roadmap S-06:

1. **Cold-start:** Gdy user nie ma żadnych completions dla danego exercise type → endpoint zwraca exercise z `dataset_1`
2. **Po dataset_1:** Gdy ostatnie completion usera dla tego type było z `dataset_1` → endpoint zwraca exercise z `dataset_2`
3. **Po dataset_2:** Gdy ostatnie completion usera dla tego type było z `dataset_2` → endpoint zwraca exercise z `dataset_1`
4. **Izolacja per type:** Completion dla `animated_pacer` NIE wpływa na wynik dla `focus_sprint`

### Risk #5 — Cold-start render

Oracle pochodzi z PRD §Cold-start handling i FR-005/FR-014/FR-015:

1. `GET /dashboard` z authenticated session i 0 completions → odpowiedź ma status `200`, nie `500`
2. HTML odpowiedzi zawiera exercise cards (seeds istnieją w DB) — dashboard nie jest pusty
3. `GET /dashboard` z authenticated session i 0 completions → nie zawiera stack trace ani error w body

---

## Open Questions

1. **Typ odpowiedzi `next-for-type`:** Endpoint zwraca pełny obiekt `Exercise` z `dataset_id` — czy `dataset_id` jest w domyślnym `select("*")`? Należy zweryfikować przy implementacji testu (prawie na pewno tak, bo exercises table ma `dataset_id` jako kolumnę).

2. **Cookie injection dla next-for-type:** Endpoint wymaga auth — czy pattern z completion-pipeline (signin + Set-Cookie) działa identycznie? Middleware chroni tę trasę przez PROTECTED_ROUTES lub przez własny guard. Zweryfikować przy implementacji.

3. **Czy test cold-start musi sprawdzić konkretne exercise cards?** Test-plan mówi "pages survive empty history without crashing" — wystarczy 200 + brak error w body. Asercja konkretnych exercise titles byłaby mirror seeda, nie oracle z PRD.
