import "./workspace/workspace.css"
import { RouteSectionProps } from "@solidjs/router";

export default function WorkspaceLayout(props: RouteSectionProps) {
  return (
    <main data-page="workspace">
      <h1>Workspace</h1>
      {props.children}
    </main>
  );
}
