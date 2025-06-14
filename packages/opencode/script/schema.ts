#!/usr/bin/env bun

import "zod-openapi/extend"
import { Config } from "../src/config/config"
import { zodToJsonSchema } from "zod-to-json-schema"

const result = zodToJsonSchema(Config.Info)
await Bun.write("config.schema.json", JSON.stringify(result, null, 2))
