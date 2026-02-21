import { Hono } from "hono"
import { lazy } from "../../util/lazy"

export const TuiClientRoutes = lazy(() =>
  new Hono().get("/", (c) => {
    return c.redirect("/")
  }),
)
