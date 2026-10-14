const test = require("node:test");
const assert = require("node:assert/strict");
const bank = require("../questions.json");
const question = (id) => bank.questions.find((q) => q.id === id);
const normalize = (value) => String(value).toLowerCase().replace(/\s/g, "");
function accepts(id, index, expected) {
  assert.ok(
    question(id).subparts[index].accepted.some(
      (value) => normalize(value) === normalize(expected),
    ),
    `${id} part ${index + 1}: expected ${expected}`,
  );
}
function permutations(values) {
  return values.length
    ? values.flatMap((value, index) =>
        permutations(values.filter((_, i) => i !== index)).map((rest) => [
          value,
          ...rest,
        ]),
      )
    : [[]];
}
function shapley(n, value) {
  const sums = Array(n).fill(0);
  const orders = permutations(Array.from({ length: n }, (_, i) => i));
  for (const order of orders) {
    let coalition = 0;
    for (const i of order) {
      const next = coalition | (1 << i);
      sums[i] += value(next) - value(coalition);
      coalition = next;
    }
  }
  return sums.map((sum) => sum / orders.length);
}
function vector(id, index) {
  return question(id)
    .subparts[index].accepted[0].replace(/[()]/g, "")
    .split(",")
    .map((value) => {
      const [a, b] = value.trim().split("/").map(Number);
      return b === undefined ? a : a / b;
    });
}
function close(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) =>
    assert.ok(
      Math.abs(value - expected[i]) < 1e-10,
      `${actual} differs from ${expected}`,
    ),
  );
}

test("question schema, marks, midterm tags, and source locations", () => {
  const ids = new Set();
  const pageCounts = {
    "week4-5-lecture.pdf": 46,
    "week7-lecture.pdf": 56,
    "week8-lecture.pdf": 27,
    "assignment4.pdf": 2,
    "assignment5.pdf": 1,
    "assignment6.pdf": 2,
    "assignment7.pdf": 2,
    "assignment8.pdf": 1,
  };
  for (const q of bank.questions) {
    assert.ok(!ids.has(q.id), `Duplicate question ${q.id}`);
    ids.add(q.id);
    assert.ok([1, 2].includes(q.midterm));
    assert.ok(q.tags.length && new Set(q.tags).size === q.tags.length);
    assert.equal(
      bank.practice_sets.find((set) => set.id === q.set)?.midterm,
      q.midterm,
    );
    if (q.type === "proof") {
      assert.ok(q.blueprint && q.rubric.length && q.reference);
      assert.equal(q.marks, 8);
    } else {
      assert.equal(
        q.subparts.reduce((sum, sp) => sum + sp.marks, 0),
        q.marks,
      );
      for (const sp of q.subparts) {
        assert.ok(!ids.has(sp.id), `Duplicate subpart ${sp.id}`);
        ids.add(sp.id);
        if (q.type === "short") assert.ok(sp.accepted?.length);
        else {
          assert.ok(sp.options.length >= 3 && sp.explanation);
          if (typeof sp.answer === "number") {
            assert.ok(
              Number.isInteger(sp.answer) &&
                sp.answer >= 0 &&
                sp.answer < sp.options.length,
            );
            assert.equal(new Set(sp.options).size, sp.options.length);
          } else assert.ok(sp.options.includes(sp.answer));
        }
      }
    }
    if (q.midterm === 2) {
      assert.ok(q.sources.length && q.origin === "Adapted practice");
      for (const source of q.sources) {
        assert.ok(source.title && pageCounts[source.document]);
        assert.ok(
          source.pages.length &&
            source.pages.every(
              (page) =>
                Number.isInteger(page) &&
                page >= 1 &&
                page <= pageCounts[source.document],
            ),
        );
      }
    }
  }
  const original = bank.questions.filter((q) => q.midterm === 1);
  assert.equal(original.length, 33);
  assert.equal(original.filter((q) => q.type === "short").length, 17);
  assert.equal(original.filter((q) => q.type === "proof").length, 6);
  assert.equal(
    original.reduce((sum, q) => sum + q.marks, 0),
    224,
  );
  for (const set of [7, 8])
    assert.equal(
      bank.questions
        .filter((q) => q.set === set)
        .reduce((sum, q) => sum + q.marks, 0),
      40,
    );
});

test("induced graph values, exact Shapley averages, cuts, and core membership", () => {
  const edges = [
    [0, 1, 4],
    [0, 2, -1],
    [1, 2, 3],
  ];
  const value = (mask) =>
    edges.reduce(
      (sum, [i, j, w]) => sum + ((mask >> i) & 1 && (mask >> j) & 1 ? w : 0),
      0,
    );
  close(vector("M2-P1-Q1", 0), [value(3), value(5), value(6), value(7)]);
  const payoff = shapley(3, value);
  close(vector("M2-P1-Q1", 1), payoff);
  const cuts = [1, 2, 4].map((mask) =>
    edges.reduce(
      (sum, [i, j, w]) =>
        sum + (((mask >> i) & 1) !== ((mask >> j) & 1) ? w : 0),
      0,
    ),
  );
  close(vector("M2-P1-Q1", 2), cuts);
  for (let mask = 0; mask < 8; mask++)
    assert.ok(
      payoff.reduce((sum, x, i) => sum + ((mask >> i) & 1 ? x : 0), 0) >=
        value(mask) - 1e-10,
    );
});

test("weighted voting veto players and Shapley pivotality", () => {
  const weights = [1, 2, 3, 4],
    total = weights.reduce((a, b) => a + b, 0);
  const value = (mask) =>
    Number(
      weights.reduce((sum, w, i) => sum + ((mask >> i) & 1 ? w : 0), 0) >= 9,
    );
  const veto = weights.flatMap((w, i) => (total - w < 9 ? [i + 1] : []));
  accepts("M2-P1-Q2", 0, veto.join(", "));
  close(vector("M2-P1-Q2", 2), shapley(4, value));
  assert.equal(value(14), 1);
  assert.ok(3 / 4 < value(14));
});

test("parametric game Shapley values and unique core at c=5", () => {
  const values = [0, 1, 2, 4, 3, 5, 5, 7];
  close(
    vector("M2-P2-Q1", 3),
    shapley(3, (mask) => values[mask]),
  );
  const core = vector("M2-P2-Q1", 2);
  // Pair {1,3} and singleton {2} force x2=2; pair {1,2} and singleton {3} force x1=2.
  assert.equal(values[7] - values[5], values[2]);
  assert.equal(values[3] - values[2], values[7] - values[2] - values[4]);
  for (let mask = 0; mask < 8; mask++)
    assert.ok(
      core.reduce((sum, x, i) => sum + ((mask >> i) & 1 ? x : 0), 0) >=
        values[mask],
    );
  const phi = shapley(3, (mask) => values[mask]);
  assert.ok(phi[0] + phi[1] < values[3]);
});

const students4 = {
  A: ["Z", "W", "Y", "X"],
  B: ["Z", "Y", "W", "X"],
  C: ["X", "Y", "Z", "W"],
  D: ["W", "Y", "X", "Z"],
};
const hospitals4 = {
  W: ["A", "B", "C", "D"],
  X: ["B", "D", "A", "C"],
  Y: ["B", "A", "C", "D"],
  Z: ["D", "C", "B", "A"],
};
function blockingPairs(students, hospitals, match) {
  const inverse = Object.fromEntries(
    Object.entries(match).map(([s, h]) => [h, s]),
  );
  return Object.keys(students).flatMap((s) =>
    Object.keys(hospitals)
      .filter(
        (h) =>
          students[s].indexOf(h) < students[s].indexOf(match[s]) &&
          hospitals[h].indexOf(s) < hospitals[h].indexOf(inverse[h]),
      )
      .map((h) => [s, h]),
  );
}
function stableMatchings(students, hospitals) {
  return permutations(Object.keys(hospitals))
    .map((order) =>
      Object.fromEntries(Object.keys(students).map((s, i) => [s, order[i]])),
    )
    .filter((match) => !blockingPairs(students, hospitals, match).length);
}
function deferredAcceptance(proposers, receivers) {
  const queue = Object.keys(proposers),
    next = Object.fromEntries(queue.map((s) => [s, 0])),
    held = {};
  while (queue.length) {
    const p = queue.shift(),
      r = proposers[p][next[p]++],
      previous = held[r];
    if (!previous || receivers[r].indexOf(p) < receivers[r].indexOf(previous)) {
      held[r] = p;
      if (previous) queue.push(previous);
    } else queue.push(p);
  }
  return Object.fromEntries(Object.entries(held).map(([r, p]) => [p, r]));
}
test("matching keys agree with independent deferred acceptance and exhaustive stability", () => {
  const blockers = blockingPairs(students4, hospitals4, {
    A: "Z",
    B: "Y",
    C: "X",
    D: "W",
  });
  assert.deepEqual(blockers, [["B", "Z"]]);
  accepts("M2-P1-Q4", 0, `(${blockers[0].join(", ")})`);
  const result = deferredAcceptance(students4, hospitals4);
  accepts(
    "M2-P1-Q4",
    1,
    `(${["A", "B", "C", "D"].map((s) => result[s]).join(", ")})`,
  );
  const stable = stableMatchings(students4, hospitals4);
  const zPartners = stable.map((match) =>
    Object.keys(match).find((s) => match[s] === "Z"),
  );
  const best = hospitals4.Z.find((s) => zPartners.includes(s));
  accepts("M2-P1-Q4", 2, best);
  const students = {
    A: ["X", "Y", "Z"],
    B: ["Y", "X", "Z"],
    C: ["X", "Y", "Z"],
  };
  const hospitals = {
    X: ["B", "A", "C"],
    Y: ["A", "B", "C"],
    Z: ["C", "A", "B"],
  };
  const studentResult = deferredAcceptance(students, hospitals);
  const hospitalResult = deferredAcceptance(hospitals, students);
  const inverse = Object.fromEntries(
    Object.entries(hospitalResult).map(([h, s]) => [s, h]),
  );
  accepts(
    "M2-P2-Q4",
    0,
    `(${["A", "B", "C"].map((s) => studentResult[s]).join(", ")})`,
  );
  accepts(
    "M2-P2-Q4",
    1,
    `(${["A", "B", "C"].map((s) => inverse[s]).join(", ")})`,
  );
  accepts("M2-P2-Q4", 2, stableMatchings(students, hospitals).length);
});

test("maximin shares by exhaustive partitions and round-robin fairness", () => {
  const values = [
    [11, 10, 5, 1],
    [1, 6, 1, 2],
    [8, 7, 4, 9],
  ];
  const mms = values.map((row) => {
    let best = 0;
    for (let partition = 0; partition < 3 ** 4; partition++) {
      const sums = [0, 0, 0];
      row.forEach((value, g) => {
        sums[Math.floor(partition / 3 ** g) % 3] += value;
      });
      best = Math.max(best, Math.min(...sums));
    }
    return best;
  });
  close(vector("M2-P2-Q2", 0), mms);
  const remaining = new Set([0, 1, 2, 3]),
    bundles = [[], [], []];
  for (let turn = 0; remaining.size; turn++) {
    const i = turn % 3;
    const good = [...remaining].sort((a, b) => values[i][b] - values[i][a])[0];
    bundles[i].push(good);
    remaining.delete(good);
  }
  const utility = (i, bundle) =>
    bundle.reduce((sum, g) => sum + values[i][g], 0);
  close(
    vector("M2-P2-Q2", 2),
    bundles.map((bundle, i) => utility(i, bundle)),
  );
  let ef = true,
    efx = true;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      if (utility(i, bundles[i]) < utility(i, bundles[j])) ef = false;
      for (const g of bundles[j])
        if (
          utility(i, bundles[i]) <
          utility(
            i,
            bundles[j].filter((h) => h !== g),
          )
        )
          efx = false;
    }
  accepts("M2-P2-Q2", 3, `(${ef ? "Yes" : "No"}, ${efx ? "Yes" : "No"})`);
});

test("bargaining keys maximize the stated objectives including boundaries", () => {
  const [x, y] = vector("M2-P1-Q3", 0);
  assert.ok(Math.abs(4 * x + Math.sqrt(y) - 1) < 1e-10);
  assert.ok(Math.abs((1 - 4 * x) * (1 - 12 * x)) < 1e-10);
  const product = x * y;
  for (let k = 0; k <= 10000; k++) {
    const trial = k / 40000,
      other = (1 - 4 * trial) ** 2;
    assert.ok(trial * other <= product + 1e-10);
    assert.ok(trial + other <= 1 + 1e-10);
  }
  accepts("M2-P1-Q3", 1, "(0, 1)");
  assert.ok(
    Math.abs(Number(question("M2-P1-Q3").subparts[2].accepted[1]) - product) <
      1e-6,
  );
  const expected = [
    [12, 0],
    [4, 4],
    [6, 3],
  ];
  expected.forEach((pair, i) => close(vector("M2-P2-Q3", i), pair));
  for (let k = 0; k <= 1200; k++) {
    const a = k / 100,
      b = (12 - a) / 2;
    assert.ok(
      a + b <= 12 + 1e-10 && Math.min(a, b) <= 4 + 1e-10 && a * b <= 18 + 1e-10,
    );
  }
});

test("Assignment 8 welfare and MMS keys agree with exhaustive allocations", () => {
  const values = [
    [40, 30, 20, 10],
    [0, 40, 30, 30],
    [30, 0, 20, 50],
  ];
  const allocations = [];
  const mms = [0, 0, 0];
  for (let mask = 0; mask < 3 ** 4; mask++) {
    const bundles = [[], [], []];
    for (let good = 0; good < 4; good++)
      bundles[Math.floor(mask / 3 ** good) % 3].push(good);
    const utilities = bundles.map((bundle, i) =>
      bundle.reduce((sum, good) => sum + values[i][good], 0),
    );
    allocations.push(utilities);
    for (let i = 0; i < 3; i++) {
      const worst = Math.min(
        ...bundles.map((bundle) =>
          bundle.reduce((sum, good) => sum + values[i][good], 0),
        ),
      );
      mms[i] = Math.max(mms[i], worst);
    }
  }
  accepts(
    "M2-D5",
    0,
    Math.max(...allocations.map((u) => u.reduce((a, b) => a + b, 0))),
  );
  accepts("M2-D5", 1, Math.max(...allocations.map((u) => Math.min(...u))));
  close(vector("M2-D5", 2), mms);
  const specified = [40, 30, 20];
  const meetsMms = specified.every((u, i) => u >= mms[i]);
  const paretoOptimal = !allocations.some(
    (u) =>
      u.every((x, i) => x >= specified[i]) &&
      u.some((x, i) => x > specified[i]),
  );
  accepts(
    "M2-D5",
    3,
    `(${meetsMms ? "Yes" : "No"}, ${paretoOptimal ? "Yes" : "No"})`,
  );
});
