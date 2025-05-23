import { Title } from "@solidjs/meta"
import { A } from "@solidjs/router"

export default function Home() {
  return (
    <main>
      <Title>Share Demo</Title>
      <h1>Share Demo</h1>
      <p>
        <A href="/share/test-share-id">Go to test share</A>
      </p>
    </main>
  )
}
