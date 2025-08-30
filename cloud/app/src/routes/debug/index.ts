import type { APIEvent } from "@solidjs/start/server"
import { Resource } from "@opencode/cloud-resource"
import { json } from "@solidjs/router"

export async function GET(evt: APIEvent) {
  return json({
    data: Resource.Database.host,
  })
}
