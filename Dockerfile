
FROM gcc:13

WORKDIR /app

COPY backend/ ./backend/
COPY frontend/ ./frontend/

RUN g++ -std=c++17 -pthread backend/main.cpp -o server

ENV PORT=10000

EXPOSE 10000

CMD ["./server", "10000", "frontend"]