import {
  Recipe,
  RecipeFactory,
  NodeProxy,
  Value,
  CellProxy,
  isCell,
  Node,
  Module,
  Alias,
  toJSON,
} from "./types.js";
import { cell } from "./cell-proxy.js";
import {
  traverseValue,
  setValueAtPath,
  toJSONWithAliases,
  createJsonSchema,
  moduleToJSON,
  recipeToJSON,
} from "./utils.js";

/** Declare a recipe
 *
 * @param description A human-readable description of the recipe
 * @param fn A function that creates the recipe graph
 *
 * @returns A recipe node factory that also serializes as recipe.
 */
export function recipe<T>(
  description: string,
  fn: (input: Value<T>) => any
): RecipeFactory<T, ReturnType<typeof fn>>;
export function recipe<T, R>(
  description: string,
  fn: (input: Value<T>) => Value<R>
): RecipeFactory<T, R> {
  // The recipe graph is created by calling `fn` which populates for `inputs`
  // and `outputs` with Value<> (which containts CellProxy<>) and/or default
  // values.
  const state = cell<T & R>();
  const outputs = fn(state);

  // Next we need to traverse the inputs and outputs serialize the graph.

  // First, assign the outputs to the state cell.
  // TOOD: We assume no default values for top-level output for now.
  const stateValue = state.export().value ?? {};
  if (typeof stateValue !== "object")
    throw new Error("Inputs must be an object");
  if (outputs !== undefined && typeof outputs !== "object")
    throw new Error("Outputs must be an object or undefined");
  if (outputs) {
    state.set({
      ...stateValue,
      ...(outputs as R),
    } as Value<T & R>);
  }

  // Then traverse the value, collect all mentioned nodes and cells
  const cells = new Set<CellProxy<any>>();
  const nodes = new Set<NodeProxy>();

  const collectCellsAndNodes = (value: Value<any>) =>
    traverseValue(value, (value) => {
      if (isCell(value)) {
        cells.add(value);
        value.export().nodes.forEach((node: NodeProxy) => {
          if (!nodes.has(node)) {
            nodes.add(node);
            collectCellsAndNodes(node.inputs);
            collectCellsAndNodes(node.outputs);
          }
        });
        collectCellsAndNodes(value.export().value);
      }
    });
  collectCellsAndNodes(state);

  // Then assign paths on the recipe cell for all cells. For now we just assign
  // incremental counters, since we don't have access to the original variable
  // names. Later we might do something more clever by analyzing the code (we'll
  // want that anyway for extracting schemas from TypeScript).
  const paths = new Map<CellProxy<any>, PropertyKey[]>([[state, []]]);
  let count = 0;
  cells.forEach((cell) => {
    if (paths.has(cell)) return;
    const { top, path } = cell.export();
    if (!paths.has(top)) paths.set(top, [`__#${count++}`]);
    if (path.length) paths.set(cell, [...paths.get(top)!, ...path]);
  });

  // Now serialize the defaults and initial values, copying them from other
  // cells into the primary cell.
  const { value, defaultValue } = state.export();
  const initial = toJSONWithAliases(value, paths);
  const defaults = toJSONWithAliases(defaultValue, paths);

  cells.forEach((cell) => {
    // Only process roots of extra cells:
    if (cell === state) return;
    const { path, value, defaultValue } = cell.export();
    if (path.length > 0) return;

    const cellPath = [...paths.get(cell)!];
    if (value) setValueAtPath(initial, cellPath, value);
    if (defaultValue) setValueAtPath(defaults, cellPath, defaultValue);
  });

  const schema = createJsonSchema(defaults, initial);
  (schema as { description: string }).description = description;

  const serializedNodes = Array.from(nodes).map((node) => {
    const module = isCell(node.module)
      ? (toJSONWithAliases(node.module, paths) as Alias)
      : (node.module as Module);
    const inputs = toJSONWithAliases(node.inputs, paths);
    const outputs = toJSONWithAliases(node.outputs, paths);
    return { module, inputs, outputs } satisfies Node;
  });

  const recipe: Recipe & toJSON = {
    schema,
    initial,
    nodes: serializedNodes,
    toJSON: () => recipeToJSON(recipe),
  };
  const module: Module & toJSON = {
    type: "recipe",
    implementation: recipe,
    toJSON: () => moduleToJSON(module),
  };

  return Object.assign((inputs: Value<T>): Value<R> => {
    const outputs = cell<R>();
    const node: NodeProxy = { module, inputs, outputs };

    traverseValue(inputs, (value) => isCell(value) && value.connect(node));
    outputs.connect(node);

    return outputs;
  }, recipe) satisfies RecipeFactory<T, R>;
}
