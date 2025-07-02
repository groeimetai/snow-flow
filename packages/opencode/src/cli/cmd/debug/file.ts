import { File } from "../../../file"
import { bootstrap } from "../../bootstrap"
import { cmd } from "../cmd"

export const FileCommand = cmd({
  command: "file",
  builder: (yargs) => yargs.command(FileReadCommand).demandCommand(),
  async handler() {},
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
    await bootstrap({ cwd: process.cwd() }, async () => {
      const content = await File.read(args.path)
      console.log(content)
    })
  },
})
