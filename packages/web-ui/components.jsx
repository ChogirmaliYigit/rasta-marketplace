import React, { useEffect, useId, useRef, useState } from "react";
import { Glass } from "@samasante/liquid-glass";
import { Check, ChevronDown, Search, X } from "lucide-react";
export function Panel({ children, className = "" }) {
  return (
    <Glass
      className={"glass " + className}
      style={{ display: "block", minWidth: 0 }}
      optics={{ frost: 12, strength: 0.15, dispersion: 0.2 }}
    >
      {children}
    </Glass>
  );
}
export function Select({
  label,
  options,
  value,
  onChange,
  searchable = false,
  creatable = false,
  placeholder = "Tanlang",
  name,
}) {
  const id = useId(),
    ref = useRef(null),
    [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const normalized = options.map((o) =>
      typeof o === "string" ? { value: o, label: o } : o,
    ),
    chosen = normalized.find((o) => o.value === value);
  const filtered = normalized.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );
  const list =
    creatable &&
    query.trim() &&
    !normalized.some(
      (o) => o.label.toLowerCase() === query.trim().toLowerCase(),
    )
      ? [
          ...filtered,
          {
            value: query.trim(),
            label: `“${query.trim()}” — yangi do‘kon`,
            create: true,
          },
        ]
      : filtered;
  useEffect(() => {
    const outside = (e) => {
      if (!ref.current?.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const choose = (o) => {
    onChange(o.value, o.create);
    setOpen(false);
    setQuery("");
    ref.current?.querySelector('[role="combobox"]')?.focus();
  };
  const keys = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      setQuery("");
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) =>
        Math.max(
          0,
          Math.min(list.length - 1, a + (e.key === "ArrowDown" ? 1 : -1)),
        ),
      );
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && list[active]) choose(list[active]);
      else setOpen(true);
    }
    if (e.key === "Tab") setOpen(false);
  };
  return (
    <div className="select-field" ref={ref}>
      <label id={id + "-label"}>{label}</label>
      {name && <input type="hidden" name={name} value={value || ""} />}
      <div className="select-control">
        {searchable ? (
          <input
            role="combobox"
            aria-labelledby={id + "-label"}
            aria-controls={id}
            aria-expanded={open}
            aria-autocomplete="list"
            aria-activedescendant={
              open && list[active] ? `${id}-${active}` : undefined
            }
            value={open ? query : chosen?.label || value || ""}
            placeholder={placeholder}
            onFocus={() => {
              setOpen(true);
              setQuery("");
              setActive(0);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onKeyDown={keys}
          />
        ) : (
          <button
            type="button"
            role="combobox"
            aria-labelledby={id + "-label"}
            aria-controls={id}
            aria-expanded={open}
            aria-activedescendant={
              open && list[active] ? `${id}-${active}` : undefined
            }
            onKeyDown={keys}
            onClick={() => {
              setOpen(!open);
              setActive(0);
            }}
          >
            {chosen?.label || placeholder}
          </button>
        )}
        <ChevronDown size={16} />
      </div>
      {open && (
        <div
          className="select-menu"
          id={id}
          role="listbox"
          aria-labelledby={id + "-label"}
        >
          {!list.length && <p>Natija topilmadi</p>}
          {list.map((o, i) => (
            <button
              type="button"
              role="option"
              id={`${id}-${i}`}
              aria-selected={o.value === value}
              className={i === active ? "focused" : ""}
              key={o.value}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
            >
              {o.label}
              {o.value === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null),
    id = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const controls = () =>
      [
        ...ref.current.querySelectorAll('button,input,textarea,[tabindex="0"]'),
      ].filter((el) => !el.disabled && el.type !== "hidden");
    controls()[0]?.focus();
    const key = (e) => {
      if (e.key === "Escape" && e.target.getAttribute("aria-expanded") !== "true") onClose();
      if (e.key === "Tab") {
        const all = controls(),
          first = all[0],
          last = all.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    const el = ref.current;
    el.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <Panel className={"modal " + (wide ? "wide" : "")}>
        <div role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
          <div className="section-head">
            <h2 id={id}>{title}</h2>
            <button
              className="icon-button"
              aria-label="Yopish"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
          {children}
        </div>
      </Panel>
    </div>
  );
}
export function Field({ label, ...props }) {
  return (
    <label className="field">
      {label}
      <input {...props} />
    </label>
  );
}
export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}
export function SearchBox({ value, onChange }) {
  return (
    <label className="search">
      <Search size={17} />
      <input
        id="search"
        aria-label="Qidirish"
        placeholder="Qidirish…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <kbd>⌘ K</kbd>
    </label>
  );
}
export function downloadCSV(name, rows) {
  const cell = (v) => {
    const text = String(v ?? "");
    return (
      '"' +
      (/^[=+@\-]/.test(text) ? "'" : "") +
      text.replaceAll('"', '""') +
      '"'
    );
  };
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
