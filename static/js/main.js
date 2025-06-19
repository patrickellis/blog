document.addEventListener("DOMContentLoaded", () => {
  setupModal();
  renderAllLatex();
  updateActiveLink(window.location.pathname);
});

document.body.addEventListener("htmx:afterSwap", function (evt) {
  // This is the key event for dynamic content. We re-render LaTeX after
  // any htmx content swap (like loading a new post).
  renderAllLatex();
});

document.body.addEventListener("htmx:afterRequest", function (evt) {
  const path = evt.detail.pathInfo.requestPath;
  updateActiveLink(path);
  if (evt.detail.target.id === "modal-content") {
    const modal = document.getElementById("search-modal");
    modal.classList.remove("hidden");
  }
});

function setupModal() {
  const modal = document.getElementById("search-modal");
  if (!modal) return;
  const closeButton = modal.querySelector(".modal-close");
  closeButton.addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      modal.classList.add("hidden");
    }
  });
}

function updateActiveLink(path) {
  const topNavLinks = document.querySelectorAll(".content-nav a");
  topNavLinks.forEach((link) => {
    if (link.getAttribute("href") === path) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
  const explorerLinks = document.querySelectorAll(".post-list a");
  explorerLinks.forEach((link) => {
    if (link.getAttribute("href") === path) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

// UPDATED: This function now renders both block and inline LaTeX.
function renderAllLatex() {
  // Render block-level math
  const latexBlocks = document.querySelectorAll(".latex-block");
  latexBlocks.forEach((block) => {
    const latexSource = block.dataset.source;
    if (latexSource && !block.dataset.rendered) {
      try {
        katex.render(latexSource, block, {
          throwOnError: false,
          displayMode: true,
        });
        block.dataset.rendered = "true";
        if (!block.dataset.listenerAdded) {
          block.addEventListener("click", () =>
            toggleLatexSource(block, latexSource),
          );
          block.dataset.listenerAdded = "true";
        }
      } catch (e) {
        block.innerHTML = `<p style="color:red;">Error rendering LaTeX: ${e.message}</p>`;
      }
    }
  });

  // Render inline math
  const latexInlines = document.querySelectorAll(".latex-inline");
  latexInlines.forEach((span) => {
    const latexSource = span.dataset.source;
    if (latexSource && !span.dataset.rendered) {
      try {
        // Use `displayMode: false` for inline math
        katex.render(latexSource, span, {
          throwOnError: false,
          displayMode: false,
        });
        span.dataset.rendered = "true";
        // No click-to-reveal for inline math to avoid cluttering paragraphs.
      } catch (e) {
        span.textContent = `[LaTeX Error: ${e.message}]`;
        span.style.color = "red";
      }
    }
  });
}

function toggleLatexSource(block, source) {
  let sourceEl = block.nextElementSibling;
  if (sourceEl && sourceEl.classList.contains("latex-source")) {
    sourceEl.style.display =
      sourceEl.style.display === "none" ? "block" : "none";
  } else {
    sourceEl = document.createElement("div");
    sourceEl.className = "latex-source";
    sourceEl.style.display = "block";
    sourceEl.textContent = source;
    block.parentNode.insertBefore(sourceEl, block.nextSibling);
  }
}
