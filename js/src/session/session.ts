import { Identifier } from "../id/id";
import { Storage } from "../storage/storage";
import { Log } from "../util/log";

export namespace Session {
  const log = Log.create({ service: "session" });

  export interface Info {
    id: string;
    title: string;
  }

  export async function create() {
    const result: Info = {
      id: Identifier.create("session"),
      title: "New Session - " + new Date().toISOString(),
    };
    log.info("created", result);
    await Storage.write("session/info/" + result.id, JSON.stringify(result));
    return result;
  }
}
