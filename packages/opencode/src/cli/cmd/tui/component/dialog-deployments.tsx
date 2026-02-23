import { createSignal, createMemo, onMount, Show, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useTheme } from "@tui/context/theme"
import { TextAttributes } from "@opentui/core"
import { Keybind } from "@/util/keybind"
import open from "open"

interface UpdateSet {
  sys_id: string
  name: string
  description: string
  state: string
  sys_created_on: string
  sys_created_by: string
  sys_updated_on: string
  is_current: boolean
  artifact_count: number
  artifact_types: Record<string, number>
  risk: "low" | "medium" | "high"
}

type Step = "loading" | "list" | "preview" | "error"

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

function calculateRisk(count: number, types: Record<string, number>): "low" | "medium" | "high" {
  const highRisk = ["sys_script_include", "sys_script", "sysevent_script_action", "sys_security_acl"]
  const medRisk = ["sp_widget", "sys_ui_policy", "sys_ui_action", "sys_dictionary"]

  const hasHigh = highRisk.some((t) => (types[t] || 0) > 0)
  const hasMed = medRisk.some((t) => (types[t] || 0) > 0)

  if (hasHigh || count > 50) return "high"
  if (hasMed || count > 20) return "medium"
  return "low"
}

function stateLabel(state: string): string {
  if (state === "in progress") return "In Progress"
  if (state === "complete") return "Complete"
  if (state === "ignore") return "Ignore"
  return state.charAt(0).toUpperCase() + state.slice(1)
}

function statePriority(state: string): number {
  if (state === "in progress") return 0
  if (state === "complete") return 1
  return 2
}

function riskColor(risk: "low" | "medium" | "high", theme: any): string {
  if (risk === "high") return theme.error
  if (risk === "medium") return theme.warning
  return theme.success
}

function friendlyType(type: string): string {
  const map: Record<string, string> = {
    sp_widget: "Widget",
    sys_script_include: "Script Include",
    sys_script: "Business Rule",
    sys_script_client: "Client Script",
    sys_ui_policy: "UI Policy",
    sys_ui_action: "UI Action",
    sys_dictionary: "Dictionary",
    sys_security_acl: "ACL",
    sysevent_script_action: "Script Action",
    sys_properties: "Property",
    sys_ui_page: "UI Page",
    sys_ws_operation: "REST Resource",
    content_css: "CSS",
  }
  return map[type] || type.replace(/^sys_/, "").replace(/_/g, " ")
}

export function DialogDeployments() {
  const dialog = useDialog()
  const toast = useToast()
  const { theme } = useTheme()

  const [step, setStep] = createSignal<Step>("loading")
  const [instance, setInstance] = createSignal("")
  const [updateSets, setUpdateSets] = createSignal<UpdateSet[]>([])
  const [currentSetId, setCurrentSetId] = createSignal<string | undefined>()
  const [selectedSet, setSelectedSet] = createSignal<UpdateSet | undefined>()
  const [errorMessage, setErrorMessage] = createSignal("")

  useKeyboard((evt) => {
    const current = step()
    if (current === "preview") {
      if (evt.name === "escape") {
        setStep("list")
        return
      }
      if (evt.name === "return" || evt.name === "o") {
        const set = selectedSet()
        if (set) openInBrowser(set.sys_id)
        return
      }
    }
  })

  onMount(async () => {
    try {
      const { Auth } = await import("@/auth")
      let snAuth = await Auth.get("servicenow")

      if (!snAuth) {
        const entAuth = await Auth.get("enterprise")
        if (entAuth?.type === "enterprise" && entAuth.token && entAuth.enterpriseUrl) {
          try {
            const response = await fetch(`${entAuth.enterpriseUrl}/api/user-credentials/servicenow/default`, {
              method: "GET",
              headers: { Authorization: `Bearer ${entAuth.token}`, Accept: "application/json" },
            })
            if (response.ok) {
              const data = await response.json()
              if (
                data.success &&
                data.instance?.instanceUrl &&
                data.instance?.clientId &&
                data.instance?.clientSecret
              ) {
                await Auth.set("servicenow", {
                  type: "servicenow-oauth",
                  instance: data.instance.instanceUrl,
                  clientId: data.instance.clientId,
                  clientSecret: data.instance.clientSecret,
                })
                snAuth = await Auth.get("servicenow")
              }
            }
          } catch {
            // Enterprise portal fetch failed
          }
        }
      }

      if (!snAuth) {
        toast.show({
          variant: "error",
          message: "No ServiceNow auth configured. Use /auth to set up credentials.",
          duration: 5000,
        })
        setTimeout(async () => {
          const { DialogAuth } = await import("./dialog-auth")
          dialog.replace(() => <DialogAuth />)
        }, 2000)
        return
      }

      let instanceUrl = ""
      let headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" }

      if (snAuth.type === "servicenow-oauth") {
        instanceUrl = snAuth.instance
        if (snAuth.accessToken) {
          headers.Authorization = `Bearer ${snAuth.accessToken}`
        }
      } else if (snAuth.type === "servicenow-basic") {
        instanceUrl = snAuth.instance
        headers.Authorization = `Basic ${Buffer.from(`${snAuth.username}:${snAuth.password}`).toString("base64")}`
      }

      setInstance(instanceUrl)
      await fetchData(instanceUrl, headers)
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to load credentials")
      setStep("error")
    }
  })

  const fetchData = async (instanceUrl: string, headers: Record<string, string>) => {
    setStep("loading")
    try {
      // Fetch current update set and list in parallel
      const [currentRes, listRes] = await Promise.all([
        fetch(
          `${instanceUrl}/api/now/table/sys_update_set?sysparm_query=is_current=true&sysparm_fields=sys_id,name,description,state,sys_created_on,sys_created_by&sysparm_limit=1`,
          { headers },
        ),
        fetch(
          `${instanceUrl}/api/now/table/sys_update_set?sysparm_fields=sys_id,name,description,state,sys_created_on,sys_created_by,sys_updated_on&sysparm_limit=20&sysparm_orderby=DESCsys_created_on`,
          { headers },
        ),
      ])

      if (!currentRes.ok || !listRes.ok) {
        const status = !currentRes.ok ? currentRes.status : listRes.status
        setErrorMessage(`ServiceNow API returned HTTP ${status}`)
        setStep("error")
        return
      }

      const currentData = await currentRes.json()
      const listData = await listRes.json()

      const currentSet = currentData.result?.[0]
      if (currentSet) setCurrentSetId(currentSet.sys_id)

      const sets: any[] = listData.result || []

      // Fetch artifacts for each update set in parallel
      const artifactPromises = sets.map((us) =>
        fetch(
          `${instanceUrl}/api/now/table/sys_update_xml?sysparm_query=update_set=${us.sys_id}&sysparm_fields=sys_id,type,name&sysparm_limit=500`,
          { headers },
        )
          .then((r) => (r.ok ? r.json() : { result: [] }))
          .catch(() => ({ result: [] })),
      )

      const artifactResults = await Promise.all(artifactPromises)

      const enrichedSets: UpdateSet[] = sets.map((us, i) => {
        const artifacts: any[] = artifactResults[i].result || []
        const types: Record<string, number> = {}
        for (const a of artifacts) {
          const t = a.type || "unknown"
          types[t] = (types[t] || 0) + 1
        }
        return {
          sys_id: us.sys_id,
          name: us.name,
          description: us.description || "",
          state: us.state,
          sys_created_on: us.sys_created_on,
          sys_created_by: us.sys_created_by,
          sys_updated_on: us.sys_updated_on || us.sys_created_on,
          is_current: us.sys_id === currentSet?.sys_id,
          artifact_count: artifacts.length,
          artifact_types: types,
          risk: calculateRisk(artifacts.length, types),
        }
      })

      setUpdateSets(enrichedSets)
      setStep("list")
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to fetch update sets")
      setStep("error")
    }
  }

  const openInBrowser = (sysId: string) => {
    const url = `${instance()}/sys_update_set.do?sys_id=${sysId}`
    open(url).catch(() => {})
    toast.show({ variant: "info", message: "Opening in browser...", duration: 2000 })
  }

  const sortedSets = createMemo(() =>
    [...updateSets()].sort((a, b) => {
      const sp = statePriority(a.state) - statePriority(b.state)
      if (sp !== 0) return sp
      return new Date(b.sys_created_on).getTime() - new Date(a.sys_created_on).getTime()
    }),
  )

  const options = createMemo((): DialogSelectOption<string>[] =>
    sortedSets().map((us) => ({
      value: us.sys_id,
      title: us.name,
      description: `${us.sys_created_by} · ${timeAgo(us.sys_created_on)}`,
      category: stateLabel(us.state),
      gutter: (
        <text fg={riskColor(us.risk, theme)} flexShrink={0}>
          ●
        </text>
      ),
      footer: `${us.artifact_count} records`,
    })),
  )

  const keybinds = createMemo(() => [
    {
      keybind: Keybind.parse("o")[0],
      title: "open",
      onTrigger: (option: DialogSelectOption<string>) => {
        openInBrowser(option.value)
      },
    },
    {
      keybind: Keybind.parse("p")[0],
      title: "preview",
      onTrigger: (option: DialogSelectOption<string>) => {
        const set = updateSets().find((us) => us.sys_id === option.value)
        if (set) {
          setSelectedSet(set)
          setStep("preview")
        }
      },
    },
    {
      keybind: Keybind.parse("r")[0],
      title: "refresh",
      onTrigger: async () => {
        const { Auth } = await import("@/auth")
        const snAuth = await Auth.get("servicenow")
        if (!snAuth) return
        let headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" }
        if (snAuth.type === "servicenow-oauth" && snAuth.accessToken) {
          headers.Authorization = `Bearer ${snAuth.accessToken}`
        } else if (snAuth.type === "servicenow-basic") {
          headers.Authorization = `Basic ${Buffer.from(`${snAuth.username}:${snAuth.password}`).toString("base64")}`
        }
        toast.show({ variant: "info", message: "Refreshing...", duration: 1000 })
        await fetchData(instance(), headers)
      },
    },
  ])

  const previewTypes = createMemo(() => {
    const set = selectedSet()
    if (!set) return []
    return Object.entries(set.artifact_types)
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => ({ type: friendlyType(type), count }))
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      {/* Loading */}
      <Show when={step() === "loading"}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            Deployments
          </text>
          <text fg={theme.textMuted}>esc</text>
        </box>
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          Loading update sets...
        </text>
        <text fg={theme.textMuted}>Fetching from ServiceNow</text>
      </Show>

      {/* List */}
      <Show when={step() === "list"}>
        <DialogSelect
          title="Deployments"
          options={options()}
          current={currentSetId()}
          keybind={keybinds()}
          onSelect={(option) => {
            openInBrowser(option.value)
          }}
        />
      </Show>

      {/* Preview */}
      <Show when={step() === "preview" && selectedSet()}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            {selectedSet()!.name}
          </text>
          <text fg={theme.textMuted}>esc</text>
        </box>
        <box flexDirection="row" gap={2}>
          <text fg={theme.textMuted}>
            State: <span style={{ fg: theme.text }}>{stateLabel(selectedSet()!.state)}</span>
          </text>
          <text fg={theme.textMuted}>
            Risk: <span style={{ fg: riskColor(selectedSet()!.risk, theme) }}>● {selectedSet()!.risk}</span>
          </text>
        </box>
        <Show when={selectedSet()!.description}>
          <text fg={theme.textMuted} wrapMode="word">
            {selectedSet()!.description}
          </text>
        </Show>
        <box paddingTop={1}>
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            Artifacts ({selectedSet()!.artifact_count})
          </text>
          <For each={previewTypes()}>
            {(item) => (
              <box flexDirection="row" gap={1} paddingLeft={1}>
                <text fg={theme.success} flexShrink={0}>
                  ●
                </text>
                <text fg={theme.text}>
                  {item.type}: <span style={{ fg: theme.textMuted }}>{item.count}</span>
                </text>
              </box>
            )}
          </For>
          <Show when={previewTypes().length === 0}>
            <text fg={theme.textMuted} paddingLeft={1}>
              No artifacts
            </text>
          </Show>
        </box>
        <box paddingTop={1}>
          <text fg={theme.textMuted}>
            Created by {selectedSet()!.sys_created_by} · {timeAgo(selectedSet()!.sys_created_on)}
          </text>
        </box>
        <box paddingTop={1} onMouseUp={() => openInBrowser(selectedSet()!.sys_id)}>
          <text fg={theme.primary}>Open in ServiceNow</text>
        </box>
      </Show>

      {/* Error */}
      <Show when={step() === "error"}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            Deployments
          </text>
          <text fg={theme.textMuted}>esc</text>
        </box>
        <text fg={theme.error}>{errorMessage()}</text>
        <text fg={theme.textMuted}>Use /auth to configure ServiceNow credentials</text>
      </Show>
    </box>
  )
}
