# CS4261 / CS5461 Practice Studio

A static practice site for NUS **CS4261 / CS5461 Algorithmic Mechanism Design**, covering Midterms 1 and 2.

The layout follows [CS3210 Practice Studio](https://github.com/chongtzezhao/cs3210-practice-studio): a light green theme, a practice-map sidebar, and one question at a time.

The bank contains **52 questions and 340 marks across 9 practice sets**. The original question formats, saved responses, and storage keys remain unchanged.

## Midterm 1

The original 33 questions (224 marks) cover Weeks 1–3 and Assignments 1–3:
- **Set 1 (Practice Paper 1 · 40 Marks):** Rapid-Fire MCQ Diagnostic Mode with instant score feedback and examination misconception alerts.
- **Set 2 (Practice Paper 2 · 40 Marks):** Infinite Nash continua, VCG multi-unit collusion, randomized facility location, and Rosenthal potential functions.
- **Set 3 (Practice Paper 3 · 40 Marks):** Iterated elimination of weakly dominated strategies, VCG revenue collapse paradox, and midpoint manipulation.
- **Set 4 (Practice Paper 4 · 40 Marks):** Mixed strategy inspection paradox, ascending auction communication complexity, and odd-$n$ median strategyproofness.
- **Set 5 (Practice Paper 5 · 40 Marks):** Public goods dilemmas, VCG public project deficits, geometric lower bound ratio 2, and general VCG DSIC proofs.
- **Set 6 (Capstone Challenges & 4x4 Mastery · 24 Marks):** 4x4 normal-form game with chained mixed strategy elimination, generalized randomized facility location boundary theorem, and asynchronous potential convergence vs. simultaneous cycling.

## Midterm 2

The new 19 questions (116 marks) follow the scope in `midterm2-logistics.pdf`. Each includes concept tags, course references, and a worked answer.

- **Set 7 (Paper 1 · 40 marks):** Induced subgraph games, weighted voting games, Shapley values, core constraints, curved bargaining frontiers, stable matching, EF1/EFX, and an 8-mark round-robin proof.
- **Set 8 (Paper 2 · 40 marks):** Parametric cooperative games, maximin shares, round-robin allocations, welfare objectives, proposer optimality, core geometry, and an 8-mark stable-matching uniqueness proof.
- **Set 9 (Topic mastery · 36 marks):** Concept drills plus Assignment 8 welfare/MMS calculations, an 8-mark proof about Pareto-optimal MMS allocations, and strong EF1 questions.

These are adapted practice questions, not official exam questions. References identify lecture PDF pages and assignment questions. Source PDFs are not distributed with the site.

Sources: Week 4–5 lecture, Week 7 lecture, Week 8 lecture, and Assignments 4–8. Cake cutting is outside the listed Midterm 2 scope.

## Key Features

- **Instant Validation:** Interactive answer inputs with mathematical tolerance checking for numbers, decimals, fractions, and tuples.
- **Paper 1 Rapid-Fire Diagnostic:** Full-on MCQ mode with instant green/red validation and targeted misconception alerts explaining common exam traps.
- **Authentic Yes/No Penalty Scoring:** 3-way decision buttons (`Yes`, `No`, `Don't know`) with authentic NUS midterm scoring (+2 / 0 / +1).
- **Proof Blueprints & 8-Mark Rubrics:** Full text drafting area, word counter, complete blackboard-style worked proofs, and 0–8 self-scoring buttons.
- **KaTeX Mathematical Typesetting:** Renders matrices, equations, fractions, and potential functions.
- **Tagged Practice:** Filter by midterm, concept tag, question type, difficulty, topic, practice set, and week. Selecting a midterm limits the topic, concept, set, and week options to its bank.
- **Randomized Practice:** Fisher–Yates shuffles the full bank once at page load. Filters keep that order. Previous/Next buttons and left/right arrow keys move between questions.
- **Dual Theme:** Light green mode by default, with a dark theme and saved theme preference.
- **100% Client-Side & Private:** Saves progress in `localStorage`. Includes one-click Markdown export formatted for LLM grading and JSON backup/restore.

Existing responses and backups remain compatible through the original CS4261 storage keys. Editing a calculation clears its previous verification result. Proof drafts are not automatically graded.

## Files

- `index.html`: page structure and font/math resources.
- `styles.css`: responsive themes and practice controls.
- `app.js`: navigation, filtering, validation, scoring, persistence, and exports.
- `questions.json`: both question banks, concept tags, midterm/set metadata, source references, subparts, solutions, proof blueprints, and rubrics.

## Use Locally

Serve this directory with a static web server. Direct file access does not support fetching the question bank. For example:

```sh
npx --yes serve .
```

Open the local URL printed by the server. No build step or API keys are required. Google Fonts and KaTeX load from external CDNs.

## Verify the bank

Run the schema and mathematical checks with Node.js:

```sh
node --test tests/questions.test.cjs
```

## GitHub Pages

The repository publishes the root directory of `main` through its existing GitHub Pages configuration. The site is available at [CS4261 Practice Studio](https://chongtzezhao.github.io/cs4261-practice-studio/).
