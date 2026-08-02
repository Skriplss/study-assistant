'use client'

import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface LatexRendererProps {
  content: string
  className?: string
}

export function LatexRenderer({ content, className = '' }: LatexRendererProps) {
  // Memoize so KaTeX only re-runs when `content` actually changes — otherwise a
  // parent re-render (e.g. selecting a quiz option) re-parsed every instance.
  const html = useMemo(() => {
    if (!content) return ''
    try {
      return renderLatexInText(content)
    } catch (error) {
      console.error('LaTeX rendering error:', error)
      return escapeHtml(content)
    }
  }, [content])

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  )
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function renderMath(latex: string, displayMode: boolean): string {
  try {
    const rendered = katex.renderToString(latex.trim(), {
      displayMode,
      throwOnError: false,
      errorColor: '#cc0000',
      strict: false,
    })
    return displayMode
      ? `<div class="katex-block my-4">${rendered}</div>`
      : `<span class="katex-inline">${rendered}</span>`
  } catch (error) {
    console.warn('LaTeX render error:', error)
    const source = displayMode ? `$$${latex}$$` : `$${latex}$`
    return `<span class="katex-error">${escapeHtml(source)}</span>`
  }
}

/**
 * Process text and render LaTeX expressions ($...$ inline, $$...$$ block).
 * Everything outside math segments goes into dangerouslySetInnerHTML, so it
 * MUST be HTML-escaped — content is AI-derived from user uploads, and raw
 * `<` both eats text and is an XSS vector.
 */
function renderLatexInText(text: string): string {
  if (!text) return ''

  const pattern = /\$\$([\s\S]*?)\$\$|\$([^$\n]+?)\$/g
  let html = ''
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    html += escapeHtml(text.slice(lastIndex, match.index))
    const [, block, inline] = match
    html +=
      block !== undefined ? renderMath(block, true) : renderMath(inline, false)
    lastIndex = pattern.lastIndex
  }
  html += escapeHtml(text.slice(lastIndex))

  return html
}

/**
 * Check if text contains LaTeX expressions
 */
export function hasLatex(text: string): boolean {
  if (!text) return false
  return /\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$/.test(text)
}
