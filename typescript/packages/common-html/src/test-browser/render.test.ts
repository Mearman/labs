import { assert, equal as assertEqual } from "./assert.js";
import { render } from "../render.js";
import { html } from "../html.js";
import { setDebug } from "../log.js";
//import state from "../state.js";

setDebug(true);

describe("render", () => {
  it("renders attributes", () => {
    const title = "world";
    const template = html`<button title="${title}">Hello</div>`;
    const element = render(template);
    assert(element instanceof HTMLButtonElement);
    assertEqual(element.getAttribute("title"), "world");
  });

  it("coerces attribute values to strings", () => {
    const title = 100;
    const template = html`<button title="${title}">Hello</div>`;
    const element = render(template);
    assert(element instanceof HTMLButtonElement);
    assertEqual(element.getAttribute("title"), "100");
  });

  // it("renders children as text nodes", () => {
  //   const name = "world";
  //   const template = html`<div>Hello, ${name}</div>`;
  //   const element = render(template);
  //   assert(element instanceof HTMLDivElement);
  //   assertEqual(element.textContent, "Hello, world");
  //   console.log(element.textContent);
  // });
});
