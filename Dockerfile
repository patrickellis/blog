FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /app/server .

FROM scratch
COPY --from=builder /app/server /server
COPY --from=builder /app/templates /templates
COPY --from=builder /app/_posts /_posts
COPY --from=builder /app/static /static
EXPOSE 8080
ENTRYPOINT ["/server"]
