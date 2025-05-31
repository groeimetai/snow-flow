import path from "path";

export namespace AppPath {
  export function data(input: string) {
    return path.join(input, ".opencode");
  }

  export function storage(input: string) {
    return path.join(data(input), "storage");
  }
}
