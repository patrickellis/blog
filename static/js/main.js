document.addEventListener("DOMContentLoaded", () => {
  // Initial setup on page load
  setupModal();
  renderAllLatex();
  updateActiveLink(window.location.pathname);
});

// htmx triggers this after any content swap
document.body.addEventListener("htmx:afterSwap", function (evt) {
  renderAllLatex();
});

// htmx triggers this after a request, successful or not
document.body.addEventListener("htmx:afterRequest", function (evt) {
  // Update active link highlighting based on the request path
  const path = evt.detail.pathInfo.requestPath;
  updateActiveLink(path);

  // If the request was from the search bar, show the modal
  if (evt.detail.target.id === "modal-content") {
    const modal = document.getElementById("search-modal");
    modal.classList.remove("hidden");
  }
});

function setupModal() {
  const modal = document.getElementById("search-modal");
  if (!modal) return;

  const closeButton = modal.querySelector(".modal-close");

  // Hide modal on close button click
  closeButton.addEventListener("click", () => modal.classList.add("hidden"));

  // Hide modal on clicking the overlay background
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
    }
  });

  // Hide modal on Escape key press
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
      modal.classList.add("hidden");
    }
  });
}

function updateActiveLink(path) {
  // For top nav (Home, About)
  const topNavLinks = document.querySelectorAll(".content-nav a");
  topNavLinks.forEach((link) => {
    if (link.getAttribute("href") === path) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // For explorer post list
  const explorerLinks = document.querySelectorAll(".post-list a");
  explorerLinks.forEach((link) => {
    if (link.getAttribute("href") === path) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

// ... The LaTeX functions (renderAllLatex, toggleLatexSource) are unchanged ...

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
