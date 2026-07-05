'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d'
import { forceX, forceY } from 'd3-force'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
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

function readThemeColors(): ThemeColors {
  const s = getComputedStyle(document.documentElement)
  return {
    bg: cssVar(s, '--background', '#0f172a'),
    fg: cssVar(s, '--foreground', '#f1f5f9'),
    muted: cssVar(s, '--muted-foreground', '#94a3b8'),
    primary: cssVar(s, '--primary', '#3b82f6'),
    border: cssVar(s, '--border', '#475569'),
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

const CATEGORY_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
]
const UNCATEGORIZED_COLOR = '#94a3b8'

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
        className="w-full accent-blue-600 cursor-pointer"
      />
    </label>
  )
}

export function KnowledgeGraphViewer() {
  const { session } = useAuth()
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [tooltip, setTooltip] = useState<NodeTooltip | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [colors, setColors] = useState<ThemeColors | null>(null)
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(560)

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

  const nodeColor = useCallback(
    (category: string | null) => (category && categoryColors.get(category)) || UNCATEGORIZED_COLOR,
    [categoryColors]
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
      alert('Failed to analyze connections')
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
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
        >
          {analyzing ? 'Analyzing...' : 'Analyze Connections'}
        </button>
      </div>

      {!graph || graph.nodes.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground mb-4">
            No materials to display. Upload and parse materials first.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Analyze Connections
          </button>
        </div>
      ) : (
        <div
          className="flex border border-border rounded-lg overflow-hidden min-h-[520px]"
          style={{ height: 'min(80vh, 860px)' }}
        >
          <aside className="w-56 shrink-0 border-r border-border bg-card overflow-y-auto p-4 space-y-5">
            <div>
              <h4 className="font-semibold text-foreground text-sm mb-2">Search</h4>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Find a material…"
                className="w-full px-2 py-1.5 text-xs rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  {[...categoryColors].map(([cat, color]) => (
                    <li key={cat} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{cat}</span>
                    </li>
                  ))}
                  {hasUncategorized && (
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: UNCATEGORIZED_COLOR }}
                      />
                      <span className="truncate">Uncategorized</span>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </aside>

          <div ref={containerRef} className="relative flex-1 min-w-0">
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
                    : colors.border
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
                  ctx.globalAlpha = active ? 1 : 0.1
                  ctx.beginPath()
                  ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI)
                  ctx.fillStyle = fill
                  ctx.shadowColor = fill
                  ctx.shadowBlur = isHover ? 26 : isSearchHit ? 22 : active ? 12 : 0
                  ctx.fill()
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
                    ctx.fillStyle = colors.fg
                    const label = node.label.length > 28 ? node.label.slice(0, 27) + '…' : node.label
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
                        className="px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <Link
                  href={`/materials/${tooltip.nodeId}`}
                  className="text-xs font-medium text-blue-500 hover:underline inline-block"
                >
                  Open material →
                </Link>
              </div>
            )}
          </div>

          <aside className="w-56 shrink-0 border-l border-border bg-card overflow-y-auto p-4 space-y-5">
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
                    className="accent-blue-600 cursor-pointer"
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
      )}
    </div>
  )
}
