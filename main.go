package main

import (
	"crypto/subtle"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"

	"github.com/gomarkdown/markdown"
	"github.com/gomarkdown/markdown/parser"
	"gopkg.in/yaml.v2"
)

// --- Structs ---
type Post struct {
	Title       string        `yaml:"title"`
	Date        string        `yaml:"date"`
	Slug        string        `yaml:"-"`
	RawContent  string        `yaml:"-"`
	HTMLContent template.HTML `yaml:"-"`
}

type SearchResult struct {
	Title   string
	Slug    string
	Snippet template.HTML
}

type BlogCache struct {
	mu    sync.RWMutex
	posts []Post
}

type PageData struct {
	Title   string
	Posts   []Post
	Content interface{}
	PageID  string
}

// --- Globals ---
var (
	templates *template.Template
	cache     *BlogCache
	purgeKey  string
)

// --- Main Function ---
func main() {
	purgeKey = os.Getenv("PURGE_KEY")
	if purgeKey == "" {
		log.Println("WARNING: PURGE_KEY environment variable not set.")
	}
	cache = &BlogCache{posts: make([]Post, 0)}
	loadTemplates()
	loadAndCachePosts()
	fs := http.FileServer(http.Dir("./static"))
	staticHandler := http.StripPrefix("/static/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, ".js") {
			w.Header().Set("Content-Type", "application/javascript")
		}
		fs.ServeHTTP(w, r)
	}))
	http.Handle("/static/", staticHandler)
	http.HandleFunc("/", handleHome)
	http.HandleFunc("/about", handleAbout)
	http.HandleFunc("/posts/", handlePost)
	http.HandleFunc("/search-popup", handleSearchPopup)
	http.HandleFunc("/purge-cache", handlePurgeCache)
	http.HandleFunc("/metrics-badge", handleMetricsBadge)
	port := os.Getenv("PORT"); if port == "" {port = "8080"}
	log.Printf("Starting server on port %s...", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {log.Fatal(err)}
}

// --- Helper Functions ---

// UPDATED: This function now processes both block and inline LaTeX.
func renderMarkdownAndLatex(raw string) []byte {
	// 1. Process block-level LaTeX first, to avoid confusion with inline.
	reBlock := regexp.MustCompile(`\$\$([\s\S]*?)\$\$`)
	latexProcessed := reBlock.ReplaceAllStringFunc(raw, func(match string) string {
		latex := strings.Trim(match, "$$")
		return fmt.Sprintf(`<div class="latex-block" data-source="%s">%s</div>`, template.HTMLEscapeString(latex), latex)
	})

	// 2. Process inline LaTeX. The non-greedy `?` is important.
	reInline := regexp.MustCompile(`\$([^\$]+?)\$`)
	latexProcessed = reInline.ReplaceAllStringFunc(latexProcessed, func(match string) string {
		latex := strings.Trim(match, "$")
		// For inline-level, use a span. It will be rendered by KaTeX.
		return fmt.Sprintf(`<span class="latex-inline" data-source="%s">%s</span>`, template.HTMLEscapeString(latex), latex)
	})

	// 3. Process the remaining Markdown content.
	extensions := parser.CommonExtensions | parser.AutoHeadingIDs
	p := parser.NewWithExtensions(extensions)
	return markdown.ToHTML([]byte(latexProcessed), p, nil)
}

// ... rest of helper functions are unchanged ...
func createSnippet(content, query string) template.HTML {
	lowerContent := strings.ToLower(content)
	lowerQuery := strings.ToLower(query)
	idx := strings.Index(lowerContent, lowerQuery)
	if idx == -1 {
		if len(content) > 150 {
			return template.HTML(template.HTMLEscapeString(content[:150]) + "...")
		}
		return template.HTML(template.HTMLEscapeString(content))
	}
	start := idx - 75
	if start < 0 { start = 0 }
	end := idx + len(query) + 75
	if end > len(content) { end = len(content) }
	snippet := content[start:end]
	re := regexp.MustCompile(`(?i)` + regexp.QuoteMeta(query))
	highlighted := re.ReplaceAllString(snippet, "<mark>$0</mark>")
	prefix := ""; if start > 0 { prefix = "..." }
	suffix := ""; if end < len(content) { suffix = "..." }
	return template.HTML(prefix + highlighted + suffix)
}

// --- HTTP Handlers ---
// ... unchanged ...
func handleSearchPopup(w http.ResponseWriter, r *http.Request) {
	query := r.FormValue("q")
	if len(query) < 2 {
		fmt.Fprintf(w, "<p>Please enter at least 2 characters.</p>")
		return
	}
	var results []SearchResult
	cache.mu.RLock()
	posts := cache.posts
	cache.mu.RUnlock()
	for _, post := range posts {
		titleMatch := strings.Contains(strings.ToLower(post.Title), strings.ToLower(query))
		contentMatch := strings.Contains(strings.ToLower(post.RawContent), strings.ToLower(query))
		if titleMatch || contentMatch {
			results = append(results, SearchResult{
				Title:   post.Title,
				Slug:    post.Slug,
				Snippet: createSnippet(post.RawContent, query),
			})
		}
	}
	err := templates.ExecuteTemplate(w, "search-popup-results.html", map[string]interface{}{"Results": results, "Query": query})
	if err != nil {http.Error(w, err.Error(), http.StatusInternalServerError)}
}
func loadTemplates() {
	funcMap := template.FuncMap{"safeHTML": func(s template.HTML) template.HTML { return s }}
	tpl, err := template.New("").Funcs(funcMap).ParseGlob("templates/*.html")
	if err != nil {log.Fatalf("Error parsing templates: %v", err)}
	templates = tpl
}
func loadAndCachePosts() {
	cache.mu.Lock()
	defer cache.mu.Unlock()
	var loadedPosts []Post
	files, err := filepath.Glob("_posts/*.md")
	if err != nil {log.Fatalf("Error finding post files: %v", err)}
	for _, file := range files {
		slug := strings.TrimSuffix(filepath.Base(file), ".md")
		fileContent, _ := os.ReadFile(file)
		var post Post
		post.Slug = slug
		parts := strings.SplitN(string(fileContent), "---", 3)
		if len(parts) >= 3 {
			yaml.Unmarshal([]byte(parts[1]), &post); post.RawContent = parts[2]
		} else {post.RawContent = string(fileContent)}
		post.HTMLContent = template.HTML(renderMarkdownAndLatex(post.RawContent))
		loadedPosts = append(loadedPosts, post)
	}
	sort.Slice(loadedPosts, func(i, j int) bool { return loadedPosts[i].Date > loadedPosts[j].Date })
	cache.posts = loadedPosts
	log.Printf("Loaded and cached %d posts.", len(cache.posts))
}
func renderPage(w http.ResponseWriter, r *http.Request, data PageData, fragmentTemplate string) {
	if r.Header.Get("HX-Request") == "true" {
		w.Header().Set("HX-Push-Url", r.URL.Path)
		err := templates.ExecuteTemplate(w, fragmentTemplate, data); if err != nil {http.Error(w, err.Error(), http.StatusInternalServerError)}
		return
	}
	err := templates.ExecuteTemplate(w, "base.html", data); if err != nil {http.Error(w, err.Error(), http.StatusInternalServerError)}
}
func handleHome(w http.ResponseWriter, r *http.Request) {
	data := PageData{Title: "Home", Posts: cache.posts, PageID: "home"}; renderPage(w, r, data, "home.html")
}
func handleAbout(w http.ResponseWriter, r *http.Request) {
	data := PageData{Title: "About Me", Posts: cache.posts, PageID: "about"}; renderPage(w, r, data, "about.html")
}
func handlePost(w http.ResponseWriter, r *http.Request) {
	slug := strings.TrimPrefix(r.URL.Path, "/posts/"); cache.mu.RLock(); var foundPost *Post
	for i := range cache.posts {if cache.posts[i].Slug == slug {foundPost = &cache.posts[i]; break}}; cache.mu.RUnlock()
	if foundPost == nil {http.NotFound(w, r); return}
	data := PageData{Title: foundPost.Title, Posts: cache.posts, Content: *foundPost, PageID: "post"}
	renderPage(w, r, data, "post-content.html")
}
func handlePurgeCache(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {http.Error(w, "Invalid method", http.StatusMethodNotAllowed); return}
	if purgeKey == "" {http.Error(w, "Cache purging is not configured on this server.", http.StatusInternalServerError); return}
	requestKey := r.URL.Query().Get("key")
	if subtle.ConstantTimeCompare([]byte(requestKey), []byte(purgeKey)) != 1 {http.Error(w, "Unauthorized", http.StatusUnauthorized); return}
	log.Println("Received valid cache purge request. Reloading posts...")
	loadAndCachePosts()
	w.WriteHeader(http.StatusOK); w.Write([]byte("Cache purged successfully."))
}
func handleMetricsBadge(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "image/svg+xml"); w.Header().Set("Cache-Control", "no-cache")
	renderTime := "12ms"; svg := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20"><rect width="120" height="20" fill="#555"/><rect width="70" height="20" fill="#007ec6"/><text x="35" y="14" font-family="monospace" font-size="12" fill="white">render</text><text x="75" y="14" font-family="monospace" font-size="12" fill="white">%s</text></svg>`, renderTime)
	w.Write([]byte(svg))
}
