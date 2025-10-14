import type { Component } from "solid-js"
import { Button } from "./components/button"
import { Select } from "./components"
import "@opencode-ai/css"
import "./index.css"

const App: Component = () => {
  return (
    <main>
      <div class="light">
        <h3>Buttons</h3>
        <section>
          <Button variant="primary" size="normal">
            Normal Primary
          </Button>
          <Button variant="secondary" size="normal">
            Normal Secondary
          </Button>
          <Button variant="ghost" size="normal">
            Normal Ghost
          </Button>
          <Button variant="primary" size="large">
            Large Primary
          </Button>
          <Button variant="secondary" size="large">
            Large Secondary
          </Button>
          <Button variant="ghost" size="large">
            Large Ghost
          </Button>
        </section>
        <h3>Select</h3>
        <section>
          <Select options={["a", "b", "c"]} onSelect={(x) => console.log(x)} placeholder="Select" />
        </section>
      </div>
      <div class="dark">
        <h3>Buttons</h3>
        <section>
          <Button variant="primary" size="normal">
            Normal Primary
          </Button>
          <Button variant="secondary" size="normal">
            Normal Secondary
          </Button>
          <Button variant="ghost" size="normal">
            Normal Ghost
          </Button>
          <Button variant="primary" size="large">
            Large Primary
          </Button>
          <Button variant="secondary" size="large">
            Large Secondary
          </Button>
          <Button variant="ghost" size="large">
            Large Ghost
          </Button>
        </section>
        <h3>Select</h3>
        <section>
          <Select options={["a", "b", "c"]} onSelect={(x) => console.log(x)} placeholder="Select" />
        </section>
      </div>
    </main>
  )
}

export default App
