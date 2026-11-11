package chat

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/coder/websocket"
)

// Message represents the structure of a chat message
type Message struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Text string `json:"text"`
	Time string `json:"time"`
}

// Hub maintains active client connections and in-memory message history safely
type Hub struct {
	mu       sync.Mutex
	clients  map[*websocket.Conn]bool
	messages []Message // In-memory slice storing chat history
}

func NewHub() *Hub {
	return &Hub{
		clients:  make(map[*websocket.Conn]bool),
		messages: make([]Message, 0),
	}
}

// Register adds a new client connection and replays chat history to them
func (h *Hub) Register(conn *websocket.Conn, ctx context.Context) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[conn] = true
	log.Println("Client connected to Chat Module. Active connections:", len(h.clients))

	// Replay existing chat history to the newly connected client
	for _, msg := range h.messages {
		data, err := json.Marshal(msg)
		if err != nil {
			continue
		}
		err = conn.Write(ctx, websocket.MessageText, data)
		if err != nil {
			log.Println("Failed to send history to client:", err)
			break
		}
	}
}

// Unregister removes a disconnected client
func (h *Hub) Unregister(conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[conn]; ok {
		delete(h.clients, conn)
		log.Println("Client disconnected from Chat Module. Active connections:", len(h.clients))
	}
}

// Broadcast saves the message in-memory and sends it to all connected clients concurrently
func (h *Hub) Broadcast(ctx context.Context, msg []byte) {
	// 1. Unmarshal and store the incoming message in our in-memory slice
	var m Message
	if err := json.Unmarshal(msg, &m); err == nil {
		h.mu.Lock()
		h.messages = append(h.messages, m)
		h.mu.Unlock()
	}

	// 2. Snapshot active connections to avoid lock contention during network writes
	h.mu.Lock()
	conns := make([]*websocket.Conn, 0, len(h.clients))
	for conn := range h.clients {
		conns = append(conns, conn)
	}
	h.mu.Unlock()

	// 3. Fan out message to all clients
	for _, conn := range conns {
		err := conn.Write(ctx, websocket.MessageText, msg)
		if err != nil {
			log.Println("Write error, closing connection:", err)
			conn.Close(websocket.StatusGoingAway, "write error")
			h.Unregister(conn)
		}
	}
}

// HandleWebSocket manages the HTTP upgrade, history replay, and client read loop
func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		log.Println("Failed to accept websocket:", err)
		return
	}
	defer conn.Close(websocket.StatusInternalError, "internal error")

	ctx := r.Context()

	// Register client and send history immediately upon connection
	h.Register(conn, ctx)
	defer h.Unregister(conn)

	// Read loop for incoming messages
	for {
		_, msg, err := conn.Read(ctx)
		if err != nil {
			log.Println("Read error / connection closed:", err)
			break
		}

		// Broadcast raw JSON payload to everyone (and save it)
		h.Broadcast(ctx, msg)
	}
}
