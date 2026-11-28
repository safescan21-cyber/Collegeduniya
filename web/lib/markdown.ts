import { marked } from 'marked';

// Articles are written by admins only. We still strip <script>, inline event
// handlers and javascript: URLs as a safety net.
export function renderMarkdown(md: string) {
  const html = marked.parse(md || '', { async: false, gfm: true, breaks: true }) as string;
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<(iframe|object|embed|style)[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}
