'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
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

function toFlowNodes(graphNodes: GraphNode[]): Node[] {
  const cols = Math.ceil(Math.sqrt(graphNodes.length))
  return graphNodes.map((n, i) => ({
    id: n.id,
    position: { x: (i % cols) * 220, y: Math.floor(i / cols) * 140 },
    data: { label: n.label, ...n.data },
    style: {
      background: '#eff6ff',
      border: '2px solid #3b82f6',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
      fontWeight: 500,
      maxWidth: 180,
    },
  }))
}

function toFlowEdges(graphEdges: GraphEdge[]): Edge[] {
  return graphEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: `${Math.round(e.strength * 100)}%`,
    labelStyle: { fontSize: 10 },
    style: {
      strokeWidth: Math.max(1, Math.round(e.strength * 5)),
      stroke:
        e.strength > 0.7
          ? '#16a34a'
          : e.strength > 0.4
          ? '#3b82f6'
          : '#9ca3af',
    },
    data: { sharedConcepts: e.sharedConcepts },
  }))
}

export function KnowledgeGraphViewer() {
  const { session } = useAuth()
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [tooltip, setTooltip] = useState<NodeTooltip | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const loadGraph = useCallback(async () => {
    if (!session) return
    try {
      const res = await fetchWithAuth(session, '/api/graph')
      if (res.ok) {
        const data: KnowledgeGraph = await res.json()
        setGraph(data)
        setNodes(toFlowNodes(data.nodes))
        setEdges(toFlowEdges(data.edges))
      }
    } catch (err) {
      console.error('Failed to load graph:', err)
    } finally {
      setLoading(false)
    }
  }, [session, setNodes, setEdges])

  useEffect(() => {
    if (session) loadGraph()
  }, [session, loadGraph])

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

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (!graph) return
      const connectionCount = graph.edges.filter(
        e => e.source === node.id || e.target === node.id
      ).length
      setTooltip({
        nodeId: node.id,
        title: node.data.title,
        category: node.data.category,
        tags: node.data.tags,
        connectionCount,
      })
    },
    [graph]
  )

  const handlePaneClick = useCallback(() => setTooltip(null), [])

  const nodeTypes = useMemo(() => ({}), [])
  const edgeTypes = useMemo(() => ({}), [])

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
          <p className="text-sm text-gray-600">
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
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-600 mb-4">
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
        <div className="relative">
          <div style={{ height: 520 }} className="border border-gray-200 rounded-lg overflow-hidden">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              minZoom={0.3}
              maxZoom={2}
            >
              <Controls />
              <MiniMap
                nodeColor={() => '#3b82f6'}
                maskColor="rgba(0,0,0,0.05)"
              />
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            </ReactFlow>
          </div>

          {tooltip && (
            <div className="absolute bottom-4 left-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-xs z-10">
              <h3 className="font-semibold text-sm mb-1">{tooltip.title}</h3>
              {tooltip.category && (
                <p className="text-xs text-gray-500 mb-2">{tooltip.category}</p>
              )}
              <p className="text-xs text-blue-600 mb-2">
                {tooltip.connectionCount} connection(s)
              </p>
              {tooltip.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tooltip.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
