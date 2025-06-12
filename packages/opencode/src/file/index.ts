export namespace File {
  const glob = new Bun.Glob("**/*")
  export async function search(path: string, query: string) {
    for await (const entry of glob.scan({
      cwd: path,
      onlyFiles: true,
    })) {
    }
  }
}
