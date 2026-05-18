import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { geocodeAutocomplete } from "./api";
import type { GeoPoint } from "./types";

interface Props {
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  onSelect: (point: GeoPoint) => void;
  onEnter?: () => void;
  hasCoords?: boolean;
  coordsDot?: string;
  className?: string;
}

/**
 * Input địa chỉ với autocomplete Nominatim — debounce 400ms.
 * Dropdown dùng React Portal + position:fixed để không bị clip bởi
 * overflow:hidden / overflow-y:auto của panel cha.
 */
export function AddressInput({
  placeholder, value, onChange, onSelect, onEnter,
  hasCoords, coordsDot = "bg-green-500", className,
}: Props) {
  const [suggestions, setSuggestions] = useState<GeoPoint[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Vị trí fixed của dropdown
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tính lại vị trí dropdown mỗi khi mở
  const recalcPosition = useCallback(() => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 2,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, []);

  // Debounce autocomplete
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await geocodeAutocomplete(value);
      setSuggestions(results);
      if (results.length > 0) {
        recalcPosition();
        setOpen(true);
      } else {
        setOpen(false);
      }
      setLoading(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, recalcPosition]);

  // Đóng khi click ra ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!containerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Cập nhật vị trí khi scroll panel (panel có overflow-y:auto)
  useEffect(() => {
    if (!open) return;
    const panel = containerRef.current?.closest("[data-route-panel]") as HTMLElement | null;
    const scrollTarget = panel ?? window;
    const handler = () => { if (open) recalcPosition(); };
    scrollTarget.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      scrollTarget.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [open, recalcPosition]);

  const handleSelect = useCallback((pt: GeoPoint) => {
    onChange(pt.label);
    onSelect(pt);
    setOpen(false);
    setSuggestions([]);
  }, [onChange, onSelect]);

  const shortLabel = (label: string) => {
    const parts = label.split(",").map((s) => s.trim());
    return parts.slice(0, 2).join(", ");
  };

  const dropdown = open && suggestions.length > 0
    ? createPortal(
        <div
          style={dropdownStyle}
          className="rounded-md border bg-popover shadow-xl overflow-hidden"
        >
          {suggestions.map((pt, i) => (
            <button
              key={i}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(pt); }}
              className="w-full text-left px-2.5 py-2 text-[11px] hover:bg-muted transition-colors border-b last:border-0"
            >
              <span className="font-medium text-foreground block truncate">{shortLabel(pt.label)}</span>
              <span className="text-muted-foreground truncate block text-[10px]">{pt.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <div ref={containerRef} className={cn("relative flex-1", className)}>
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { setOpen(false); onEnter?.(); }
          if (e.key === "Escape") setOpen(false);
          if (e.key === "ArrowDown" || e.key === "ArrowUp") e.preventDefault();
        }}
        onFocus={() => { if (suggestions.length > 0) { recalcPosition(); setOpen(true); } }}
        className="h-8 text-[12px] pr-6"
        autoComplete="off"
      />

      {/* Indicator dot hoặc spinner */}
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
        {loading
          ? <span className="inline-block w-2.5 h-2.5 border-[1.5px] border-primary border-t-transparent rounded-full animate-spin" />
          : hasCoords
            ? <span className={cn("inline-block w-2 h-2 rounded-full", coordsDot)} title="Từ bản đồ" />
            : null
        }
      </div>

      {dropdown}
    </div>
  );
}