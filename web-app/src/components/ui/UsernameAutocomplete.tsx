import React, { useState, useEffect, useRef } from 'react';
import { searchCreatorUsernames } from '@/app/actions/creatorActions';

export function UsernameAutocomplete({
  value,
  options, // We keep this for backward compatibility
  onChange,
  onCancel
}: {
  value: string;
  options?: string[];
  onChange: (val: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCancel]);

  useEffect(() => {
    const search = async () => {
      const trimmed = query.trim().replace(/\s+/g, '');
      if (!trimmed) {
        setResults([]);
        return;
      }
      
      try {
        const data = await searchCreatorUsernames(trimmed);
        setResults(data);
      } catch (err) {
        console.error('Error searching creator usernames:', err);
      }
    };

    const handler = setTimeout(search, 300);
    return () => clearTimeout(handler);
  }, [query]);

  return (
    <div ref={ref} className="relative z-50 min-w-[150px]">
      <input 
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value.replace(/\s+/g, ''))}
        className="p-1.5 text-xs border rounded-md border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.3)] outline-none w-full bg-white"
        placeholder="Ketik username..."
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // If there's an exact match or we just want to force use the query
            onChange(query);
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
      />
      {results.length > 0 && (
        <ul className="absolute top-full left-0 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 shadow-xl rounded-md text-xs z-50 py-1">
          {results.map(opt => (
            <li 
              key={opt}
              onClick={() => onChange(opt)}
              className="px-3 py-2 hover:bg-blue-50 hover:text-blue-700 cursor-pointer text-slate-700"
            >
              @{opt}
            </li>
          ))}
        </ul>
      )}
      {results.length === 0 && query.trim() !== '' && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border shadow-lg rounded-md text-xs z-50 p-2 text-slate-500 italic">
          Tidak ditemukan. Enter untuk pakai ini.
        </div>
      )}
    </div>
  );
}
