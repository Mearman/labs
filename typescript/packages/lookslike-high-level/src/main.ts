import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { view, tags, render } from "@commontools/common-ui";
// import "@commontools/lookslike-sagas";
import { dataGems } from "./data.js";
import { isGem, Gem, ID } from "./recipe.js";
const { binding } = view;
const { include } = tags;

document.addEventListener("DOMContentLoaded", () => {
  const windowManager = document.getElementById(
    "window-manager"
  )! as CommonWindowManager;
  windowManager.openGem(dataGems.get()["recipe list"]!);
});

@customElement("common-window-manager")
export class CommonWindowManager extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      overflow-x: auto;
      width: 100%;
    }
    .window {
      flex: 0 0 auto;
      width: 300px;
      margin-right: 10px;
      border: 1px solid #ccc;
    }
  `;

  @property({ type: Array })
  gems: Gem[] = [];

  private renderedGems: { [key: string]: HTMLElement } = {};

  override render() {
    return html`
      ${this.gems.map((gem) => {
        if (!this.renderedGems[gem[ID]])
          this.renderedGems[gem[ID]] = render.render(
            include({ content: binding("UI") }),
            {
              UI: gem.UI,
            }
          ) as HTMLElement;

        return html`
          <div class="window" id="${gem[ID]}">
            <common-screen-element>
              <common-app-element>
                ${this.renderedGems[gem[ID]]}
              </common-app-element>
            </common-screen-element>
          </div>
        `;
      })}
    `;
  }

  openGem(gem: Gem) {
    this.gems = [...this.gems, gem];
    this.updateComplete.then(() => {
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

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener("open-gem", this.handleAddWindow);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("open-gem", this.handleAddWindow);
  }

  private handleAddWindow(e: Event) {
    const gem = (e as CustomEvent).detail.content;
    if (isGem(gem)) {
      this.openGem(gem);
    }
  }
}

@customElement("common-screen")
export class CommonScreenElement extends LitElement {
  static override styles = css`
    :host {
      display: block;
      container-type: size;
      container-name: screen;
      width: 100vw;
      height: 100vh;
    }
  `;

  override render() {
    return html`<slot></slot>`;
  }
}

@customElement("common-app")
export class CommonAppElement extends LitElement {
  static override styles = [
    css`
      :host {
        display: block;
        height: 100%;
        width: 100%;
      }

      .app {
        display: grid;
        height: 100%;
        width: 100%;
        grid-template-columns: 1fr;
        grid-template-rows: 1fr min-content min-content;
        grid-template-areas:
          "primary"
          "secondary"
          "search";
      }

      .app-primary {
        grid-area: primary;
        overflow: auto;
        container-type: size;
        container-name: app-primary;
      }

      .app-secondary {
        grid-area: secondary;
        container-type: inline-size;
      }

      .app-search {
        grid-area: search;
        container-type: inline-size;
        background-color: var(--secondary-background);
        display: block;
        padding: var(--gap);
      }
    `,
  ];

  override render() {
    return html`
      <div class="app">
        <main class="app-primary">
          <slot></slot>
        </main>
        <nav class="app-secondary">
          <slot name="secondary"></slot>
        </nav>
        <nav class="app-search">
          <slot name="search"></slot>
        </nav>
      </div>
    `;
  }
}
