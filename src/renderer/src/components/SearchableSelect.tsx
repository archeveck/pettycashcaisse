import { useState, useRef, useEffect, useMemo } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '../utils/cn'

interface Option {
  id: string
  name: string
  code?: string
  [key: string]: string | number | boolean | undefined | null | object
}

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  error?: string
  className?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  onBlur,
  placeholder = 'Sélectionner...',
  searchPlaceholder = 'Rechercher...',
  disabled = false,
  error,
  className
}: SearchableSelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = useMemo(() => options.find((opt) => opt.id === value), [options, value])

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options
    const query = searchQuery.toLowerCase()
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(query) ||
        (opt.code && opt.code.toLowerCase().includes(query))
    )
  }, [options, searchQuery])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        if (onBlur) onBlur()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onBlur])

  const handleSelect = (optionId: string) => {
    onChange(optionId)
    setIsOpen(false)
    setSearchQuery('')
  }

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setSearchQuery('')
  }

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          'flex min-h-12 w-full items-center justify-between rounded-xl border border-input bg-background/50 backdrop-blur-sm px-4 py-3 text-sm ring-offset-background transition-all duration-200 cursor-pointer hover:border-primary/50',
          isOpen && 'border-primary ring-2 ring-primary/20',
          disabled && 'cursor-not-allowed opacity-50',
          error && 'border-destructive',
          !selectedOption && 'text-muted-foreground'
        )}
      >
        <div className="flex items-center gap-2">
          {selectedOption ? (
            <span>
              {selectedOption.code ? `${selectedOption.code} - ` : ''}
              {selectedOption.name}
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedOption && !disabled && (
            <X
              className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
              onClick={clearSelection}
            />
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="p-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                className="h-9 w-full rounded-lg border-none bg-accent/50 pl-9 pr-4 text-sm focus:ring-1 focus:ring-primary/50 transition-all outline-none"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Aucun résultat trouvé.
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors',
                    value === option.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                  )}
                >
                  <span>
                    {option.code ? `${option.code} - ` : ''}
                    {option.name}
                  </span>
                  {value === option.id && <Check className="h-4 w-4" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
