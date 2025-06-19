document.addEventListener("DOMContentLoaded", () => {
  // Initial setup on page load
  setupModal();
  renderAllLatex();
  updateActiveLinks(window.location.pathname);
});

// A single, robust event listener for all htmx content swaps
document.body.addEventListener("htmx:afterSwap", function (evt) {
  // Re-render LaTeX for any new content that has appeared
  renderAllLatex();

  // The URL in the browser bar has been updated by hx-push-url, so we use it as the source of truth.
  updateActiveLinks(window.location.pathname);

  // Check if the content that was just swapped in was for the modal
  // evt.detail.target is the element that received the new content
  if (evt.detail.target.id === "modal-content") {
    const modal = document.getElementById("search-modal");
    if (modal) {
      modal.classList.remove("hidden");
    }
  }
});

function setupModal() {
  const modal = document.getElementById("search-modal");
  if (!modal) return;
  const closeButton = modal.querySelector(".modal-close");
  closeButton.addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      modal.classList.add("hidden");
    }
  });
}

function updateActiveLinks(path) {
  // Top navigation tabs
  const topNavLinks = document.querySelectorAll(".content-nav a");
  topNavLinks.forEach((link) => {
    if (link.getAttribute("href") === path) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // Explorer post list
  const explorerLinks = document.querySelectorAll(".post-list a");
  explorerLinks.forEach((link) => {
    if (link.getAttribute("href") === path) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

function renderAllLatex() {
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

  const latexInlines = document.querySelectorAll(".latex-inline");
  latexInlines.forEach((span) => {
    const latexSource = span.dataset.source;
    if (latexSource && !span.dataset.rendered) {
      try {
        katex.render(latexSource, span, {
          throwOnError: false,
          displayMode: false,
        });
        span.dataset.rendered = "true";
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
