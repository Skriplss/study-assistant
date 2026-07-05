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
      return content
    }
  }, [content])

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * Process text and render LaTeX expressions
 * Supports both inline ($...$) and block ($$...$$) LaTeX
 */
function renderLatexInText(text: string): string {
  if (!text) return ''

  let result = text
  
  // First, handle block LaTeX ($$...$$)
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
    try {
      const rendered = katex.renderToString(latex.trim(), {
        displayMode: true,
        throwOnError: false,
        errorColor: '#cc0000',
        strict: false,
      })
      return `<div class="katex-block my-4">${rendered}</div>`
    } catch (error) {
      console.warn('Block LaTeX render error:', error)
      return `<div class="katex-error">$$${latex}$$</div>`
    }
  })

  // Then, handle inline LaTeX ($...$)
  // Avoid matching already processed block LaTeX
  result = result.replace(/\$([^\$\n]+?)\$/g, (match, latex) => {
    try {
      const rendered = katex.renderToString(latex.trim(), {
        displayMode: false,
        throwOnError: false,
        errorColor: '#cc0000',
        strict: false,
      })
      return `<span class="katex-inline">${rendered}</span>`
    } catch (error) {
      console.warn('Inline LaTeX render error:', error)
      return `<span class="katex-error">$${latex}$</span>`
    }
  })

  return result
}

/**
 * Check if text contains LaTeX expressions
 */
export function hasLatex(text: string): boolean {
  if (!text) return false
  return /\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$/.test(text)
}
