'use client'

import { useEffect, useId, useState } from 'react'
import { getCategorySuggestions } from '@/lib/tags/tag-management'

export interface CategorySelectorProps {
  value: string
  onChange: (category: string) => void
  suggestions?: string[]
  disabled?: boolean
  className?: string
  placeholder?: string
}

export default function CategorySelector({
  value,
  onChange,
  suggestions = [],
  disabled = false,
  className = '',
  placeholder = 'e.g., Computer Science, Mathematics',
}: CategorySelectorProps) {
  const listboxId = useId()
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filteredSuggestions = getCategorySuggestions(value, suggestions)

  useEffect(() => {
    setHighlightIndex(filteredSuggestions.length > 0 ? 0 : -1)
  }, [value, filteredSuggestions.length])

  const selectSuggestion = (category: string) => {
    onChange(category)
    setShowSuggestions(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
      e.preventDefault()
      setShowSuggestions(true)
      setHighlightIndex((i) =>
        i < filteredSuggestions.length - 1 ? i + 1 : 0
      )
      return
    }

    if (e.key === 'ArrowUp' && filteredSuggestions.length > 0) {
      e.preventDefault()
      setShowSuggestions(true)
      setHighlightIndex((i) =>
        i > 0 ? i - 1 : filteredSuggestions.length - 1
      )
      return
    }

    if (e.key === 'Enter' && highlightIndex >= 0 && showSuggestions) {
      e.preventDefault()
      selectSuggestion(filteredSuggestions[highlightIndex])
      return
    }

    if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value)
          setShowSuggestions(true)
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={showSuggestions && filteredSuggestions.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        placeholder={placeholder}
      />

      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-auto"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              role="option"
              aria-selected={index === highlightIndex}
              className={`px-3 py-2 cursor-pointer text-sm ${
                index === highlightIndex
                  ? 'bg-blue-50 text-blue-900'
                  : 'hover:bg-gray-50'
              }`}
              onMouseDown={(e) => {
                e.preventDefault()
                selectSuggestion(suggestion)
              }}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
