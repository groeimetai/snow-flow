import { App } from "../src/app";
import path from "node:path";
import { edit } from "../src/tool";
import { FileTimes } from "../src/tool/util/file-times";

await App.provide({ directory: process.cwd() }, async () => {
  const file = path.join(process.cwd(), "example/broken.ts");
  FileTimes.read(file);
  const tool = await edit.execute(
    {
      file_path: file,
      old_string: "x:",
      new_string: "x:",
    },
    {
      toolCallId: "test",
      messages: [],
    },
  );
  console.log(tool.output);
});
