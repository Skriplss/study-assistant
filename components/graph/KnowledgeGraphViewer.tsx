'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d'
import { forceX, forceY } from 'd3-force'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils/cn'
import type { KnowledgeGraph, GraphNode, GraphEdge } from '@/lib/types'

interface NodeTooltip {
  nodeId: string
  title: string
  category: string | null
  tags: string[]
  connectionCount: number
}

interface FGNode {
  id: string
  label: string
  category: string | null
  tags: string[]
  degree: number
  r: number
  x?: number
  y?: number
}

interface FGLink {
  source: string | FGNode
  target: string | FGNode
  strength: number
  sharedConcepts: string[]
}

interface ThemeColors {
  bg: string
  fg: string
  muted: string
  primary: string
  border: string
}

function cssVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const raw = styles.getPropertyValue(name).trim()
  return raw ? `rgb(${raw.split(/\s+/).join(', ')})` : fallback
}

// Overlay an alpha on an `rgb(r, g, b)` string produced by cssVar.
function withAlpha(rgb: string, alpha: number): string {
  return rgb.replace(/^rgb\(/, 'rgba(').replace(/\)$/, `, ${alpha})`)
}

function readThemeColors(): ThemeColors {
  const s = getComputedStyle(document.documentElement)
  // Fallbacks are light-theme values: if a var ever reads empty we'd rather
  // render dark ink on off-white (visible) than the dark theme's near-white
  // fg, which would vanish on a light page.
  return {
    bg: cssVar(s, '--background', '#faf9f6'),
    fg: cssVar(s, '--foreground', '#1a1a1a'),
    muted: cssVar(s, '--muted-foreground', '#6b6560'),
    primary: cssVar(s, '--primary', '#a24e32'),
    border: cssVar(s, '--border', '#d8d2c7'),
  }
}

function linkEndId(end: string | FGNode): string {
  return typeof end === 'object' ? end.id : end
}

const DEFAULTS = {
  repel: -160,
  linkDistance: 60,
  nodeScale: 1,
  labelThreshold: 0.75,
  minStrength: 0,
  showOrphans: true,
}

// Earthy, muted palette — distinct but in the same warm register as the theme.
// Tuned to sit on the dark charcoal canvas.
const CATEGORY_PALETTE = [
  '#B5563A', '#6E7F4E', '#C8923A', '#4E7E7A', '#8A5A7A',
  '#A94D4A', '#5B7C99', '#7D6B4F', '#9A9440', '#6B5B95',
]
const UNCATEGORIZED_COLOR = '#A39C93'
// On the light (milky-white) canvas we drop the palette and render every node
// in the dark theme's background charcoal — dark dots on milky white.
const LIGHT_NODE_COLOR = '#1a1815'

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{label}</span>
        <span className="tabular-nums">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary cursor-pointer"
      />
    </label>
  )
}

export function KnowledgeGraphViewer() {
  const { session } = useAuth()
  const { toast } = useToast()
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [tooltip, setTooltip] = useState<NodeTooltip | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [colors, setColors] = useState<ThemeColors | null>(null)
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(560)

  // Mobile: collapsible side panels (both hidden by default, always shown on lg).
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  // Graph controls (right panel).
  const [repel, setRepel] = useState(DEFAULTS.repel)
  const [linkDistance, setLinkDistance] = useState(DEFAULTS.linkDistance)
  const [nodeScale, setNodeScale] = useState(DEFAULTS.nodeScale)
  const [labelThreshold, setLabelThreshold] = useState(DEFAULTS.labelThreshold)
  const [minStrength, setMinStrength] = useState(DEFAULTS.minStrength)
  const [showOrphans, setShowOrphans] = useState(DEFAULTS.showOrphans)
  const [search, setSearch] = useState('')

  const resetControls = () => {
    setRepel(DEFAULTS.repel)
    setLinkDistance(DEFAULTS.linkDistance)
    setNodeScale(DEFAULTS.nodeScale)
    setLabelThreshold(DEFAULTS.labelThreshold)
    setMinStrength(DEFAULTS.minStrength)
    setShowOrphans(DEFAULTS.showOrphans)
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphMethods>()
  const didFitRef = useRef(false)

  // Load + observe theme colors so the canvas matches light/dark mode.
  useEffect(() => {
    setColors(readThemeColors())
    const obs = new MutationObserver(() => setColors(readThemeColors()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // Repaint when the theme changes. The render loop pauses once the simulation
  // cools, so node/link colors (and the canvas background) would otherwise stay
  // stale until the next hover/drag — resumeAnimation redraws without reheating
  // the physics, so nothing moves.
  useEffect(() => {
    fgRef.current?.resumeAnimation()
  }, [colors])

  // Track container width for a responsive canvas.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (rect?.width) setWidth(rect.width)
      if (rect?.height) setHeight(rect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [graph])

  const loadGraph = useCallback(async () => {
    if (!session) return
    try {
      const res = await fetchWithAuth(session, '/api/graph')
      if (res.ok) {
        const data: KnowledgeGraph = await res.json()
        setGraph(data)
        didFitRef.current = false
      }
    } catch (err) {
      console.error('Failed to load graph:', err)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (session) loadGraph()
  }, [session, loadGraph])

  // Build force-graph data. degree drives node size; neighbor map drives hover highlight.
  const { graphData, neighbors, degreeById } = useMemo(() => {
    const degreeById = new Map<string, number>()
    const neighbors = new Map<string, Set<string>>()
    for (const e of graph?.edges ?? []) {
      degreeById.set(e.source, (degreeById.get(e.source) ?? 0) + 1)
      degreeById.set(e.target, (degreeById.get(e.target) ?? 0) + 1)
      if (!neighbors.has(e.source)) neighbors.set(e.source, new Set())
      if (!neighbors.has(e.target)) neighbors.set(e.target, new Set())
      neighbors.get(e.source)!.add(e.target)
      neighbors.get(e.target)!.add(e.source)
    }
    const nodes: FGNode[] = (graph?.nodes ?? []).map(n => {
      const degree = degreeById.get(n.id) ?? 0
      return {
        id: n.id,
        label: n.label,
        category: n.data.category,
        tags: n.data.tags,
        degree,
        r: 4 + Math.sqrt(degree) * 2.6,
      }
    })
    const links: FGLink[] = (graph?.edges ?? []).map(e => ({
      source: e.source,
      target: e.target,
      strength: e.strength,
      sharedConcepts: e.sharedConcepts,
    }))
    return { graphData: { nodes, links }, neighbors, degreeById }
  }, [graph])

  // Tune the simulation to an Obsidian-like spread once data is in.
  useEffect(() => {
    const fg = fgRef.current
    if (!fg || graphData.nodes.length === 0) return
    fg.d3Force('charge')?.strength(repel)
    const link = fg.d3Force('link') as
      | { distance: (fn: (l: FGLink) => number) => unknown }
      | undefined
    link?.distance((l: FGLink) => linkDistance * (1.3 - l.strength * 0.6))
    // Restoring force toward the center — without it, strong repel makes
    // loosely-connected nodes drift outward forever. Scale it up with repel
    // so the graph settles at a bounded size instead of expanding endlessly.
    const centerStrength = Math.min(0.18, 0.03 + Math.abs(repel) / 4000)
    fg.d3Force('x', forceX(0).strength(centerStrength))
    fg.d3Force('y', forceY(0).strength(centerStrength))
    fg.d3ReheatSimulation()
  }, [graphData, repel, linkDistance])

  const highlightNodes = useMemo(() => {
    if (!hoverId) return null
    const set = new Set<string>([hoverId])
    for (const id of neighbors.get(hoverId) ?? []) set.add(id)
    return set
  }, [hoverId, neighbors])

  // Light canvas → monochrome charcoal nodes instead of the palette. Read the
  // theme straight from the <html> class (the MutationObserver refreshes
  // `colors` on toggle, so keying the memo on it re-evaluates in sync).
  const isLight = useMemo(() => {
    if (typeof document === 'undefined') return true
    return !document.documentElement.classList.contains('dark')
  }, [colors])

  // Stable color per category + whether any node is uncategorized (for legend).
  const { categoryColors, hasUncategorized } = useMemo(() => {
    const cats = Array.from(
      new Set((graph?.nodes ?? []).map(n => n.data.category).filter(Boolean) as string[])
    ).sort()
    const map = new Map<string, string>()
    cats.forEach((c, i) => map.set(c, CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]))
    const hasUncategorized = (graph?.nodes ?? []).some(n => !n.data.category)
    return { categoryColors: map, hasUncategorized }
  }, [graph])

  // Uncategorized nodes follow the theme's muted-foreground so they stay
  // visible in both light and dark (the static gray blends into off-white).
  const uncategorizedColor = colors?.muted ?? UNCATEGORIZED_COLOR
  const nodeColor = useCallback(
    (category: string | null) =>
      isLight
        ? LIGHT_NODE_COLOR
        : (category && categoryColors.get(category)) || uncategorizedColor,
    [isLight, categoryColors, uncategorizedColor]
  )

  // Node ids matching the search query (null when the box is empty).
  const searchIds = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    const set = new Set<string>()
    for (const n of graph?.nodes ?? []) {
      if (n.label.toLowerCase().includes(q)) set.add(n.id)
    }
    return set
  }, [search, graph])

  // Zoom to the matches when a search narrows the graph.
  useEffect(() => {
    const fg = fgRef.current
    if (!fg || !searchIds || searchIds.size === 0) return
    fg.zoomToFit(500, 80, (node: { id?: string | number }) => searchIds.has(String(node.id)))
  }, [searchIds])

  const handleAnalyze = async () => {
    if (!session) return
    setAnalyzing(true)
    try {
      await fetchWithAuth(session, '/api/graph/analyze', { method: 'POST' })
      await loadGraph()
    } catch {
      toast({ message: 'Failed to analyze connections', variant: 'error' })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleNodeClick = useCallback(
    (node: FGNode) => {
      setTooltip({
        nodeId: node.id,
        title: node.label,
        category: node.category,
        tags: node.tags,
        connectionCount: degreeById.get(node.id) ?? 0,
      })
    },
    [degreeById]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" className="text-primary" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Knowledge Graph</h2>
          <p className="text-sm text-muted-foreground">
            {graph?.nodes.length ?? 0} materials, {graph?.edges.length ?? 0} connections
          </p>
        </div>
        <Button onClick={handleAnalyze} disabled={analyzing} loading={analyzing}>
          {analyzing ? 'Analyzing…' : 'Analyze Connections'}
        </Button>
      </div>

      {!graph || graph.nodes.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground mb-4">
            No materials to display. Upload and parse materials first.
          </p>
          <Button onClick={handleAnalyze} disabled={analyzing} loading={analyzing}>
            Analyze Connections
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile panel toggles */}
          <div className="flex gap-2 mb-3 lg:hidden">
            <button
              type="button"
              onClick={() => setLeftOpen((o) => !o)}
              aria-expanded={leftOpen}
              className="flex-1 text-xs px-3 py-2 border border-border rounded hover:bg-muted text-foreground transition-colors"
            >
              Search &amp; Legend {leftOpen ? '▲' : '▼'}
            </button>
            <button
              type="button"
              onClick={() => setRightOpen((o) => !o)}
              aria-expanded={rightOpen}
              className="flex-1 text-xs px-3 py-2 border border-border rounded hover:bg-muted text-foreground transition-colors"
            >
              Controls {rightOpen ? '▲' : '▼'}
            </button>
          </div>

          <div className="flex flex-col lg:flex-row border border-border rounded-lg overflow-hidden lg:min-h-[520px] lg:h-[min(80vh,860px)]">
            <aside
              className={cn(
                'w-full lg:w-56 shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-card overflow-y-auto p-4 space-y-5',
                leftOpen ? 'block' : 'hidden lg:block'
              )}
            >
              <div>
                <h4 className="font-semibold text-foreground text-sm mb-2">Search</h4>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Find a material…"
                  className="w-full px-2 py-1.5 text-xs rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {searchIds && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {searchIds.size} match{searchIds.size === 1 ? '' : 'es'}
                  </p>
                )}
              </div>

              {(categoryColors.size > 0 || hasUncategorized) && (
                <div>
                  <h4 className="font-semibold text-foreground text-sm mb-3">Categories</h4>
                  <ul className="space-y-1.5">
                    {[...categoryColors].map(([cat]) => (
                      <li key={cat} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: nodeColor(cat) }}
                        />
                        <span className="truncate">{cat}</span>
                      </li>
                    ))}
                    {hasUncategorized && (
                      <li className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: nodeColor(null) }}
                        />
                        <span className="truncate">Uncategorized</span>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </aside>

            <div ref={containerRef} className="relative flex-1 min-w-0 h-[55vh] lg:h-auto">
              {colors && (
                <ForceGraph2D
                  ref={fgRef as never}
                  graphData={graphData}
                  width={width}
                  height={height}
                  backgroundColor={colors.bg}
                  cooldownTicks={120}
                  onEngineStop={() => {
                    if (!didFitRef.current) {
                      fgRef.current?.zoomToFit(400, 60)
                      didFitRef.current = true
                    }
                  }}
                  onNodeHover={(node: FGNode | null) => setHoverId(node?.id ?? null)}
                  onNodeClick={(node: FGNode) => handleNodeClick(node)}
                  onBackgroundClick={() => setTooltip(null)}
                  nodeVisibility={(node: FGNode) => showOrphans || node.degree > 0}
                  linkVisibility={(l: FGLink) => l.strength >= minStrength}
                  linkColor={(l: FGLink) =>
                    hoverId &&
                      (linkEndId(l.source) === hoverId || linkEndId(l.target) === hoverId)
                      ? colors.primary
                      : withAlpha(colors.muted, 0.4)
                  }
                  linkWidth={(l: FGLink) => {
                    const active =
                      hoverId &&
                      (linkEndId(l.source) === hoverId || linkEndId(l.target) === hoverId)
                    return Math.max(1, l.strength * 4) * (active ? 1.8 : 1)
                  }}
                  nodeRelSize={1}
                  nodePointerAreaPaint={(node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
                    ctx.fillStyle = color
                    ctx.beginPath()
                    ctx.arc(node.x!, node.y!, node.r * nodeScale + 3, 0, 2 * Math.PI)
                    ctx.fill()
                  }}
                  nodeCanvasObject={(node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
                    const matchesHover = !highlightNodes || highlightNodes.has(node.id)
                    const matchesSearch = !searchIds || searchIds.has(node.id)
                    const active = matchesHover && matchesSearch
                    const isHover = node.id === hoverId
                    const isSearchHit = searchIds?.has(node.id) ?? false
                    const r = node.r * nodeScale
                    const fill = nodeColor(node.category)

                    ctx.save()
                    ctx.globalAlpha = active ? 1 : 0.12
                    ctx.beginPath()
                    ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI)
                    ctx.fillStyle = fill
                    ctx.fill()
                    // Emphasis ring on hover / search hit — no canvas shadow: with
                    // force-graph's transparent canvas + CSS background, a shadowed
                    // dark fill composites toward the bg and reads as near-white.
                    if (isHover || isSearchHit) {
                      ctx.lineWidth = Math.max(1.5 / globalScale, 0.75)
                      ctx.strokeStyle = colors.primary
                      ctx.stroke()
                    }
                    ctx.restore()

                    const showLabel =
                      isHover ||
                      isSearchHit ||
                      globalScale > labelThreshold ||
                      (highlightNodes?.has(node.id) ?? false)
                    if (showLabel) {
                      const fontSize = Math.max(11 / globalScale, 2)
                      ctx.font = `${fontSize}px Inter, system-ui, sans-serif`
                      ctx.textAlign = 'center'
                      ctx.textBaseline = 'top'
                      ctx.globalAlpha = active ? 1 : 0.2
                      const label = node.label.length > 28 ? node.label.slice(0, 27) + '…' : node.label
                      // Halo in the background color so the ink label stays legible
                      // over nodes, edges, and the canvas on both themes.
                      ctx.lineWidth = Math.max(2 / globalScale, 0.5)
                      ctx.strokeStyle = colors.bg
                      ctx.lineJoin = 'round'
                      ctx.strokeText(label, node.x!, node.y! + r + 2)
                      ctx.fillStyle = colors.fg
                      ctx.fillText(label, node.x!, node.y! + r + 2)
                      ctx.globalAlpha = 1
                    }
                  }}
                />
              )}

              {tooltip && (
                <div className="absolute bottom-4 left-4 bg-card border border-border rounded-lg shadow-lg p-4 max-w-xs z-10">
                  <h3 className="font-semibold text-sm mb-1 text-foreground">{tooltip.title}</h3>
                  {tooltip.category && (
                    <p className="text-xs text-muted-foreground mb-2">{tooltip.category}</p>
                  )}
                  <p className="text-xs text-muted-foreground mb-2">
                    {tooltip.connectionCount} connection(s)
                  </p>
                  {tooltip.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {tooltip.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <Link
                    href={`/materials/${tooltip.nodeId}`}
                    className="text-xs font-medium text-primary hover:underline inline-block"
                  >
                    Open material →
                  </Link>
                </div>
              )}
            </div>

            <aside
              className={cn(
                'w-full lg:w-56 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-card overflow-y-auto p-4 space-y-5',
                rightOpen ? 'block' : 'hidden lg:block'
              )}
            >
              <div>
                <h4 className="font-semibold text-foreground text-sm mb-3">Forces</h4>
                <div className="space-y-3">
                  <Slider
                    label="Repel"
                    value={-repel}
                    min={20}
                    max={400}
                    step={10}
                    onChange={v => setRepel(-v)}
                  />
                  <Slider
                    label="Link distance"
                    value={linkDistance}
                    min={20}
                    max={200}
                    step={5}
                    onChange={setLinkDistance}
                  />
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground text-sm mb-3">Display</h4>
                <div className="space-y-3">
                  <Slider
                    label="Node size"
                    value={nodeScale}
                    min={0.5}
                    max={2.5}
                    step={0.1}
                    onChange={setNodeScale}
                    format={v => `${v.toFixed(1)}x`}
                  />
                  <Slider
                    label="Text fade"
                    value={labelThreshold}
                    min={0}
                    max={2}
                    step={0.05}
                    onChange={setLabelThreshold}
                    format={v => v.toFixed(2)}
                  />
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground text-sm mb-3">Filters</h4>
                <div className="space-y-3">
                  <Slider
                    label="Min strength"
                    value={minStrength}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={setMinStrength}
                    format={v => `${Math.round(v * 100)}%`}
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOrphans}
                      onChange={e => setShowOrphans(e.target.checked)}
                      className="accent-primary cursor-pointer"
                    />
                    Show orphans
                  </label>
                </div>
              </div>

              <button
                onClick={resetControls}
                className="w-full text-xs px-3 py-1.5 border border-border rounded hover:bg-muted text-foreground transition-colors"
              >
                Reset
              </button>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}
