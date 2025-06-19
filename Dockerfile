# --- Stage 1: Build the binary ---
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /app/server .

# --- Stage 2: Create the final, tiny image ---
FROM scratch
COPY --from=builder /app/server /server
COPY --from=builder /app/templates /templates
COPY --from=builder /app/_posts /_posts
EXPOSE 8080
ENTRYPOINT ["/server"]
