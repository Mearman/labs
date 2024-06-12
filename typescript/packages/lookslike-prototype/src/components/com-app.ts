import { LitElement, html } from "lit-element";
import { customElement, state } from "lit/decorators.js";
import { base } from "../styles.js";

import { NodePath, Recipe, RecipeNode, emptyGraph } from "../data.js";
import { processUserInput } from "../llm.js";
import { collectSymbols } from "../graph.js";
import { Context, snapshot } from "../state.js";
import { watch } from "@commontools/common-frp-lit";
import { SignalSubject } from "../../../common-frp/lib/signal.js";
import { codePrompt, plan, prepareSteps } from "../plan.js";
import { thoughtLog } from "../model.js";
import {
  CONTENT_TYPE_FETCH,
  CONTENT_TYPE_GLSL,
  CONTENT_TYPE_JAVASCRIPT,
  CONTENT_TYPE_LLM,
  CONTENT_TYPE_UI
} from "../contentType.js";

const lastFmKey = "0060ba224307ff9f787deb837f4be376";

@customElement("com-app")
export class ComApp extends LitElement {
  static override styles = [base];

  static override properties = {
    graph: { type: Object },
    userInput: { type: String },
    snapshot: { type: Object }
  };

  @state() graph: Recipe = emptyGraph;
  @state() userInput = "";
  @state() snapshot: Context<SignalSubject<any>> = {
    inputs: {},
    outputs: {},
    cancellation: []
  };

  availableFunctions(graph: Recipe) {
    const updateGraph = this.updateGraph.bind(this);

    return {
      listNodes: () => {
        console.log("listNodes", this.graph);
        return JSON.stringify(this.graph);
      },
      addConnection: ({
        fromOutput,
        toInput
      }: {
        fromOutput: string;
        toInput: NodePath;
      }) => {
        console.log("addConnection", fromOutput, toInput);
        const [toNodeId, toInputKey] = toInput;
        const fromNode = graph.find((node) => node.id === fromOutput);
        if (!fromNode) {
          return `Node ${fromOutput} not found.\n${this.graphSnapshot()}`;
        }
        const toNode = graph.find((node) => node.id === toNodeId);
        if (!toNode) {
          return `Node ${toNode} not found.\n${this.graphSnapshot()}`;
        }

        toNode.in[toInputKey] = [".", fromOutput];
        updateGraph(graph);
        return `Added connection from ${fromOutput} to ${toInput}.\n${this.graphSnapshot()}`;
      },
      addCodeNode: (props: { id: string; code: string }) => {
        console.log("addCodeNode", props);
        const { id, code } = props;
        graph.push({
          id,
          contentType: CONTENT_TYPE_JAVASCRIPT,
          in: {},
          outputType: {},
          body: code
        });
        updateGraph(graph);
        return `Added node: ${id}.\n${this.graphSnapshot()}`;
      },
      addUiNode: (props: { id: string; uiTree: object }) => {
        console.log("addUiNode", props);
        const { id, uiTree } = props;
        graph.push({
          id,
          contentType: CONTENT_TYPE_UI,
          in: {},
          outputType: {},
          body: uiTree
        });
        updateGraph(graph);
        return `Added node: ${id}.\n${this.graphSnapshot()}`;
      },
      addGlslShaderNode: ({
        id,
        shaderToyCode
      }: {
        id: string;
        shaderToyCode: string;
      }) => {
        console.log("addGlslShaderNode", id, shaderToyCode);
        graph.push({
          id,
          contentType: CONTENT_TYPE_GLSL,
          in: {},
          outputType: {},
          body: shaderToyCode
        });
        updateGraph(graph);
        return `Added node: ${id}.\n${this.graphSnapshot()}`;
      },
      addFetchNode: ({ id, url }: { id: string; url: string }) => {
        console.log("addFetchNode", id, url);
        graph.push({
          id,
          contentType: CONTENT_TYPE_FETCH,
          in: {},
          outputType: {
            type: "object"
          },
          body: url
        });
        updateGraph(graph);
        return `Added node: ${id}.\n${this.graphSnapshot()}`;
      },
      addLanguageModelNode: ({
        id,
        promptSource
      }: {
        id: string;
        promptSource: string;
      }) => {
        console.log("addLanguageModelNode", id, prompt);
        graph.push({
          id,
          contentType: CONTENT_TYPE_LLM,
          in: {
            prompt: [".", promptSource]
          },
          outputType: {
            type: "string"
          },
          body: ""
        });
        updateGraph(graph);
        return `Added node: ${id}.\n${this.graphSnapshot()}`;
      },
      addImageGenerationNode: ({
        id,
        promptSource
      }: {
        id: string;
        promptSource: string;
      }) => {
        console.log("addImageGenerationNode", id, prompt);
        graph.push({
          id,
          contentType: "application/json+vnd.common.image",
          in: {
            prompt: [".", promptSource]
          },
          outputType: {
            type: "string"
          },
          body: ""
        });
        updateGraph(graph);
        return `Added node: ${id}.\n${this.graphSnapshot()}`;
      },
      addMusicSearchNode: ({ id, query }: { id: string; query: string }) => {
        console.log("addMusicSearchNode", id, query);
        graph.push({
          id,
          contentType: "application/json+vnd.common.fetch",
          in: {},
          outputType: {
            type: "object",
            properties: {
              results: {
                type: "object",
                properties: {
                  albummatches: {
                    type: "object",
                    properties: {
                      albums: {
                        type: "array",
                        items: {
                          type: "object"
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          body: `https://ws.audioscrobbler.com/2.0/?method=album.search&album=${query}&api_key=${lastFmKey}&format=json`
        });
        updateGraph(graph);
        return `Added node: ${id}.\n${this.graphSnapshot()}`;
      },
      deleteNode: ({ id }: { id: string }) => {
        console.log("deleteNode", id);
        const index = graph.findIndex((n) => n.id === id);
        graph.splice(index, 1);
        updateGraph(graph);
        return `Deleted node: ${id}.\n${this.graphSnapshot()}`;
      }
    };
  }

  updateGraph(graph: Recipe) {
    // loop over graph and dedupe and repeated IDs, preferring the last one
    // preserve the original ordering
    console.log("deduping", graph);
    const deduped = graph.reduce((acc, node) => {
      const index = acc.findIndex((n) => n.id === node.id);
      if (index !== -1) {
        acc[index] = node;
      } else {
        acc.push(node);
      }
      return acc;
    }, [] as Recipe);

    console.log("deduped graph", deduped);

    this.graph = JSON.parse(JSON.stringify(deduped));
    this.requestUpdate();
  }

  graphSnapshot() {
    return `\`\`\`json${JSON.stringify(this.graph)}\`\`\``;
  }

  async appendMessage() {
    const userInput = this.userInput;
    this.userInput = "";

    const newGraph = [...this.graph];
    const symbols = collectSymbols(this.graph);
    symbols.reverse();

    const spec = await plan(userInput, prepareSteps(userInput, this.graph));
    const finalPlan = spec?.[spec?.length - 1];
    console.log("finalPlan", finalPlan);
    const input = `Implement the following plan using the available tools: ${finalPlan?.content} --- Current graph: ${this.graphSnapshot()}`;

    const systemContext = `Prefer to send tool calls in serial rather than in one large block, this way we can show the user the nodes as they are created.`;

    this.graph = newGraph;

    const result = await processUserInput(
      input,
      codePrompt + systemContext,
      this.availableFunctions(newGraph)
    );
    console.log("result", result);
  }

  override render() {
    const setUserInput = (input: string) => {
      this.userInput = input;
    };

    const setContext = (context: Context<any>) => {
      this.snapshot = snapshot(context);
    };

    return html`
      <com-app-grid>
        <com-chat slot="main">
          <com-thread
            slot="main"
            .graph=${this.graph}
            .setContext=${setContext}
          ></com-thread>
          <div slot="footer">
            <com-unibox>
              <com-editor
                slot="main"
                .value=${this.userInput}
                .setValue=${setUserInput}
              ></com-editor>
              <com-button slot="end" .action=${() => this.appendMessage()}
                >Send</com-button
              >
            </com-unibox>
          </div>
        </com-chat>
        <div slot="sidebar">
          <com-thought-log .thoughts=${watch(thoughtLog)}></com-thought-log>
        </div>
      </com-app-grid>
    `;
  }
}
