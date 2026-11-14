import { KB_ARTICLES, searchArticles } from "./kb-docs.js";

const payload = "' OR '1'='1'; DROP TABLE users;--";
const found = searchArticles(payload);
if (!Array.isArray(found)) throw new Error("search did not return a list");
if (found.length !== 0) throw new Error("sql-shaped text matched an article");

const penta = searchArticles("penta framework");
if (!penta.some((article) => article.id === "penta")) {
  throw new Error("penta article missing from search");
}

const story = KB_ARTICLES.find((article) => article.id === "storybook");
if (!story) throw new Error("storybook article missing");
if (!story.title.includes("The Alice and the Scorpion Framework Storybook")) {
  throw new Error("storybook title drifted");
}
if (!story.body.includes("trippyalice.com")) throw new Error("storybook site missing");

const joined = KB_ARTICLES.map((article) => article.title + article.body).join("\n");
if (joined.includes("AAIF")) throw new Error("retired framework name is in the knowledge base");
if (!joined.includes("Law #2")) throw new Error("child safety law missing");
if (!joined.includes("private networks")) throw new Error("browser boundary missing");
if (!KB_ARTICLES.some((article) => article.title === "ASX Web Observer")) {
  throw new Error("observer name missing");
}

const identity = KB_ARTICLES.find((article) => article.id === "identity");
if (!identity) throw new Error("identity article missing");
if (!identity.title.includes("Alison Scorpion Framework")) {
  throw new Error("identity title should name the Framework");
}
if (!identity.body.includes("trippyalice.com")) {
  throw new Error("identity should point story to trippyalice.com");
}
for (const banned of ["Lady Alpha", "Scorpus", "Aletheia", "QLA", "Queen Lady Alpha"]) {
  if (joined.includes(banned)) {
    throw new Error(`public KB must not name ${banned}`);
  }
}

console.log("knowledge base tests passed");
