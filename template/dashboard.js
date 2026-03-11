function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(function (b) {
    b.classList.remove("active");
  });
  document.querySelectorAll(".tab-content").forEach(function (c) {
    c.classList.remove("active");
  });
  var btn = document.querySelector('.tab-btn[data-tab="' + tabName + '"]');
  if (btn) btn.classList.add("active");
  var content = document.getElementById("tab-" + tabName);
  if (content) content.classList.add("active");
}
document.querySelectorAll(".tab-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    switchTab(btn.dataset.tab);
  });
});
document.querySelectorAll(".stat[data-nav]").forEach(function (stat) {
  stat.addEventListener("click", function () {
    switchTab(stat.dataset.nav);
    if (stat.dataset.section) {
      var el = document.getElementById(stat.dataset.section);
      if (el)
        setTimeout(function () {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
    }
  });
});

var input = document.getElementById("search");
var hint = document.querySelector(".search-hint");

input.addEventListener("input", function (e) {
  var q = e.target.value.toLowerCase();
  hint.style.display = q ? "none" : "";
  document.querySelectorAll(".repo-card").forEach(function (card) {
    var name = card.dataset.name.toLowerCase();
    var path = (card.dataset.path || "").toLowerCase();
    var text = card.textContent.toLowerCase();
    card.style.display =
      q === "" || name.includes(q) || path.includes(q) || text.includes(q) ? "" : "none";
  });
});

document.addEventListener("keydown", function (e) {
  if (e.key === "/" && document.activeElement !== input) {
    e.preventDefault();
    // Switch to repos tab first
    document.querySelectorAll(".tab-btn").forEach(function (b) {
      b.classList.remove("active");
    });
    document.querySelectorAll(".tab-content").forEach(function (c) {
      c.classList.remove("active");
    });
    document.querySelector('[data-tab="repos"]').classList.add("active");
    document.getElementById("tab-repos").classList.add("active");
    input.focus();
  }
  if (e.key === "Escape" && document.activeElement === input) {
    input.value = "";
    input.dispatchEvent(new Event("input"));
    input.blur();
  }
});

var toggle = document.getElementById("theme-toggle");
var saved = localStorage.getItem("ccd-theme");
if (saved) document.documentElement.setAttribute("data-theme", saved);
else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
  document.documentElement.setAttribute("data-theme", "light");
}
toggle.addEventListener("click", function () {
  var current = document.documentElement.getAttribute("data-theme");
  var next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("ccd-theme", next);
});

var groupSelect = document.getElementById("group-by");
groupSelect.addEventListener("change", function () {
  var mode = this.value;
  var grid = document.getElementById("repo-grid");
  grid.querySelectorAll(".group-heading").forEach(function (h) {
    h.remove();
  });
  var cards = Array.from(grid.querySelectorAll(".repo-card"));
  if (mode === "none") {
    cards.forEach(function (c) {
      grid.appendChild(c);
    });
    return;
  }
  var groups = {};
  cards.forEach(function (card) {
    if (mode === "stack") {
      var stacks = (card.dataset.stack || "undetected").split(",");
      stacks.forEach(function (s) {
        var key = s.trim() || "undetected";
        if (!groups[key]) groups[key] = [];
        groups[key].push(card);
      });
    } else {
      var key = card.dataset.parent || "~/";
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    }
  });
  Object.keys(groups)
    .sort()
    .forEach(function (key) {
      var h = document.createElement("div");
      h.className = "group-heading";
      h.textContent = key || "(none)";
      grid.appendChild(h);
      groups[key].forEach(function (card) {
        grid.appendChild(card);
      });
    });
});

// ── Toast helper ────────────────────────────────────────────
var toast = document.createElement("div");
toast.className = "copy-toast";
document.body.appendChild(toast);
var toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.classList.remove("visible");
  }, 2000);
}

// ── Copy Markdown button ────────────────────────────────────
document.querySelectorAll(".copy-md-btn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var card = btn.closest("[data-markdown]");
    if (!card) return;
    var md = card.dataset.markdown;
    navigator.clipboard.writeText(md).then(function () {
      showToast("Markdown copied to clipboard");
    });
  });
});

// ── Refresh button ──────────────────────────────────────────
var refreshBtn = document.getElementById("refresh-btn");
if (refreshBtn) {
  refreshBtn.addEventListener("click", function () {
    navigator.clipboard.writeText("claude-code-dashboard --open").then(function () {
      showToast("Copied \u2014 paste in terminal to refresh");
    });
  });
}

// Custom tooltip for heatmap cells and peak bars
var tip = document.getElementById("chart-tooltip");
document.addEventListener("mouseover", function (e) {
  var t = e.target.closest(".heatmap-cell, .peak-bar");
  if (t && t.title) {
    tip.textContent = t.title;
    tip.classList.add("visible");
    t.dataset.tip = t.title;
    t.removeAttribute("title");
  }
});
document.addEventListener("mousemove", function (e) {
  if (tip.classList.contains("visible")) {
    tip.style.left = e.clientX + 12 + "px";
    tip.style.top = e.clientY - 28 + "px";
  }
});
document.addEventListener("mouseout", function (e) {
  var t = e.target.closest(".heatmap-cell, .peak-bar");
  if (t && t.dataset.tip) {
    t.title = t.dataset.tip;
    delete t.dataset.tip;
  }
  if (
    !e.relatedTarget ||
    !e.relatedTarget.closest ||
    !e.relatedTarget.closest(".heatmap-cell, .peak-bar")
  ) {
    tip.classList.remove("visible");
  }
});
