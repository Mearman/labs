import { reactive } from "@vue/reactivity";
import { Message } from "./data.js";
import { Graph } from "./reactivity/runtime.js";
import { get, set } from "idb-keyval";

export type Context<T> = {
  inputs: { [node: string]: { [input: string]: T } };
  outputs: { [node: string]: T };
  cancellation: (() => void)[];
};

export const session = reactive({
  history: [] as Message[],
  requests: [] as string[]
});

export const idk = reactive({
  reactCode: "",
  speclang: "",
  transformed: ""
});

export const appState = reactive({} as any);
export const appGraph = new Graph(appState);

window.__refresh = () => {
  appGraph.update();
};

const syncChannel = new BroadcastChannel("sync");

type SyncMessage = { type: "write"; key: string; value: any };

export function gem(db: any, key: string) {
  return {
    get() {
      // if (db[key] === undefined) {
      //   db[key] = await get(key);
      // }

      return db[key];
    },
    set(value: any, broadcast = true) {
      console.log("gem:set", key, value);
      const plain = JSON.parse(JSON.stringify(value));
      db[key] = value;
      localStorage.setItem(key, JSON.stringify(plain));
      if (broadcast && JSON.stringify(value) !== "{}") {
        syncChannel.postMessage({ type: "write", key, value: plain });
      }
    }
  };
}

syncChannel.onmessage = (e: MessageEvent<SyncMessage>) => {
  console.log("syncChannel", e.data);
  switch (e.data.type) {
    case "write":
      gem(appState, e.data.key).set(e.data.value, false);
      break;
  }
};
