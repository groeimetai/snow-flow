import envpaths from "env-paths";
import fs from "fs/promises";
const paths = envpaths("opencode", {
  suffix: "",
});

await Promise.all([
  fs.mkdir(paths.config, { recursive: true }),
  fs.mkdir(paths.cache, { recursive: true }),
]);

export namespace Global {
  export function config() {
    return paths.config;
  }

  export function cache() {
    return paths.cache;
  }
}
