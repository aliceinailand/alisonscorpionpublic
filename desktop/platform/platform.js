/* View switches are links. This file only marks the current one and clears a box. It does not send, store, or create anything. */
(function () {
  var known = {
    account: 1,
    dashboard: 1,
    "new": 1,
    containers: 1,
    highlight: 1,
    plans: 1,
    billing: 1,
    settings: 1,
    signup: 1,
    login: 1
  };

  function current() {
    var id = (location.hash || "#dashboard").replace(/^#/, "");
    return known[id] ? id : "dashboard";
  }

  function mark() {
    var id = current();
    var links = document.querySelectorAll("a[href^='#']");
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute("href") === "#" + id) {
        links[i].setAttribute("aria-current", "page");
      } else {
        links[i].removeAttribute("aria-current");
      }
    }
  }

  function bind(buttonId, inputId, noteId) {
    var button = document.getElementById(buttonId);
    if (!button) return;
    button.addEventListener("click", function () {
      var input = document.getElementById(inputId);
      if (input) input.value = "";
      var note = document.getElementById(noteId);
      if (note) note.hidden = false;
    });
  }

  bind("signup-continue", "signup-email", "signup-result");
  bind("login-continue", "login-email", "login-result");
  bind("new-continue", "new-name", "new-result");
  window.addEventListener("hashchange", mark);
  mark();
})();
