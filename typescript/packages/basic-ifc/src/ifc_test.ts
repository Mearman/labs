import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  inferLabels,
  generateConstraints,
  type State,
  $label,
  type Node,
  makeLattice,
  join,
  meet,
  TOP,
  BOTTOM,
} from "./ifc.ts";

Deno.test("meet and join", () => {
  const lattice = makeLattice({
    public: ["trusted cloud"],
    "trusted cloud": ["cc", "openai", "anthropic"],
    cc: ["ondevice"],
  });

  assertEquals(meet(["public", "trusted cloud"], lattice), "public");
  assertEquals(meet(["trusted cloud", "cc"], lattice), "trusted cloud");
  assertEquals(meet(["cc", "ondevice"], lattice), "cc");
  assertEquals(meet(["public", "ondevice"], lattice), "public");

  assertEquals(join(["public", "trusted cloud"], lattice), "trusted cloud");
  assertEquals(join(["trusted cloud", "cc"], lattice), "cc");

  assertEquals(meet(["openai", "anthropic"], lattice), "trusted cloud");
  assertEquals(join(["openai", "anthropic"], lattice), TOP);

  // Google is not in the lattice
  assertEquals(meet(["public", "google"], lattice), BOTTOM);
  assertEquals(join(["public", "google"], lattice), TOP);
});

Deno.test("meet and join with type variables", () => {
  const lattice = makeLattice({
    public: ["trusted cloud"],
    "trusted cloud": ["cc", "openai", "anthropic"],
    cc: ["ondevice"],
  });

  assertEquals(meet(["$foo", "trusted cloud"], lattice), [
    "meet",
    ["$foo", "trusted cloud"],
  ]);

  assertEquals(meet(["$foo", "$bar"], lattice), ["meet", ["$foo", "$bar"]]);

  assertEquals(meet(["$foo", "public", "trusted cloud"], lattice), [
    "meet",
    ["$foo", "public"],
  ]);

  assertEquals(join(["$foo", "$foo"], lattice), ["join", ["$foo"]]);
});

Deno.test("generate constraints", () => {
  const initialState: State = {
    bar: {
      baz: {
        [$label]: {
          integrity: "trusted cloud",
          confidentiality: "trusted cloud",
        },
      },
      zab: {
        [$label]: { integrity: "public", confidentiality: "public" },
      },
    },
  };
  const bindings: Node[] = [{ in: ["bar.baz", "bar.zab"], out: ["foo"] }];

  const constraints = generateConstraints(initialState, bindings);

  assertEquals(constraints, [
    ["$bar.baz-integrity", "trusted cloud"],
    ["$bar.baz-confidentiality", "trusted cloud"],
    ["$bar.zab-integrity", "public"],
    ["$bar.zab-confidentiality", "public"],
    [
      "$foo-integrity",
      ["meet", ["$foo-integrity", "$bar.baz-integrity", "$bar.zab-integrity"]],
    ],
    [
      "$foo-confidentiality",
      [
        "join",
        [
          "$foo-confidentiality",
          "$bar.baz-confidentiality",
          "$bar.zab-confidentiality",
        ],
      ],
    ],
    ["$bar.baz-integrity", ["join", ["$bar.baz-integrity", "$foo-integrity"]]],
    [
      "$bar.baz-confidentiality",
      ["meet", ["$bar.baz-confidentiality", "$foo-confidentiality"]],
    ],
    ["$bar.zab-integrity", ["join", ["$bar.zab-integrity", "$foo-integrity"]]],
    [
      "$bar.zab-confidentiality",
      ["meet", ["$bar.zab-confidentiality", "$foo-confidentiality"]],
    ],
  ]);
});

Deno.test("infer labels", () => {
  // Example state and bindings
  const initialState = {
    bar: {
      baz: {
        label: { integrity: "trusted cloud", confidentiality: "trusted cloud" },
      },
      zab: {
        label: { integrity: "public", confidentiality: "public" },
      },
    },
  };

  const bindings: Node[] = [{ in: ["bar.baz", "bar.zab"], out: ["foo"] }];

  const lattice = makeLattice({
    public: ["trusted cloud"],
    "trusted cloud": ["cc", "openai", "anthropic"],
    cc: ["ondevice"],
  });
  /*
  const inferredState = inferLabels(initialState, bindings, lattice);

  assertEquals(inferredState, {
    bar: {
      baz: {
        label: { integrity: "trusted cloud", confidentiality: "trusted cloud" },
      },
      zab: {
        label: { integrity: "public", confidentiality: "public" },
      },
    },
    foo: {
      label: { integrity: "trusted cloud", confidentiality: "trusted cloud" },
    },
  });*/
});
