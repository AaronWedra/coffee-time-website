// Tiny HTML templating: a tagged template that escapes interpolations by default.
// `raw()` marks a string as already-safe markup. Arrays are joined, null/undefined/false render as nothing.

export class Safe {
  readonly s: string;
  constructor(s: string) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}

export type Child = string | number | boolean | null | undefined | Safe | Child[];

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(v: unknown): string {
  return String(v).replace(/[&<>"']/g, (c) => ESC[c]);
}

export function render(c: Child): string {
  if (c === null || c === undefined || c === false || c === true) return '';
  if (c instanceof Safe) return c.s;
  if (Array.isArray(c)) return c.map(render).join('');
  return esc(c);
}

export function html(strings: TemplateStringsArray, ...values: Child[]): Safe {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) out += render(values[i]);
  }
  return new Safe(out);
}

export const raw = (s: string) => new Safe(s);

// Plain text (from a textarea) to paragraphs. Blank line = new paragraph, single newline = <br>.
// **bold** is allowed so HQ editors can emphasise a word without writing HTML.
export function paragraphs(text: string): Safe {
  const blocks = (text || '').replace(/\r/g, '').trim().split(/\n{2,}/).filter(Boolean);
  return raw(blocks.map((b) => `<p>${inline(b)}</p>`).join(''));
}

// One line of plain text with **bold**, [text](url) links and line breaks.
// Only http(s), mailto and site-relative links are honoured; external ones open in a new tab.
export function inline(text: string): string {
  return esc(text || '')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|\/)[^)\s]+)\)/g, (_m, label: string, href: string) =>
      /^https?:/.test(href) ? `<a href="${href}" target="_blank" rel="noopener">${label}</a>` : `<a href="${href}">${label}</a>`,
    )
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// Lines starting with "- " become a list; everything else is paragraphs.
export function richText(text: string): Safe {
  const blocks = (text || '').replace(/\r/g, '').trim().split(/\n{2,}/).filter(Boolean);
  return raw(
    blocks
      .map((b) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*-\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*-\s+/, ''))}</li>`).join('')}</ul>`;
        return `<p>${inline(b)}</p>`;
      })
      .join(''),
  );
}
