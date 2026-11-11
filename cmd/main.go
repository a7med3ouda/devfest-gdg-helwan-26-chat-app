package main

import (
	"chat/internal/modules/chat"
	"log"
	"net/http"
)

func main() {
	// 1. Initialize the Chat module
	chatHub := chat.NewHub()

	// 2. Create an explicit, modern ServeMux (Go 1.22+)
	mux := http.NewServeMux()

	// 3. Register routes using Go's enhanced method routing & wildcards
	mux.HandleFunc("GET /ws", chatHub.HandleWebSocket)

	// Serve static frontend files (catch-all route)
	mux.Handle("GET /", http.FileServer(http.Dir("./static")))

	// 4. Start Server with our explicit mux instead of nil (DefaultServeMux)
	log.Println("Server is running at http://localhost:8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatal("Server failed:", err)
	}
}
