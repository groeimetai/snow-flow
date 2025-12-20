import { Session } from "./index"
import { SessionManager } from "./session-manager"
import { Storage } from "../storage/storage"
import { Project } from "../project/project"

/**
 * Fork Tree Module - Session fork visualization for Snow-Code
 *
 * Provides:
 * - Tree structure building
 * - ASCII tree rendering
 * - Fork path navigation
 * - Visual session hierarchy
 */

export namespace ForkTree {
  // ============================================================================
  // TYPES
  // ============================================================================

  export interface TreeNode {
    id: string
    title: string
    parentID?: string
    children: TreeNode[]
    depth: number
    isLast: boolean
    messageCount: number
    cost: number
    time: {
      created: number
      updated: number
    }
    isCurrent?: boolean
    shared: boolean
  }

  export interface TreeRenderOptions {
    showCost?: boolean
    showMessages?: boolean
    showTime?: boolean
    showShared?: boolean
    maxDepth?: number
    currentSessionID?: string
    compact?: boolean
  }

  // ============================================================================
  // TREE BUILDING
  // ============================================================================

  /**
   * Build a complete fork tree for a project
   */
  export async function buildTree(projectID: string): Promise<TreeNode[]> {
    const project = (await Project.list()).find((p) => p.id === projectID)
    if (!project) return []

    const sessionPaths = await Storage.list(["session", projectID])
    const sessions = new Map<string, Session.Info>()
    const sessionStats = new Map<string, { messageCount: number; cost: number }>()

    // Load all sessions
    for (const sessionPath of sessionPaths) {
      try {
        const session = await Storage.read<Session.Info>(sessionPath)
        if (session) {
          sessions.set(session.id, session)
          // Get basic stats
          const messagePaths = await Storage.list(["message", session.id])
          let cost = 0
          for (const msgPath of messagePaths) {
            try {
              const msg = await Storage.read<any>(msgPath)
              if (msg?.role === "assistant" && msg.cost) {
                cost += msg.cost
              }
            } catch {}
          }
          sessionStats.set(session.id, { messageCount: messagePaths.length, cost })
        }
      } catch {}
    }

    // Build tree structure
    const rootNodes: TreeNode[] = []
    const nodeMap = new Map<string, TreeNode>()

    // First pass: create all nodes
    for (const [id, session] of sessions) {
      const stats = sessionStats.get(id) ?? { messageCount: 0, cost: 0 }
      const node: TreeNode = {
        id: session.id,
        title: session.title,
        parentID: session.parentID,
        children: [],
        depth: 0,
        isLast: false,
        messageCount: stats.messageCount,
        cost: stats.cost,
        time: session.time,
        shared: !!session.share,
      }
      nodeMap.set(id, node)
    }

    // Second pass: build hierarchy
    for (const [id, node] of nodeMap) {
      if (node.parentID && nodeMap.has(node.parentID)) {
        const parent = nodeMap.get(node.parentID)!
        parent.children.push(node)
      } else {
        rootNodes.push(node)
      }
    }

    // Sort children by creation time
    const sortChildren = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.time.created - b.time.created)
      for (const node of nodes) {
        sortChildren(node.children)
      }
    }
    sortChildren(rootNodes)

    // Set depth and isLast
    const setDepthAndLast = (nodes: TreeNode[], depth: number) => {
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].depth = depth
        nodes[i].isLast = i === nodes.length - 1
        setDepthAndLast(nodes[i].children, depth + 1)
      }
    }
    setDepthAndLast(rootNodes, 0)

    // Sort root nodes by most recent update
    rootNodes.sort((a, b) => b.time.updated - a.time.updated)

    return rootNodes
  }

  /**
   * Build tree starting from a specific session (showing ancestors and descendants)
   */
  export async function buildSubtree(
    sessionID: string,
    projectID?: string
  ): Promise<TreeNode | null> {
    // Find the session
    let pid = projectID
    if (!pid) {
      const found = await SessionManager.getGlobal(sessionID)
      if (!found) return null
      pid = found.project.id
    }

    // Get ancestry
    const ancestry = await SessionManager.getAncestry(sessionID, pid)
    if (ancestry.length === 0) return null

    // Build tree from root
    const rootSummary = ancestry[0]
    const fullTree = await buildTree(pid)

    // Find the root node in the tree
    const findNode = (nodes: TreeNode[], id: string): TreeNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node
        const found = findNode(node.children, id)
        if (found) return found
      }
      return null
    }

    const rootNode = findNode(fullTree, rootSummary.id)
    if (rootNode) {
      // Mark current session
      const markCurrent = (node: TreeNode) => {
        if (node.id === sessionID) {
          node.isCurrent = true
        }
        node.children.forEach(markCurrent)
      }
      markCurrent(rootNode)
    }

    return rootNode
  }

  // ============================================================================
  // TREE RENDERING
  // ============================================================================

  /**
   * Render tree to ASCII art
   */
  export function render(nodes: TreeNode[], options: TreeRenderOptions = {}): string[] {
    const {
      showCost = false,
      showMessages = false,
      showTime = false,
      showShared = false,
      maxDepth = Infinity,
      currentSessionID,
      compact = false,
    } = options

    const lines: string[] = []
    const prefixStack: string[] = []

    const renderNode = (node: TreeNode, prefix: string, isLast: boolean) => {
      if (node.depth > maxDepth) return

      // Build node line
      const connector = isLast ? "└── " : "├── "
      const marker = node.id === currentSessionID || node.isCurrent ? "▶ " : ""
      const sharedIcon = showShared && node.shared ? " 🔗" : ""

      let info = ""
      if (!compact) {
        const parts: string[] = []
        if (showMessages) parts.push(`${node.messageCount} msgs`)
        if (showCost) parts.push(`$${node.cost.toFixed(2)}`)
        if (showTime) {
          const date = new Date(node.time.updated)
          parts.push(formatRelativeTime(date))
        }
        if (parts.length > 0) {
          info = ` (${parts.join(", ")})`
        }
      }

      // Truncate title if needed
      const maxTitleLen = compact ? 30 : 40
      const title =
        node.title.length > maxTitleLen ? node.title.slice(0, maxTitleLen - 3) + "..." : node.title

      const line = prefix + connector + marker + title + sharedIcon + info
      lines.push(line)

      // Render children
      const childPrefix = prefix + (isLast ? "    " : "│   ")
      for (let i = 0; i < node.children.length; i++) {
        renderNode(node.children[i], childPrefix, i === node.children.length - 1)
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      if (i > 0) lines.push("") // Add spacing between root trees
      renderNode(nodes[i], "", i === nodes.length - 1)
    }

    return lines
  }

  /**
   * Render a compact single-line path from root to current session
   */
  export function renderPath(ancestry: SessionManager.SessionSummary[]): string {
    if (ancestry.length === 0) return ""

    const parts = ancestry.map((s, i) => {
      const title = s.title.length > 20 ? s.title.slice(0, 17) + "..." : s.title
      const marker = i === ancestry.length - 1 ? "▶" : "→"
      return `${marker} ${title}`
    })

    return parts.join(" ")
  }

  /**
   * Render tree as indented list (simpler format)
   */
  export function renderIndented(nodes: TreeNode[], currentSessionID?: string): string[] {
    const lines: string[] = []

    const renderNode = (node: TreeNode) => {
      const indent = "  ".repeat(node.depth)
      const marker = node.id === currentSessionID || node.isCurrent ? "▶ " : "• "
      const title =
        node.title.length > 50 ? node.title.slice(0, 47) + "..." : node.title
      lines.push(`${indent}${marker}${title}`)

      for (const child of node.children) {
        renderNode(child)
      }
    }

    for (const node of nodes) {
      renderNode(node)
    }

    return lines
  }

  /**
   * Render tree with box drawing characters
   */
  export function renderBoxed(
    nodes: TreeNode[],
    options: TreeRenderOptions = {}
  ): string[] {
    const lines: string[] = []
    const { currentSessionID, showCost, showMessages } = options

    const BOX = {
      topLeft: "┌",
      topRight: "┐",
      bottomLeft: "└",
      bottomRight: "┘",
      horizontal: "─",
      vertical: "│",
      leftT: "├",
      rightT: "┤",
      downT: "┬",
      upT: "┴",
    }

    const renderNode = (node: TreeNode, prefix: string, isLast: boolean, isRoot: boolean) => {
      const isCurrent = node.id === currentSessionID || node.isCurrent

      // Title truncation
      const maxTitleLen = 35
      const title =
        node.title.length > maxTitleLen ? node.title.slice(0, maxTitleLen - 3) + "..." : node.title

      // Build info string
      const infoParts: string[] = []
      if (showMessages) infoParts.push(`${node.messageCount}m`)
      if (showCost) infoParts.push(`$${node.cost.toFixed(2)}`)
      const info = infoParts.length > 0 ? ` [${infoParts.join("|")}]` : ""

      // Node box
      const nodeWidth = Math.max(title.length + info.length + 4, 20)
      const topBorder = BOX.horizontal.repeat(nodeWidth - 2)
      const bottomBorder = BOX.horizontal.repeat(nodeWidth - 2)

      const marker = isCurrent ? "▶" : " "
      const content = `${marker}${title}${info}`.padEnd(nodeWidth - 2)

      if (isRoot) {
        lines.push(prefix + BOX.topLeft + topBorder + BOX.topRight)
        lines.push(prefix + BOX.vertical + content + BOX.vertical)
        lines.push(prefix + BOX.bottomLeft + bottomBorder + BOX.bottomRight)
      } else {
        const connector = isLast ? BOX.bottomLeft : BOX.leftT
        lines.push(prefix + connector + BOX.horizontal + BOX.topLeft + topBorder + BOX.topRight)
        lines.push(prefix + (isLast ? " " : BOX.vertical) + " " + BOX.vertical + content + BOX.vertical)
        lines.push(
          prefix + (isLast ? " " : BOX.vertical) + " " + BOX.bottomLeft + bottomBorder + BOX.bottomRight
        )
      }

      // Render children
      const childPrefix = prefix + (isRoot ? "" : isLast ? "   " : BOX.vertical + "  ")
      for (let i = 0; i < node.children.length; i++) {
        renderNode(node.children[i], childPrefix, i === node.children.length - 1, false)
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      if (i > 0) lines.push("")
      renderNode(nodes[i], "", true, true)
    }

    return lines
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  function formatRelativeTime(date: Date): string {
    const now = Date.now()
    const diff = now - date.getTime()

    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    const weeks = Math.floor(diff / 604800000)

    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    if (weeks < 4) return `${weeks}w ago`
    return date.toLocaleDateString()
  }

  /**
   * Count total nodes in tree
   */
  export function countNodes(nodes: TreeNode[]): number {
    let count = 0
    const countRecursive = (nodeList: TreeNode[]) => {
      for (const node of nodeList) {
        count++
        countRecursive(node.children)
      }
    }
    countRecursive(nodes)
    return count
  }

  /**
   * Find max depth of tree
   */
  export function maxDepth(nodes: TreeNode[]): number {
    let max = 0
    const findMax = (nodeList: TreeNode[], depth: number) => {
      for (const node of nodeList) {
        max = Math.max(max, depth)
        findMax(node.children, depth + 1)
      }
    }
    findMax(nodes, 0)
    return max
  }

  /**
   * Flatten tree to array
   */
  export function flatten(nodes: TreeNode[]): TreeNode[] {
    const result: TreeNode[] = []
    const flattenRecursive = (nodeList: TreeNode[]) => {
      for (const node of nodeList) {
        result.push(node)
        flattenRecursive(node.children)
      }
    }
    flattenRecursive(nodes)
    return result
  }
}
