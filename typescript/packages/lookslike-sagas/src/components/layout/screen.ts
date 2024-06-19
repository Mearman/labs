import { LitElement, html, css } from "lit";
import {customElement} from "lit/decorators.js";

@customElement("common-screen")
export class ScreenElement extends LitElement {
  static override styles = css`
  :host {
    display: block;
    container-type: inline-size;
    container-name: screen;
    width: 100vw;
    height: 100vh;
  }
  `;

  override render() {
    return html`<slot></slot>`;
  }
}