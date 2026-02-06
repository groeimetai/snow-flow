import "./[...404].css"
import { Title } from "@solidjs/meta"
import { HttpStatusCode } from "@solidjs/start"
import logoLight from "../asset/logo-ornate-light.svg"
import logoDark from "../asset/logo-ornate-dark.svg"

export default function NotFound() {
  return (
    <main data-page="not-found">
      <Title>Not Found | Snow-Flow</Title>
      <HttpStatusCode code={404} />
      <div data-component="content">
        <section data-component="top">
          <a href="/" data-slot="logo-link">
            <img data-slot="logo light" src={logoLight} alt="Snow-Flow logo light" />
            <img data-slot="logo dark" src={logoDark} alt="Snow-Flow logo dark" />
          </a>
          <h1 data-slot="title">404 - Page Not Found</h1>
        </section>

        <section data-component="actions">
          <div data-slot="action">
            <a href="/">Home</a>
          </div>
          <div data-slot="action">
            <a href="/docs">Docs</a>
          </div>
          <div data-slot="action">
            <a href="https://github.com/groeimetai/snow-flow">GitHub</a>
          </div>
          <div data-slot="action">
            <a href="/discord">Discord</a>
          </div>
        </section>
      </div>
    </main>
  )
}
