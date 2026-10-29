/**
 * Knowledge Base window. Articles are local. The search box never leaves the page.
 */
import { KB_ARTICLES, searchArticles } from "./kb-docs.js?v=20261027observer1";

export function openKnowledge(wm) {
  const root = document.createElement("div");
  root.className = "kb";

  const side = document.createElement("div");
  side.className = "kb-side";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Search the doctrine";
  search.setAttribute("aria-label", "Search the knowledge base");
  search.spellcheck = true;
  search.autocomplete = "off";
  const list = document.createElement("div");
  list.className = "kb-list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Articles");
  side.appendChild(search);
  side.appendChild(list);

  const body = document.createElement("article");
  body.className = "kb-body";
  const heading = document.createElement("h2");
  const paras = document.createElement("div");
  body.appendChild(heading);
  body.appendChild(paras);

  root.appendChild(side);
  root.appendChild(body);

  let current = KB_ARTICLES[0]?.id || "";

  const show = (article) => {
    current = article.id;
    heading.textContent = article.title;
    paras.replaceChildren();
    article.body.split(/\n\n+/).forEach((block) => {
      const p = document.createElement("p");
      p.textContent = block;
      paras.appendChild(p);
    });
    list.querySelectorAll("button").forEach((button) => {
      const on = button.dataset.id === article.id;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-selected", on ? "true" : "false");
    });
  };

  const renderList = () => {
    const matches = searchArticles(search.value);
    list.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "kb-empty";
      empty.textContent = "No article contains that text.";
      list.appendChild(empty);
      return;
    }
    matches.forEach((article) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.id = article.id;
      button.textContent = article.title;
      button.setAttribute("role", "option");
      button.addEventListener("click", () => show(article));
      list.appendChild(button);
    });
    const selected = matches.find((article) => article.id === current) || matches[0];
    show(selected);
  };

  search.addEventListener("input", renderList);

  wm.open({
    id: "knowledge",
    title: "Knowledge Base",
    w: 880,
    h: 560,
    x: 96,
    y: 48,
    body: root,
    onMount: () => {
      renderList();
      search.focus();
    },
  });
}
