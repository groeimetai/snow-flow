import { EOL } from "os"
import { File } from "../../../file"
import { bootstrap } from "../../bootstrap"
import { cmd } from "../cmd"

const FileSearchCommand = cmd({
  command: "search <query>",
  builder: (yargs) =>
    yargs.positional("query", {
      type: "string",
      demandOption: true,
      description: "Search query",
    }),
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      const results = await File.search({ query: args.query })
      process.stdout.write(results.join(EOL) + EOL)
    })
  },
})

const FileReadCommand = cmd({
  command: "read <path>",
  builder: (yargs) =>
    yargs.positional("path", {
      type: "string",
      demandOption: true,
      description: "File path to read",
    }),
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      const content = await File.read(args.path)
      process.stdout.write(JSON.stringify(content, null, 2) + EOL)
    })
  },
})

const FileStatusCommand = cmd({
  command: "status",
  builder: (yargs) => yargs,
  async handler() {
    await bootstrap(process.cwd(), async () => {
      const status = await File.status()
      process.stdout.write(JSON.stringify(status, null, 2) + EOL)
    })
  },
})

const FileListCommand = cmd({
  command: "list <path>",
  builder: (yargs) =>
    yargs.positional("path", {
      type: "string",
      demandOption: true,
      description: "File path to list",
    }),
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      const files = await File.list(args.path)
      process.stdout.write(JSON.stringify(files, null, 2) + EOL)
    })
  },
})

export const FileCommand = cmd({
  command: "file",
  builder: (yargs) =>
    yargs
      .command(FileReadCommand)
      .command(FileStatusCommand)
      .command(FileListCommand)
      .command(FileSearchCommand)
      .demandCommand(),
  async handler() {},
})
