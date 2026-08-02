'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  addTag,
  getTagSuggestions,
  removeTag,
  type TagEntry,
} from '@/lib/tags/tag-management'

export interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: TagEntry[]
  disabled?: boolean
  className?: string
}

export default function TagInput({
  tags,
  onChange,
  suggestions = [],
  disabled = false,
  className = '',
}: TagInputProps) {
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filteredSuggestions = getTagSuggestions(inputValue, suggestions, tags)

  useEffect(() => {
    // No implicit selection while typing — auto-highlighting the first
    // suggestion made Enter commit "biology" when the user typed "bio",
    // and made it impossible to Enter-add a tag that prefixes an existing
    // one. Highlight is opt-in via the arrow keys.
    setHighlightIndex(-1)
  }, [inputValue, filteredSuggestions.length])

  const commitTag = (raw: string) => {
    const result = addTag(raw, tags)
    if (result.error) {
      setError(result.error)
      return
    }
    onChange(result.tags)
    setInputValue('')
    setError('')
    setShowSuggestions(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (
        highlightIndex >= 0 &&
        highlightIndex < filteredSuggestions.length &&
        showSuggestions
      ) {
        commitTag(filteredSuggestions[highlightIndex])
        return
      }
      if (inputValue.trim()) {
        commitTag(inputValue)
      }
      return
    }

    if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
      e.preventDefault()
      setShowSuggestions(true)
      setHighlightIndex((i) => (i < filteredSuggestions.length - 1 ? i + 1 : 0))
      return
    }

    if (e.key === 'ArrowUp' && filteredSuggestions.length > 0) {
      e.preventDefault()
      setShowSuggestions(true)
      setHighlightIndex((i) => (i > 0 ? i - 1 : filteredSuggestions.length - 1))
      return
    }

    if (e.key === 'Escape') {
      setShowSuggestions(false)
      setHighlightIndex(-1)
    }
  }

  return (
    <div className={className}>
      <div className="relative mb-2 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          onChange={(e) => {
            setInputValue(e.target.value)
            setError('')
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 150)
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={showSuggestions && filteredSuggestions.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          placeholder="Add a tag and press Enter"
        />
        <button
          type="button"
          disabled={disabled || !inputValue.trim()}
          onClick={() => commitTag(inputValue)}
          className="rounded-md bg-secondary px-4 py-2 text-foreground hover:bg-secondary/80 disabled:opacity-50"
        >
          Add
        </button>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute left-0 right-14 top-full z-10 mt-1 max-h-40 overflow-auto rounded-md border border-border bg-card shadow-lg"
          >
            {filteredSuggestions.map((suggestion, index) => (
              <li
                key={suggestion}
                role="option"
                aria-selected={index === highlightIndex}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  index === highlightIndex
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-accent'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  commitTag(suggestion)
                }}
              >
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="mb-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-sm text-primary"
            >
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(removeTag(tag, tags))}
                  className="hover:text-primary/80"
                  aria-label={`Remove tag ${tag}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
