/**
 * URL Downloader. Saves a public PDF, JPG, PNG, or web page on this laptop.
 * Free. No account. A progress bar runs until the Completed option is available.
 */
const BRIDGE = "http://127.0.0.1:8791/download?u=";
const STATUS = "http://127.0.0.1:8791/download/status?id=";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function openUrlDownloader(wm) {
  const root = el("div", "app-pad");
  const style = document.createElement("style");
  style.textContent = [
    ".url-dl-bar{height:12px;margin:12px 0 8px;background:rgba(255,255,255,.08);",
    "border:1px solid var(--border);border-radius:3px;overflow:hidden}",
    ".url-dl-fill{height:100%;width:0;background:var(--brand)}",
    ".url-dl-options{border:1px solid var(--border);border-radius:3px;padding:8px 10px;margin-top:8px}",
    ".url-dl-options legend{padding:0 4px;color:var(--muted)}",
    ".url-dl-options label{display:flex;gap:8px;align-items:center;margin:4px 0}",
  ].join("");
  const form = document.createElement("form");
  form.style.display = "flex";
  form.style.gap = "8px";
  form.style.margin = "12px 0";
  const input = document.createElement("input");
  input.type = "url";
  input.placeholder = "https://";
  input.spellcheck = false;
  input.autocomplete = "off";
  input.setAttribute("aria-label", "URL to download");
  input.style.flex = "1";
  const button = el("button", "primary", "Download");
  button.type = "submit";
  const status = el(
    "p",
    "",
    "PDF, JPG, PNG, or the HTML of a page. The file goes to Downloads on this laptop."
  );
  const bar = el("div", "url-dl-bar");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-valuenow", "0");
  bar.setAttribute("aria-label", "Download progress");
  const fill = el("div", "url-dl-fill");
  bar.append(fill);
  const options = document.createElement("fieldset");
  options.className = "url-dl-options";
  options.append(el("legend", "", "Status"));
  const progressLabel = el("label");
  const progressOption = document.createElement("input");
  progressOption.type = "radio";
  progressOption.name = "url-dl-state";
  progressOption.value = "progress";
  progressOption.checked = true;
  progressLabel.append(progressOption, document.createTextNode("In progress"));
  const completedLabel = el("label");
  const completedOption = document.createElement("input");
  completedOption.type = "radio";
  completedOption.name = "url-dl-state";
  completedOption.value = "completed";
  completedOption.disabled = true;
  completedLabel.append(completedOption, document.createTextNode("Completed"));
  options.append(progressLabel, completedLabel);
  form.append(input, button);
  root.append(
    style,
    el("h2", "", "URL Downloader"),
    el("p", "", "Free. No account. The file is saved as it is."),
    form,
    bar,
    options,
    status
  );

  function setProgress(received, total, done) {
    const cap = total > 0 ? total : 8000000;
    const pct = done ? 100 : Math.min(99, Math.round((received / cap) * 100));
    fill.style.width = pct + "%";
    bar.setAttribute("aria-valuenow", String(pct));
  }

  function markCompleted(name) {
    progressOption.checked = false;
    progressOption.disabled = true;
    completedOption.disabled = false;
    completedOption.checked = true;
    setProgress(1, 1, true);
    status.textContent = name + " is in Downloads on this laptop.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    let raw = input.value.trim();
    if (!raw) {
      status.textContent = "Enter an address.";
      return;
    }
    if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
    button.disabled = true;
    progressOption.disabled = false;
    progressOption.checked = true;
    completedOption.checked = false;
    completedOption.disabled = true;
    setProgress(0, 0, false);
    status.textContent = "Downloading…";
    try {
      const response = await fetch(BRIDGE + encodeURIComponent(raw));
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !/^[0-9a-f]{32}$/.test(String(data.id || ""))) {
        status.textContent = data.reason || "That address could not be saved.";
        return;
      }
      for (let tick = 0; tick < 600 && root.isConnected; tick += 1) {
        await sleep(300);
        const probe = await fetch(STATUS + data.id);
        const row = await probe.json().catch(() => ({}));
        if (!probe.ok) {
          status.textContent = row.reason || "That address could not be saved.";
          return;
        }
        setProgress(Number(row.received) || 0, Number(row.total) || 0, row.status === "completed");
        if (row.status === "completed" && row.place === "Downloads" && row.name) {
          markCompleted(String(row.name));
          return;
        }
        if (row.status === "failed") {
          status.textContent = row.reason || "That address could not be saved.";
          return;
        }
        status.textContent = "Downloading…";
      }
      if (root.isConnected) status.textContent = "The download is still running.";
    } catch {
      status.textContent = "URL Downloader needs ASX Web Observer running on this computer.";
    } finally {
      button.disabled = false;
    }
  });

  wm.open({
    id: "url-downloader",
    title: "URL Downloader",
    w: 520,
    h: 360,
    body: root,
  });
}
