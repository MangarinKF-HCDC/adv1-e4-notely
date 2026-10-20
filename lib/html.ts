import DOMPurify from "dompurify";

let checkboxHookInstalled = false;
export function sanitizeHtml(html: string) {
  if (typeof window === "undefined") return "";
  if (!checkboxHookInstalled) {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.nodeName === "INPUT" && node.getAttribute("type") !== "checkbox") node.remove();
    });
    checkboxHookInstalled = true;
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "span", "blockquote", "div", "label", "input"],
    ALLOWED_ATTR: ["style", "type", "start", "class", "checked", "data-type", "data-checked"],
  });
}

export function htmlToText(html: string) {
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, " ");
  const element = document.createElement("div");
  element.innerHTML = sanitizeHtml(html);
  return element.textContent || "";
}

export function toEditorHtml(description: string) {
  if (/<\/?(?:p|div|span|strong|em|u|s|ul|ol|li|br)\b/i.test(description)) return sanitizeHtml(description);
  return "<p>" + description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>") + "</p>";
}