import { Parser } from "htmlparser2";
import { parse as parseMustaches, isHole } from "./hole.js";
import { create as createVNode, VNode, Props } from "./vnode.js";
import * as logger from "./logger.js";

/** Parse a template into a simple JSON markup representation */
export const parse = (markup: string): VNode => {
  let root: VNode = createVNode("documentfragment");
  let stack: Array<VNode> = [root];

  const parser = new Parser(
    {
      onopentag(name, attrs) {
        logger.debug("Open", name, attrs);
        // We've turned off the namespace feature, so node attributes will
        // contain only string values, not QualifiedAttribute objects.
        const props = parseProps(attrs as { [key: string]: string });
        const next = createVNode(name, props);
        const top = getTop(stack);
        if (!top) {
          throw new ParseError(`No parent tag for ${name}`);
        }
        top.children.push(next);
        stack.push(next);
      },
      onclosetag(name) {
        const vnode = stack.pop();
        if (!vnode) {
          throw new ParseError(`Unexpected closing tag ${name}`);
        }
      },
      ontext(text) {
        const top = getTop(stack);
        const parsed = parseMustaches(text.trim());
        top.children.push(...parsed);
      },
    },
    {
      lowerCaseTags: true,
      lowerCaseAttributeNames: true,
      xmlMode: false,
    },
  );

  parser.write(markup);
  parser.end();
  return root;
};

export default parse;

const getTop = (stack: Array<VNode>): VNode | null => stack.at(-1) ?? null;

const parseProps = (attrs: { [key: string]: string }): Props => {
  const result: Props = {};
  for (const [key, value] of Object.entries(attrs)) {
    const parsed = parseMustaches(value);
    const first = parsed.at(0);
    if (parsed.length !== 1) {
      result[key] = "";
    } else if (isHole(first)) {
      result[key] = first;
    } else {
      result[key] = `${value}`;
    }
  }
  return result;
};

export class ParseError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}