import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ref, createRef, Ref } from "lit/directives/ref.js";
import { style } from "@commontools/common-ui";
import { render } from "@commontools/common-html";
import { Gem, ID, UI } from "../data.js";
import { CellImpl, isCell } from "../runner/index.js";
//import { annotation } from "../components/annotation.js";

@customElement("common-window-manager")
export class CommonWindowManager extends LitElement {
  static override styles = [
    style.baseStyles,
    css`
      :host {
        display: flex;
        overflow-x: auto;
        overflow-y: visible;
        width: 100%;
        height: 95vh;
        padding: 20px 0; /* Add vertical padding */
      }
      .window {
        flex: 0 0 auto;
        width: 25%;
        min-width: 300px;
        height: 95%; /* Make the window full height */
        margin-left: 20px;
        margin-bottom: 20px;
        border: 1px solid #e0e0e0;
        border-radius: var(--radius);
        background-color: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(10px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1), 0 6px 6px rgba(0, 0, 0, 0.1),
          0 0 0 1px rgba(0, 0, 0, 0.05);
        transition: all 0.3s ease;
        overflow: hidden;
      }
      .close-button {
        z-index: 1;
        position: absolute;
        top: 8px;
        right: 8px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: rgba(0, 0, 0, 0.1);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.4);
        font-weight: bold;
        transition: all 0.2s ease;
      }
      .close-button:hover {
        background-color: rgba(0, 0, 0, 0.15);
        color: rgba(0, 0, 0, 0.6);
      }
    `,
  ];

  @property({ type: Array })
  sagas: CellImpl<Gem>[] = [];

  private sagaRefs: Map<string, Ref<HTMLElement>> = new Map();
  private newSagaRefs: [CellImpl<Gem>, Ref<HTMLElement>][] = [];

  override render() {
    const idCounts: { [key: string]: number } = {};
    return html`
      ${this.sagas.map((saga) => {
        const sagaId = saga.getAsProxy()[ID];
        idCounts[sagaId] ??= 0;
        const id = sagaId + "#" + idCounts[sagaId]++;

        // Create a new ref for this saga
        let sagaRef = this.sagaRefs.get(id);
        if (!sagaRef) {
          sagaRef = createRef<HTMLElement>();
          this.sagaRefs.set(id, sagaRef);
          this.newSagaRefs.push([saga, sagaRef]);
        }

        const annotationUI = ""; /*annotation({
          query: saga[NAME] as string,
          data: Object.fromEntries(
            Object.entries(saga).filter(
              ([key]: (string | Symbol)[]) =>
                key !== ID && key !== NAME && key !== "UI"
            )
          ),
          target: saga[ID],
        });*/
        return html`
          <div class="window" id="${id}">
            <button class="close-button" @click="${this.onClose}">×</button>
            <common-screen-element>
              <common-system-layout>
                <div ${ref(sagaRef)}></div>
                <div slot="secondary">${annotationUI}</div>
                <common-unibox slot="search" value="" placeholder="" label=">">
              </common-system-layout>
            </common-screen-element>
          </div>
        `;
      })}
    `;
  }

  openSaga(saga: CellImpl<Gem>) {
    this.sagas = [...this.sagas, saga];
    this.updateComplete.then(() => {
      while (this.newSagaRefs.length > 0) {
        const [saga, sagaRef] = this.newSagaRefs.pop()!;
        const view = saga.asSimpleCell<Gem>();
        console.log("UI", view.get()[UI]);
        render(sagaRef.value!, view.get()[UI]);
      }

      const newWindow = this.renderRoot.querySelector(".window:last-child");
      if (newWindow) {
        newWindow.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "start",
        });
      }
    });
  }

  onClose(e: Event) {
    const id = (e.currentTarget as HTMLElement).parentElement?.id;
    if (id) {
      const idCounts: { [key: string]: number } = {};

      this.sagas = this.sagas.filter((saga) => {
        const sagaId = saga.getAsProxy()[ID];

        idCounts[sagaId] ??= 0;
        const sagaID = sagaId + "#" + idCounts[sagaId]++;
        return sagaID !== id;
      });
    }
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener("open-saga", this.handleAddWindow);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("open-saga", this.handleAddWindow);
  }

  private handleAddWindow(e: Event) {
    const saga = (e as CustomEvent).detail.saga;
    if (isCell(saga)) {
      this.openSaga(saga);
    }
  }
}
