import { RouteSectionProps } from "@solidjs/router";

export default function WorkspaceLayout(props: RouteSectionProps) {
  return (
    <div>
      <h1>Workspace</h1>
      {props.children}
    </div>
  );
}
