"use client";

import { useEffect } from "react";

/** Keeps a record's anchor navigation aligned with the section in view. */
export function RecordSectionTracker({ label }: { label: string }) {
  useEffect(() => {
    let dispose: (() => void) | undefined;
    const observer = new MutationObserver(() => { if (!dispose) attach(); });
    function attach() {
    const nav = [...document.querySelectorAll<HTMLElement>("nav[aria-label]")].find(node => node.getAttribute("aria-label") === label);
    if (!nav) return;
    const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
    const sections = links.map(link => document.getElementById(decodeURIComponent(link.hash.slice(1))));
    if (!links.length || sections.some(section => !section)) return;
    observer.disconnect();
    let frame = 0;
    let selected: HTMLAnchorElement | null = null;
    const select = (link: HTMLAnchorElement) => {
      if (selected === link) return;
      selected = link;
      links.forEach(candidate => candidate === link ? candidate.setAttribute("aria-current", "location") : candidate.removeAttribute("aria-current"));
      nav.scrollTo({ left: link.offsetLeft - nav.offsetLeft - (nav.clientWidth - link.clientWidth) / 2, behavior: "instant" });
    };
    const update = () => {
      frame = 0;
      const threshold = nav.getBoundingClientRect().bottom + 24;
        let index = 0;
        let nearestTop = -Infinity;
        sections.forEach((section, candidate) => {
          const top = section?.getBoundingClientRect().top ?? Infinity;
          if (top <= threshold && top > nearestTop + 1) { index = candidate; nearestTop = top; }
        });
        const last = sections.at(-1)?.getBoundingClientRect();
        if (last && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2 && last.top < window.innerHeight && last.bottom > threshold) index = links.length - 1;
        select(links[index]);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      if (link && nav.contains(link)) select(link);
    };
    nav.addEventListener("click", onClick);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    schedule();
    dispose = () => {
      window.cancelAnimationFrame(frame);
      nav.removeEventListener("click", onClick);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
    };
    }
    attach();
    if (!dispose) observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); dispose?.(); };
  }, [label]);
  return null;
}
