'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/session'
import { fetchWithAuth } from '@/lib/api/fetch-with-auth'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Spinner } from '@/components/ui/Spinner'
import type { ProgressData } from '@/lib/types'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export function AnalyticsDashboard() {
  const { session } = useAuth()
  const [data, setData] = useState<ProgressData | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, session])

  const loadData = async () => {
    if (!session) return
    setLoading(true)
    try {
      const res = await fetchWithAuth(session, `/api/analytics/progress?range=${timeRange}`)
      if (res.ok) {
        const progressData = await res.json()
        setData(progressData)
      }
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const scoreChartData = useMemo(() => {
    const byDay = new Map<string, { key: number; label: string; sum: number; count: number }>()
    for (const s of data?.scoreHistory ?? []) {
      const d = new Date(s.date)
      const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const entry = byDay.get(String(dayKey))
      if (entry) {
        entry.sum += s.score
        entry.count += 1
      } else {
        byDay.set(String(dayKey), {
          key: dayKey,
          label: d.toLocaleDateString(),
          sum: s.score,
          count: 1,
        })
      }
    }
    return Array.from(byDay.values())
      .sort((a, b) => a.key - b.key)
      .map(e => ({
        date: e.label,
        score: Math.round(e.sum / e.count),
        quizzes: e.count,
      }))
  }, [data])

  const tagChartData = useMemo(
    () =>
      (data?.performanceByTag ?? []).slice(0, 10).map(t => ({
        name: t.tag,
        score: Math.round(t.averageScore),
        count: t.quizCount,
      })),
    [data]
  )

  const categoryChartData = useMemo(
    () =>
      (data?.performanceByCategory ?? []).map(c => ({
        name: c.category,
        value: Math.round(c.averageScore),
      })),
    [data]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" className="text-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No analytics data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <h2 className="text-2xl font-bold text-foreground">Analytics Dashboard</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d' | '1y')}
          className="w-full sm:w-auto px-4 py-2 border-2 border-border bg-card text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 sm:p-6 rounded-xl shadow-lg">
          <div className="text-sm text-muted-foreground font-medium">Total Materials</div>
          <div className="text-3xl font-bold text-foreground mt-2">{data.totalMaterials}</div>
        </div>
        <div className="bg-card border border-border p-4 sm:p-6 rounded-xl shadow-lg">
          <div className="text-sm text-muted-foreground font-medium">Total Quizzes</div>
          <div className="text-3xl font-bold text-foreground mt-2">{data.totalQuizzes}</div>
        </div>
        <div className="bg-card border border-border p-4 sm:p-6 rounded-xl shadow-lg">
          <div className="text-sm text-muted-foreground font-medium">Total Questions</div>
          <div className="text-3xl font-bold text-foreground mt-2">{data.totalQuestions}</div>
        </div>
        <div className="bg-card border border-border p-4 sm:p-6 rounded-xl shadow-lg">
          <div className="text-sm text-muted-foreground font-medium">Average Score</div>
          <div className="text-3xl font-bold text-primary mt-2">{data.averageScore}%</div>
        </div>
      </div>

      {scoreChartData.length > 0 && (
        <div className="bg-card border border-border p-4 sm:p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-foreground mb-4">Score History</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={scoreChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
              <XAxis dataKey="date" stroke="rgb(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} stroke="rgb(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgb(var(--card))',
                  border: '1px solid rgb(var(--border))',
                  borderRadius: '8px',
                  color: 'rgb(var(--foreground))'
                }}
                formatter={(value: number, _name, props) => [
                  `${value}%${props.payload.quizzes > 1 ? ` (avg of ${props.payload.quizzes} quizzes)` : ''}`,
                  'Score',
                ]}
              />
              <Legend />
              <Line type="monotone" dataKey="score" stroke="rgb(var(--primary))" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {tagChartData.length > 0 && (
        <div className="bg-card border border-border p-4 sm:p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-foreground mb-4">Performance by Tag</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tagChartData} margin={{ bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
              <XAxis
                dataKey="name"
                stroke="rgb(var(--muted-foreground))"
                interval={0}
                angle={-30}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 11 }}
              />
              <YAxis domain={[0, 100]} stroke="rgb(var(--muted-foreground))" width={32} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgb(var(--card))', 
                  border: '1px solid rgb(var(--border))',
                  borderRadius: '8px',
                  color: 'rgb(var(--foreground))'
                }} 
              />
              <Legend />
              <Bar dataKey="score" fill="rgb(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {categoryChartData.length > 0 && (
        <div className="bg-card border border-border p-4 sm:p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-foreground mb-4">Performance by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}%`}
                outerRadius="70%"
                fill="#8884d8"
                dataKey="value"
              >
                {categoryChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgb(var(--card))', 
                  border: '1px solid rgb(var(--border))',
                  borderRadius: '8px',
                  color: 'rgb(var(--foreground))'
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
