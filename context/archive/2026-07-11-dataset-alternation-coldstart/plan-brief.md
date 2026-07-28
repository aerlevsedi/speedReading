# Dataset Alternation and Cold-Start — Plan Brief

> Full plan: `context/changes/dataset-alternation-coldstart/plan.md`
> Research: `context/changes/dataset-alternation-coldstart/research.md`

## What & Why

Dwa ryzyka z §2 Quality Contract nie mają jeszcze testów: Risk #4 (algorytm alternacji datasetów może zwracać zawsze ten sam dataset — regresja niewidoczna) i Risk #5 (dashboard nowego użytkownika może crashować gdy historia completions jest pusta). Testy muszą udowodnić poprawność przez HTTP, a nie przez bezpośrednie wywołanie serwisu, bo tylko tak można wykryć regresję w pełnym stacku.

## Starting Point

Infrastruktura testów (Vitest, globalSetup, adminClient, createFixtureUser, createFixtureCompletion) jest w pełni gotowa — wypracowana w Fazie 1 i 2. Cookie injection pattern istnieje w `completion-pipeline.test.ts:39-48`. Algorytm alternacji żyje w `src/lib/services/exerciseService.ts:9-49` i jest eksponowany przez HTTP jako `GET /api/exercises/next-for-type?type=<type>`. Seeded exercises z deterministycznymi UUID-ami pokrywają 3 typy × 2 datasety.

## Desired End State

5 nowych testów integracyjnych przechodzi: 4 dla alternacji (cold-start, d1→d2, d2→d1, izolacja per-type) i 1 dla cold-start dashboardu (status 200 + exercise card widoczna). `tests/helpers/fixtures.ts` eksportuje nazwane stałe dla wszystkich 6 exercise ID-ów. Cookbook §6.6 i §6.7 są wypełnione. §3 Phase 3 w test-plan.md pokazuje `complete`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Jakie typy testować alternację | animated_pacer (full) + focus_sprint (izolacja only) | Algorytm identyczny dla wszystkich typów — jeden type wystarczy; izolacja per-type to osobna reguła oracle | Plan |
| Granulacja alternation tests | 3 oddzielne it() + 1 it() dla izolacji | Każdy it() łapie inną regresję; gdy jeden padnie, wiadomo dokładnie która reguła jest złamana | Plan |
| Stan DB między it() | beforeEach delete completions | Każdy it() musi zaczynać od pustego stanu; bez cleanup stan z poprzedniego it() zafałszowałby wynik | Plan |
| Głębokość asercji cold-start | status 200 + html.includes("/exercise/") | Sam status 200 nie dowodzi że exercise cards zostały wyrenderowane; href w linku karty to stabilna, PRD-grounded asercja | Plan |
| Cookie injection | Reuse wzorca z completion-pipeline.test.ts | Identyczny mechanizm auth — brak powodu do nowego podejścia | Research |
| Smart Questions excluded | Nie testować tego typu | Usunięte z UI 2026-06-08; ryzyko nie istnieje dla użytkownika | Research |

## Scope

**In scope:**
- `tests/helpers/fixtures.ts` — 6 nowych stałych exercise ID
- `tests/integration/dataset-alternation.test.ts` — 4 testy
- `tests/integration/dashboard-coldstart.test.ts` — 1 test
- Cookbook §6.6, §6.7 + §3 Phase 3 → complete

**Out of scope:**
- focus_sprint i speed_scan end-to-end alternation (identyczny algorytm, redundancja)
- results page cold-start (nie jest cold-start entry point)
- CI gate (Faza 4, osobna zmiana)
- Mockowanie Supabase client

## Architecture / Approach

Oba pliki testów dziedziczą wzorzec z `completion-pipeline.test.ts`: `beforeAll` tworzy fixture usera i zbiera cookie przez signin, `afterAll` usuwa usera (cascade czyści completions). Test alternacji dodaje `beforeEach` do czyszczenia completions między `it()` blokami — kluczowe, bo każdy test musi zaczynać od pustej historii. Alternacja asertowana jest przez `body.dataset_id` z odpowiedzi JSON endpointu. Cold-start test asertuje `html.includes("/exercise/")` w ciele strony.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Exercise ID constants + alternation tests | 4 testy alternacji + stałe fixtures | beforeEach cleanup musi trafić w completions aktualnego usera, nie w seed data |
| 2. Cold-start dashboard test | 1 test cold-start renderowania | Konieczność zachowania cookie z beforeAll — brak state shared między fazie |
| 3. Cookbook + rollout sync | §6.6, §6.7, §3 Phase 3 complete | Brak ryzyk |

**Prerequisites:** Lokalne Supabase z seed migrations (`npx supabase start`), dev server na porcie 4322 (globalSetup startuje automatycznie).  
**Estimated effort:** ~1 sesja, 3 fazy.

## Open Risks & Assumptions

- `GET /api/exercises/next-for-type` zwraca `dataset_id` w JSON — pewne (endpoint robi `select("*")` na tabeli exercises, a `dataset_id` jest kolumną tabeli), ale niezweryfikowane przez test przed implementacją.
- Cookie injection działa identycznie dla tego endpointu co dla `/api/exercises/complete` — bardzo prawdopodobne (ten sam middleware auth), potwierdzone przy pierwszym uruchomieniu testów.

## Success Criteria (Summary)

- `npm test` zielony z 5 nowymi testami
- Destructive verify dla alternacji: zmiana oczekiwanego datasetu w cold-start `it()` → test czerwony; przywrócenie → zielony
- §3 Phase 3 w test-plan.md pokazuje `complete`
