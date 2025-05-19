import type { z, ZodSchema } from "zod";
import { App } from "../app";
import { Log } from "../util/log";

export namespace Bus {
  const log = Log.create({ service: "bus" });
  type Subscription = (event: any) => void;

  const state = App.state("bus", () => {
    const subscriptions = new Map<any, Subscription[]>();

    return {
      subscriptions,
    };
  });

  export type EventDefinition = ReturnType<typeof event>;

  export function event<Type extends string, Properties extends ZodSchema>(
    type: Type,
    properties: Properties,
  ) {
    return {
      type,
      properties,
    };
  }

  export function publish<Definition extends EventDefinition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
  ) {
    const payload = {
      type: def.type,
      properties,
    };
    log.info("publishing", {
      type: def.type,
      ...properties,
    });
    for (const key of [def.type, "*"]) {
      const match = state().subscriptions.get(key);
      for (const sub of match ?? []) {
        sub(payload);
      }
    }
  }

  export function subscribe<Definition extends EventDefinition>(
    def: Definition,
    callback: (event: {
      type: Definition["type"];
      properties: z.infer<Definition["properties"]>;
    }) => void,
  ) {
    return raw(def.type, callback);
  }

  export function subscribeAll(callback: (event: any) => void) {
    return raw("*", callback);
  }

  function raw(type: string, callback: (event: any) => void) {
    log.info("subscribing", { type });
    const subscriptions = state().subscriptions;
    let match = subscriptions.get(type) ?? [];
    match.push(callback);
    subscriptions.set(type, match);

    return () => {
      log.info("unsubscribing", { type });
      const match = subscriptions.get(type);
      if (!match) return;
      const index = match.indexOf(callback);
      if (index === -1) return;
      match.splice(index, 1);
    };
  }
}
