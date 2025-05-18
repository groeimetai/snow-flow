import { z } from "zod";
import { randomBytes } from "crypto";

export namespace Identifier {
  const prefixes = {
    session: "ses",
    message: "msg",
  } as const;

  export function schema(prefix: keyof typeof prefixes) {
    return z.string().startsWith(prefixes[prefix]);
  }

  const LENGTH = 24;

  export function ascending(prefix: keyof typeof prefixes, given?: string) {
    return generateID(prefix, false, given);
  }

  export function descending(prefix: keyof typeof prefixes, given?: string) {
    return generateID(prefix, true, given);
  }

  function generateID(
    prefix: keyof typeof prefixes,
    descending: boolean,
    given?: string,
  ): string {
    if (given) {
      if (given.startsWith(prefixes[prefix])) return given;
      throw new Error(`ID ${given} does not start with ${prefixes[prefix]}`);
    }

    let now = BigInt(Date.now());

    if (descending) {
      now = ~now;
    }

    const timeBytes = Buffer.alloc(6);
    for (let i = 0; i < 6; i++) {
      timeBytes[i] = Number((now >> BigInt(40 - 8 * i)) & BigInt(0xff));
    }

    const randLength = (LENGTH - 12) / 2;
    const random = randomBytes(randLength);

    return prefix + "_" + timeBytes.toString("hex") + random.toString("hex");
  }
}
