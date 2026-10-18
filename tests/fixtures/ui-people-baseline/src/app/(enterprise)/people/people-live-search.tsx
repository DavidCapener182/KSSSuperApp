"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function PeopleLiveSearch({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (document.activeElement !== input.current) setValue(initialValue);
  }, [initialValue]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function update(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (next.trim()) params.set("search", next.trim());
      else params.delete("search");
      params.delete("offset");
      router.replace(`/people?${params.toString()}`, { scroll: false });
    }, 250);
  }

  return <input ref={input} name="search" maxLength={100} value={value}
    onChange={(event) => update(event.target.value)} placeholder="Search People" autoComplete="off" />;
}
