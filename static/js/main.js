/*
  This script handles client-side interactivity for the blog.
  1. Renders LaTeX equations using the KaTeX library.
  2. Implements the "click-to-reveal" source for LaTeX blocks.
*/

// Run on initial page load
document.addEventListener("DOMContentLoaded", () => {
  renderAllLatex();
});

// htmx swaps content without a full page reload. This event listener
// ensures that after new content is loaded into the page, we find
// and render any new LaTeX blocks within that content.
document.body.addEventListener("htmx:afterSwap", function (evt) {
  renderAllLatex();
});

function renderAllLatex() {
  // Find all divs with the 'latex-block' class that we create in our Go backend.
  const latexBlocks = document.querySelectorAll(".latex-block");

  latexBlocks.forEach((block) => {
    // The raw LaTeX source is stored in the 'data-source' attribute.
    const latexSource = block.dataset.source;
    if (latexSource) {
      try {
        // Use the KaTeX library to render the math formula inside the div.
        // This replaces the raw text with beautifully typeset math.
        katex.render(latexSource, block, {
          throwOnError: false,
          displayMode: true, // Render as a block element
        });

        // Add a click listener to the block to toggle the source code view.
        // We add a 'data-listener-added' flag to prevent adding it multiple times.
        if (!block.dataset.listenerAdded) {
          block.addEventListener("click", () =>
            toggleLatexSource(block, latexSource),
          );
          block.dataset.listenerAdded = "true";
        }
      } catch (e) {
        // If KaTeX fails, display an error message.
        block.innerHTML = `<p style="color:red;">Error rendering LaTeX: ${e.message}</p>`;
      }
    }
  });
}

function toggleLatexSource(block, source) {
  // Check if the source code element already exists as the next sibling.
  let sourceEl = block.nextElementSibling;

  if (sourceEl && sourceEl.classList.contains("latex-source")) {
    // If it exists, just toggle its visibility.
    sourceEl.style.display =
      sourceEl.style.display === "none" ? "block" : "none";
  } else {
    // If it doesn't exist, create it.
    sourceEl = document.createElement("div");
    sourceEl.className = "latex-source";
    sourceEl.textContent = source;
    // Insert the new source element right after the rendered LaTeX block.
    block.parentNode.insertBefore(sourceEl, block.nextSibling);
  }
}
