// dsh-markdown-to-html — Markdown 转 HTML（基础实现，纯 Node）。
import { defineTool } from "@deepseek-ai/dsh-tools";

const name = "Markdown 转 HTML";
const inject = ["tools"];

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 行内格式：加粗/斜体/行内代码/链接/图片。 */
function inline(s) {
  let t = escapeHtml(s);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  t = t.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  return t;
}

/** 基础 Markdown → HTML。支持标题/列表/代码块/引用/分隔线/段落/行内。 */
function markdownToHtml(md) {
  const lines = String(md).replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let inList = null; // 'ul' | 'ol'
  while (i < lines.length) {
    const line = lines[i];
    // 代码块 ```
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // 跳过结尾 ```
      out.push("<pre><code>" + escapeHtml(buf.join("\n")) + "</code></pre>");
      continue;
    }
    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)/);
    if (h) { const n = h[1].length; out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
    // 分隔线
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    // 引用
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push("<blockquote>" + buf.map(inline).join("<br>") + "</blockquote>");
      continue;
    }
    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      if (inList !== "ul") { if (inList) out.push(`</${inList}>`); out.push("<ul>"); inList = "ul"; }
      out.push("<li>" + inline(line.replace(/^\s*[-*+]\s+/, "")) + "</li>"); i++; continue;
    }
    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      if (inList !== "ol") { if (inList) out.push(`</${inList}>`); out.push("<ol>"); inList = "ol"; }
      out.push("<li>" + inline(line.replace(/^\s*\d+\.\s+/, "")) + "</li>"); i++; continue;
    }
    // 空行
    if (/^\s*$/.test(line)) {
      if (inList) { out.push(`</${inList}>`); inList = null; }
      i++; continue;
    }
    // 普通段落（合并相邻行）
    if (inList) { out.push(`</${inList}>`); inList = null; }
    const buf = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|```|>\s?|[-*+]\s|\d+\.\s)/.test(lines[i])) { buf.push(lines[i]); i++; }
    out.push("<p>" + buf.map(inline).join(" ") + "</p>");
  }
  if (inList) out.push(`</${inList}>`);
  return out.join("\n");
}

async function apply(ctx, _config) {
  ctx.tools.register(defineTool({
    name: "markdown_to_html",
    description: "把 Markdown 转换为 HTML（基础实现：标题/列表/代码块/引用/分隔线/链接/图片/加粗/斜体/行内代码）。适合常规文档，复杂语法建议用 marked 等完整库。",
    parameters: { markdown: { type: "string", required: true, description: "Markdown 文本。" } },
    output: {
      schema: {
        type: "object", additionalProperties: false,
        properties: { html: { type: "string", required: true } },
      },
      render: (_a, v) => [{ type: "text", text: v.html }],
    },
    execute: async (args) => ({ html: markdownToHtml(args.markdown) }),
  }));
}

export { apply, inject, name };
