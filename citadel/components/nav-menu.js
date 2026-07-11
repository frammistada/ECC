"use client";

import { useState } from "react";
import Link from "next/link";
import { MenuMark } from "@/components/icons";

// The app-sections drawer, opened from the hamburger in the top-left of
// the entry screen. The trigger is a symbol like the rest of the nav; the
// list inside uses text labels because sections need names. Unbuilt
// sections are shown grayed out (not hidden) with a mono "soon" tag, so
// the shape of the app is visible before every room exists.
// Two paid rooms live here. No-Mentor Journaling (/journal) is hidden
// entirely from free users — it was never a placeholder, so showing it
// would be a pure upsell. Reminders (/reminders) has long sat here as a
// grayed "soon" item, so free users keep seeing it that way (it becomes a
// live link once they subscribe) rather than having it vanish. Sections
// without an href render grayed with a "soon" tag.
const FREE_SECTIONS = [
  { label: "Who am I", href: "/who-am-i" },
  { label: "To Myself", href: "/to-myself" },
  { label: "Reminders" },
];

const SUBSCRIBED_SECTIONS = [
  { label: "Who am I", href: "/who-am-i" },
  { label: "To Myself", href: "/to-myself" },
  { label: "No-Mentor Journaling", href: "/journal" },
  { label: "Reminders", href: "/reminders" },
];

export default function NavMenu({ subscribed = false }) {
  const [open, setOpen] = useState(false);
  const sections = subscribed ? SUBSCRIBED_SECTIONS : FREE_SECTIONS;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="menu"
        title="menu"
      >
        <MenuMark className="h-6 w-6" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-night/80"
          onClick={() => setOpen(false)}
        >
          <nav
            aria-label="app sections"
            className="h-full w-72 max-w-[80vw] animate-settle border-r border-parchment/15 bg-panel px-6 pt-20"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-4 font-mono text-xs tracking-[0.2em] text-ash">
              citadel
            </p>
            <ul className="mt-5 flex flex-col gap-1.5">
              {sections.map((s) => (
                <li key={s.label}>
                  {s.href ? (
                    <Link
                      href={s.href}
                      onClick={() => setOpen(false)}
                      className="block border-l border-ash/30 px-4 py-3 text-lg text-parchment transition-colors hover:bg-parchment/10"
                    >
                      {s.label}
                    </Link>
                  ) : (
                    <span className="flex items-baseline justify-between gap-3 border-l border-ash/15 px-4 py-3 text-lg text-parchment/35">
                      {s.label}
                      <span className="font-mono text-[10px] text-ash/70">
                        soon
                      </span>
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {/* Plain anchor, not a Link: the route answers with a file
                download (Content-Disposition), not a page. Free on every
                tier — a trust feature, never gated. */}
            <a
              href="/api/export"
              onClick={() => setOpen(false)}
              className="mt-8 block border-t border-parchment/15 px-4 pt-6 font-mono text-xs text-ash underline decoration-1 underline-offset-4"
            >
              export my data
            </a>
          </nav>
        </div>
      )}
    </>
  );
}
