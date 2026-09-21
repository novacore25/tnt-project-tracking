"use client";

import React, { useState, useRef, useEffect } from "react";
import { searchCreatorsAction } from "@/app/actions/databaseActions";

export function SearchableSelect({ 
  value, 
  initialLabel, 
  onChange, 
  placeholder,
  className = "w-full p-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-indigo-500"
}: { 
  value: number | '', 
  initialLabel?: string, 
  onChange: (val: number | '') => void, 
  placeholder: string,
  className?: string
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<{id: number, label: string}[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchOptions = async () => {
      const trimmed = search.trim().replace(/\s+/g, '');
      if (!trimmed) {
        setOptions([]);
        return;
      }
      
      const res = await searchCreatorsAction(trimmed);
      if (res.success && res.data) {
        // Sort locally: 1. Starts with search, 2. Contains search exactly, 3. Length
        const sorted = res.data.map((d: any) => ({ id: d.id, label: `@${d.username}` })).sort((a: any, b: any) => {
          const aLower = a.label.toLowerCase();
          const bLower = b.label.toLowerCase();
          const searchLower = trimmed.toLowerCase();
          
          const aStarts = aLower.startsWith('@' + searchLower);
          const bStarts = bLower.startsWith('@' + searchLower);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          
          const aExact = aLower.includes(searchLower);
          const bExact = bLower.includes(searchLower);
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          
          return a.label.length - b.label.length;
        });
        setOptions(sorted);
      }
    };

    const handler = setTimeout(fetchOptions, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const displayValue = open ? search : (value ? (options.find(o => o.id === value)?.label || initialLabel || search) : "");

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        value={displayValue}
        onClick={() => { setOpen(true); setSearch(""); }}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div className="absolute right-0 z-50 w-[250px] mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-2 text-xs text-slate-500 text-center">
              {search.trim() ? "Tidak ditemukan" : "Ketik untuk mencari..."}
            </div>
          ) : (
            <>
              {options.map(opt => (
                <div
                  key={opt.id}
                  className="p-2 text-xs hover:bg-slate-50 cursor-pointer"
                  onClick={() => {
                    onChange(opt.id);
                    setSearch(opt.label);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
