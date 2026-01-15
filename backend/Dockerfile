FROM rust:1.75-alpine AS builder

RUN apk add --no-cache musl-dev

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY src ./src

RUN cargo build --release

FROM alpine:3.19

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=builder /app/target/release/etched-backend /app/etched-backend

RUN mkdir -p /app/data/metadata

EXPOSE 8080

CMD ["/app/etched-backend"]
