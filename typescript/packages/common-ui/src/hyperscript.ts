import { knownTags, isKnownTags } from './known-tags.js';
import { pipe } from './util.js';
import { Cancel, combineCancels } from '@commontools/common-frp';
import { Signal, effect } from '@commontools/common-frp/signal';

export type Type = string;

export type Binding = {
  "@type": "binding";
  type: Type;
  name: string;
}

/** Is value a binding to a reactive value? */
export const isBinding = (value: any): value is Binding => {
  return (
    value &&
    value["@type"] === "binding" &&
    typeof value.name === "string" &&
    typeof value.name === "string"
  );
}

export type Value = string | number | boolean | null | object;

export type ReactiveValue = Binding | Value;

export type Props = {
  [key: string]: ReactiveValue;
}

export type Tag = string;

export type VNode = {
  tag: Tag;
  props: Props;
  children: Array<VNode | string>;
}

const vh = (
  tag: string,
  props: Props = {},
  ...children: Array<VNode | string>
): VNode  => ({
  tag,
  props,
  children
});

export type VNodeFactory = (
  props: Props,
  ...children: Array<VNode | string>
) => VNode;

/** Create a tag factory */
const vtag = (tag: string): VNodeFactory => (
  props: Props = {},
  ...children: Array<VNode | string>
): VNode => vh(tag, props, ...children);

export const tags: Record<string, VNodeFactory> = pipe(
  knownTags(),
  Array.from,
  (tags) => tags.map((tag: string) => [tag, vtag(tag)]),
  Object.fromEntries
);

export type RenderContext = Record<string, Signal<any>>

export const __cancel__ = Symbol('cancel');

/** Render vnode with a render context of reactive data sources */
export const render = (
  vnode: VNode,
  context: RenderContext
) => {
  if (!isKnownTags(vnode.tag)) {
    throw new TypeError(`Unknown tag: ${vnode.tag}`);
  }

  const element = document.createElement(vnode.tag);

  // Bind each prop to a reactive value (if any) and collect cancels
  const cancels: Array<Cancel> = [];
  for (const [key, value] of Object.entries(vnode.props)) {
    if (isBinding(value)) {
      const boundValue = context[value.name];
      const cancel = effect([boundValue], (value) => {
        setProp(element, key, value);
      });
      cancels.push(cancel);
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

const setProp = (element: HTMLElement, key: string, value: any) => {
  // @ts-ignore
  element[key] = value;
}