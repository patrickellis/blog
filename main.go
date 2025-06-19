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
	Title       string    `yaml:"title"`
	Date        string    `yaml:"date"`
	Slug        string    `yaml:"-"`
	RawContent  string    `yaml:"-"`
	HTMLContent template.HTML `yaml:"-"`
}

type BlogCache struct {
	mu    sync.RWMutex
	posts []Post // Now a slice to keep it sorted
}

// Data passed to the main base template
type PageData struct {
	Title    string
	AllPosts []Post
	Content  interface{} // Can be a Post, or any other struct for other pages
	PageID   string      // e.g., "post", "home", "about"
}

// --- Globals ---

var (
	templates *template.Template
	cache     *BlogCache
	purgeKey  = "your-secret-purge-key" // IMPORTANT: Use Secret Manager
)

// --- Main Function ---

func main() {
	cache = &BlogCache{posts: make([]Post, 0)}
	loadTemplates()
	loadAndCachePosts()

	// --- HTTP Handlers ---
	http.HandleFunc("/", handleHome)
	http.HandleFunc("/about", handleAbout)
	http.HandleFunc("/posts/", handlePost)
	http.HandleFunc("/search", handleSearch)
	http.HandleFunc("/purge-cache", handlePurgeCache)
	http.HandleFunc("/metrics-badge", handleMetricsBadge)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Starting server on port %s...", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

// --- Core Logic ---

func loadTemplates() {
	funcMap := template.FuncMap{"safeHTML": func(s template.HTML) template.HTML { return s }}
	tpl, err := template.New("").Funcs(funcMap).ParseGlob("templates/*.html")
	if err != nil {
		log.Fatalf("Error parsing templates: %v", err)
	}
	templates = tpl
}

func loadAndCachePosts() {
	cache.mu.Lock()
	defer cache.mu.Unlock()

	var loadedPosts []Post
	files, err := filepath.Glob("_posts/*.md")
	if err != nil {
		log.Fatalf("Error finding post files: %v", err)
	}

	for _, file := range files {
		slug := strings.TrimSuffix(filepath.Base(file), ".md")
		fileContent, _ := os.ReadFile(file)

		var post Post
		post.Slug = slug
		parts := strings.SplitN(string(fileContent), "---", 3)
		if len(parts) >= 3 {
			yaml.Unmarshal([]byte(parts[1]), &post)
			post.RawContent = parts[2]
		} else {
			post.RawContent = string(fileContent)
		}

		post.HTMLContent = template.HTML(renderMarkdownAndLatex(post.RawContent))
		loadedPosts = append(loadedPosts, post)
	}

	sort.Slice(loadedPosts, func(i, j int) bool { return loadedPosts[i].Date > loadedPosts[j].Date })
	cache.posts = loadedPosts
	log.Printf("Loaded and cached %d posts.", len(cache.posts))
}

func renderMarkdownAndLatex(raw string) []byte {
	re := regexp.MustCompile(`\$\$([\s\S]*?)\$\$`)
	latexProcessed := re.ReplaceAllStringFunc(raw, func(match string) string {
		latex := strings.Trim(match, "$$")
		return fmt.Sprintf(`<div class="latex-block" data-source="%s">%s</div>`, template.HTMLEscapeString(latex), latex)
	})

	extensions := parser.CommonExtensions | parser.AutoHeadingIDs
	p := parser.NewWithExtensions(extensions)
	return markdown.ToHTML([]byte(latexProcessed), p, nil)
}

// --- HTTP Handler Implementations ---

// renderPage is a helper to handle full page vs. htmx fragment rendering
func renderPage(w http.ResponseWriter, r *http.Request, data PageData, fragmentTemplate string) {
	// If htmx is requesting a content swap, only send the fragment
	if r.Header.Get("HX-Request") == "true" {
		err := templates.ExecuteTemplate(w, fragmentTemplate, data)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}
	// Otherwise, render the full page layout
	err := templates.ExecuteTemplate(w, "base.html", data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func handleHome(w http.ResponseWriter, r *http.Request) {
	data := PageData{
		Title:    "Home",
		AllPosts: cache.posts,
		PageID:   "home",
	}
	renderPage(w, r, data, "home.html")
}

func handleAbout(w http.ResponseWriter, r *http.Request) {
	data := PageData{
		Title:    "About Me",
		AllPosts: cache.posts,
		PageID:   "about",
	}
	renderPage(w, r, data, "about.html")
}

func handlePost(w http.ResponseWriter, r *http.Request) {
	slug := strings.TrimPrefix(r.URL.Path, "/posts/")
	
	cache.mu.RLock()
	var foundPost *Post
	for _, p := range cache.posts {
		if p.Slug == slug {
			foundPost = &p
			break
		}
	}
	cache.mu.RUnlock()

	if foundPost == nil {
		http.NotFound(w, r)
		return
	}

	data := PageData{
		Title:    foundPost.Title,
		AllPosts: cache.posts,
		Content:  *foundPost,
		PageID:   "post",
	}
	renderPage(w, r, data, "post-content.html")
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	query := r.FormValue("q")
	var matchingPosts []Post

	cache.mu.RLock()
	if query != "" {
		for _, post := range cache.posts {
			if strings.Contains(strings.ToLower(post.Title), strings.ToLower(query)) || strings.Contains(strings.ToLower(post.RawContent), strings.ToLower(query)) {
				matchingPosts = append(matchingPosts, post)
			}
		}
	} else {
		matchingPosts = cache.posts
	}
	cache.mu.RUnlock()

	err := templates.ExecuteTemplate(w, "search-results.html", map[string]interface{}{"Posts": matchingPosts})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func handlePurgeCache(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid method", http.StatusMethodNotAllowed)
		return
	}
	key := r.URL.Query().Get("key")
	if subtle.ConstantTimeCompare([]byte(key), []byte(purgeKey)) != 1 {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	log.Println("Received cache purge request. Reloading posts...")
	loadAndCachePosts()
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Cache purged successfully."))
}

func handleMetricsBadge(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "no-cache")
	renderTime := "12ms" // Placeholder
	svg := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20"><rect width="120" height="20" fill="#555"/><rect width="70" height="20" fill="#007ec6"/><text x="35" y="14" font-family="monospace" font-size="12" fill="white">render</text><text x="75" y="14" font-family="monospace" font-size="12" fill="white">%s</text></svg>`, renderTime)
	w.Write([]byte(svg))
}
