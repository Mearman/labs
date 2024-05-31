import { LitElement, html, css } from 'lit-element'
import { customElement, property } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import { base } from '../styles'
import { createElement } from '../ui'
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import pretty from 'pretty'
import { createRxJSNetworkFromJson } from '../graph'


function snapshot(ctx) {
  // grab values of behavior subjects
  // preserve literals

  const snapshot = {
    inputs: {},
    outputs: {}
  }
  for (const key in ctx.outputs) {
    const value = ctx.outputs[key].getValue()
    snapshot.outputs[key] = value
  }

  for (const key in ctx.inputs) {
    snapshot.inputs[key] = {}
    for (const inputKey in ctx.inputs[key]) {
      const value = ctx.inputs[key][inputKey].getValue()
      snapshot.inputs[key][inputKey] = value
    }
  }

  return snapshot

}

const styles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
  }

  /* temp styles, delete */
  .code {
    background: #f4f4f4;
    padding: 1rem;
    border-radius: 5px;
    font-size: 0.7rem;
    line-height: 1.5;
    margin-top: 1rem;
  }
`

function definitionToHtml(definition: any, context: any) {
  if (!definition) {
    return html`<pre>loading...</pre>`
  }

  if (definition.contentType === 'text/javascript') {
    const val = snapshot(context).outputs[definition.name]
    return html`<pre class="code">${JSON.stringify(val, null, 2)}</pre><hr><pre>${definition.body}</pre>`
  }
  if (definition.contentType === 'application/json+vnd.common.ui') {
    const el = createElement(definition.body, snapshot(context).outputs)

    return html`<div>${unsafeHTML(el.outerHTML)}</div><pre class="code">${pretty(el.outerHTML)}</pre>`
  }
  return html`<pre>${JSON.stringify(definition, null, 2)}</pre>`
}

@customElement('com-thread')
export class ComThread extends LitElement {
  static styles = [base, styles]

  @property({ type: Object }) graph = {} as any

  response(node, context) {
    if (node.definition) {
      return html`<com-response slot="response">
        ${definitionToHtml(node.definition, context)}
      </com-response>`
    } else {
      return html`<com-response slot="response">
        ${node.messages.filter(m => m.role !== 'user').map(m => m.content).join(' ')}
      </com-response>`
    }

  }

  render() {
    const sortedNodes = this.graph.order.map((orderId: string) =>
      this.graph.nodes.find((node: any) => node.id === orderId)
    );

    const context = createRxJSNetworkFromJson(this.graph)

    return html`
      ${repeat(
      sortedNodes,
      (node: any) => html`
          <com-thread-group>
            ${repeat(node.messages.filter(m => m.role === 'user'), (node: any) => {
        return html`<com-prompt slot="prompt">
                      ${node.content}
                    </com-prompt>`
      })}

            ${this.response(node, context)}
          </com-thread-group>
        `)
      }
    `
  }
}