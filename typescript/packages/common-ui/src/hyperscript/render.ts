import { Cancel, combineCancels } from '@commontools/common-frp';
import { Signal, effect } from '@commontools/common-frp/signal';
import { isSignalBinding, VNode } from './view.js';
import { getViewByTag } from './known-tags.js';

export type RenderContext = Record<string, Signal<any>>

export const __cancel__ = Symbol('cancel');

/**
 * Render vnode with a context containing reactive data sources and primitive
 * values.
 * @returns HTMLElement
 */
export const render = (
  vnode: VNode,
  context: RenderContext
): HTMLElement => {
  // Make sure we have a view for this tag. If we don't it is not whitelisted.
  const view = getViewByTag(vnode.tag);

  if (typeof view !== 'function') {
    throw new TypeError(`Unknown tag: ${vnode.tag}`);
  }

  // Validate props against the view's schema.
  if (!view.validateProps(vnode.props)) {
    throw new TypeError(`Invalid props for tag: ${vnode.tag}.
      Props: ${JSON.stringify(vnode.props)}`);
  }

  // Create the element
  const element = document.createElement(vnode.tag);

  // Bind each prop to a reactive value (if any) and collect cancels
  const cancels: Array<Cancel> = [];
  for (const [key, value] of Object.entries(vnode.props)) {
    if (isSignalBinding(value)) {
      const boundValue = context[value.name];
      if (boundValue != null) {
        const cancel = effect([boundValue], (value) => {
          setProp(element, key, value);
        });
        cancels.push(cancel);
      }
    } else {
      setProp(element, key, value);
    }
  }

  // Combine cancels and store on element.
  const cancel = combineCancels(cancels);
  // @ts-ignore
  element[__cancel__] = cancel;

  for (const child of vnode.children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(render(child, context));
    }
  }

  return element;
}

export default render;

const setProp = (element: HTMLElement, key: string, value: any) => {
  // @ts-ignore
  element[key] = value;
}