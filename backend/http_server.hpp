#ifndef HTTP_SERVER_HPP
#define HTTP_SERVER_HPP

#include <iostream>
#include <string>
#include <sstream>
#include <fstream>
#include <vector>
#include <map>
#include <algorithm>

#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #include <windows.h>
    typedef int socklen_t;
#else
    #include <sys/types.h>
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #include <unistd.h>
    #include <pthread.h>
    #include <signal.h>
    typedef int SOCKET;
    #define INVALID_SOCKET -1
    #define SOCKET_ERROR -1
    #define closesocket close
#endif

#include "railway_core.hpp"

// Utility to parse JSON fields without bulky external dependencies
class SimpleJson {
public:
    static std::string getString(const std::string& json, const std::string& key) {
        std::string pattern = "\"" + key + "\"";
        size_t pos = json.find(pattern);
        if (pos == std::string::npos) return "";
        pos = json.find(':', pos);
        if (pos == std::string::npos) return "";
        pos = json.find('"', pos);
        if (pos == std::string::npos) return "";
        size_t start = pos + 1;
        size_t end = json.find('"', start);
        if (end == std::string::npos) return "";
        return json.substr(start, end - start);
    }

    static int getInt(const std::string& json, const std::string& key, int defaultVal = 0) {
        std::string pattern = "\"" + key + "\"";
        size_t pos = json.find(pattern);
        if (pos == std::string::npos) return defaultVal;
        pos = json.find(':', pos);
        if (pos == std::string::npos) return defaultVal;
        pos++;
        while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t' || json[pos] == '"')) pos++;
        size_t end = pos;
        while (end < json.size() && (std::isdigit(json[end]) || json[end] == '-')) end++;
        if (end > pos) {
            try { return std::stoi(json.substr(pos, end - pos)); } catch (...) {}
        }
        return defaultVal;
    }
};

struct HttpRequest {
    std::string method;
    std::string path;
    std::string query;
    std::string body;
    std::map<std::string, std::string> headers;
    std::map<std::string, std::string> queryParams;
};

struct HttpResponse {
    int statusCode;
    std::string statusText;
    std::string contentType;
    std::string body;

    HttpResponse() : statusCode(200), statusText("OK"), contentType("application/json; charset=utf-8") {}
};

class HttpServer {
private:
    int port;
    ReservationEngine engine;
    SOCKET listenSocket;
    std::string frontendDir;

    static std::string urlDecode(const std::string& in) {
        std::string out;
        for (size_t i = 0; i < in.length(); ++i) {
            if (in[i] == '%') {
                if (i + 2 < in.length()) {
                    int value;
                    std::istringstream is(in.substr(i + 1, 2));
                    if (is >> std::hex >> value) {
                        out += static_cast<char>(value);
                        i += 2;
                    } else {
                        out += in[i];
                    }
                }
            } else if (in[i] == '+') {
                out += ' ';
            } else {
                out += in[i];
            }
        }
        return out;
    }

    static void parseQueryParams(const std::string& query, std::map<std::string, std::string>& params) {
        std::istringstream ss(query);
        std::string pair;
        while (std::getline(ss, pair, '&')) {
            size_t eq = pair.find('=');
            if (eq != std::string::npos) {
                std::string k = urlDecode(pair.substr(0, eq));
                std::string v = urlDecode(pair.substr(eq + 1));
                params[k] = v;
            }
        }
    }

    bool readFile(const std::string& filePath, std::string& content) {
        std::ifstream f(filePath.c_str(), std::ios::in | std::ios::binary);
        if (!f.is_open()) return false;
        std::ostringstream ss;
        ss << f.rdbuf();
        content = ss.str();
        return true;
    }

    std::string getMimeType(const std::string& path) {
        if (path.rfind(".html") != std::string::npos || path.rfind(".htm") != std::string::npos) return "text/html; charset=utf-8";
        if (path.rfind(".css") != std::string::npos) return "text/css; charset=utf-8";
        if (path.rfind(".js") != std::string::npos) return "application/javascript; charset=utf-8";
        if (path.rfind(".svg") != std::string::npos) return "image/svg+xml";
        if (path.rfind(".png") != std::string::npos) return "image/png";
        if (path.rfind(".jpg") != std::string::npos || path.rfind(".jpeg") != std::string::npos) return "image/jpeg";
        if (path.rfind(".ico") != std::string::npos) return "image/x-icon";
        if (path.rfind(".json") != std::string::npos) return "application/json; charset=utf-8";
        return "text/plain; charset=utf-8";
    }

    HttpResponse handleApiRequest(const HttpRequest& req) {
        HttpResponse res;

        // Route: GET /api/health
        if (req.method == "GET" && req.path == "/api/health") {
            res.statusCode = 200;
            res.body = "{\"status\":\"ok\",\"engine\":\"RailNova C++ API Engine\",\"version\":\"1.0\"}";
            return res;
        }

        // Route: GET /api/trains
        if (req.method == "GET" && req.path == "/api/trains") {
            res.statusCode = 200;
            res.body = engine.getAllTrainsJson();
            return res;
        }

        // Route: POST /api/search or GET /api/search
        if ((req.method == "POST" || req.method == "GET") && req.path == "/api/search") {
            std::string source, destination;
            if (req.method == "POST") {
                source = SimpleJson::getString(req.body, "source");
                destination = SimpleJson::getString(req.body, "destination");
            } else {
                auto itS = req.queryParams.find("source");
                if (itS != req.queryParams.end()) source = itS->second;
                auto itD = req.queryParams.find("destination");
                if (itD != req.queryParams.end()) destination = itD->second;
            }
            res.statusCode = 200;
            res.body = engine.searchTrainsJson(source, destination);
            return res;
        }

        // Route: POST /api/bookings (Create booking)
        if (req.method == "POST" && req.path == "/api/bookings") {
            int trainNumber = SimpleJson::getInt(req.body, "trainNumber");
            std::string passengerName = SimpleJson::getString(req.body, "passengerName");
            int age = SimpleJson::getInt(req.body, "age");
            int seats = SimpleJson::getInt(req.body, "seats");

            BookingResult bRes = engine.bookTicket(trainNumber, passengerName, age, seats);
            if (bRes.success) {
                res.statusCode = 201;
                res.statusText = "Created";
                std::ostringstream ss;
                ss << "{"
                   << "\"success\":true,"
                   << "\"message\":\"" << escapeJsonString(bRes.message) << "\","
                   << "\"ticket\":" << bRes.ticket.toJson(&bRes.train)
                   << "}";
                res.body = ss.str();
            } else {
                res.statusCode = 400;
                res.statusText = "Bad Request";
                std::ostringstream ss;
                ss << "{"
                   << "\"success\":false,"
                   << "\"message\":\"" << escapeJsonString(bRes.message) << "\""
                   << "}";
                res.body = ss.str();
            }
            return res;
        }

        // Route: GET /api/bookings (View all bookings)
        if (req.method == "GET" && req.path == "/api/bookings") {
            res.statusCode = 200;
            res.body = engine.getAllBookingsJson();
            return res;
        }

        // Route: GET /api/bookings/{pnr}
        if (req.method == "GET" && req.path.find("/api/bookings/") == 0) {
            std::string pnrStr = req.path.substr(std::string("/api/bookings/").length());
            try {
                int pnr = std::stoi(pnrStr);
                TicketResult tRes = engine.getTicketByPNR(pnr);
                if (tRes.found) {
                    res.statusCode = 200;
                    std::ostringstream ss;
                    ss << "{"
                       << "\"success\":true,"
                       << "\"ticket\":" << tRes.ticket.toJson(&tRes.train)
                       << "}";
                    res.body = ss.str();
                } else {
                    res.statusCode = 404;
                    res.statusText = "Not Found";
                    res.body = "{\"success\":false,\"message\":\"" + escapeJsonString(tRes.message) + "\"}";
                }
            } catch (...) {
                res.statusCode = 400;
                res.statusText = "Bad Request";
                res.body = "{\"success\":false,\"message\":\"Invalid PNR format.\"}";
            }
            return res;
        }

        // Route: DELETE /api/bookings/{pnr} or POST /api/bookings/cancel
        if ((req.method == "DELETE" && req.path.find("/api/bookings/") == 0) ||
            (req.method == "POST" && req.path == "/api/bookings/cancel")) {
            int pnr = 0;
            if (req.method == "DELETE") {
                std::string pnrStr = req.path.substr(std::string("/api/bookings/").length());
                try { pnr = std::stoi(pnrStr); } catch (...) { pnr = 0; }
            } else {
                pnr = SimpleJson::getInt(req.body, "pnr");
            }

            if (pnr <= 0) {
                res.statusCode = 400;
                res.statusText = "Bad Request";
                res.body = "{\"success\":false,\"message\":\"Invalid PNR provided for cancellation.\"}";
                return res;
            }

            CancelResult cRes = engine.cancelTicket(pnr);
            if (cRes.success) {
                res.statusCode = 200;
                std::ostringstream ss;
                ss << "{"
                   << "\"success\":true,"
                   << "\"message\":\"" << escapeJsonString(cRes.message) << "\","
                   << "\"pnr\":" << pnr << ","
                   << "\"passengerName\":\"" << escapeJsonString(cRes.passengerName) << "\","
                   << "\"refundAmount\":" << std::fixed << std::setprecision(2) << cRes.refundAmount << ","
                   << "\"restoredSeats\":" << cRes.restoredSeats << ","
                   << "\"trainNumber\":" << cRes.trainNumber
                   << "}";
                res.body = ss.str();
            } else {
                res.statusCode = 404;
                res.statusText = "Not Found";
                res.body = "{\"success\":false,\"message\":\"" + escapeJsonString(cRes.message) + "\"}";
            }
            return res;
        }

        // Default: 404 Not Found for API
        res.statusCode = 404;
        res.statusText = "Not Found";
        res.body = "{\"success\":false,\"message\":\"API endpoint not found.\"}";
        return res;
    }

    HttpResponse handleStaticRequest(const HttpRequest& req) {
        HttpResponse res;
        std::string requestedPath = req.path;
        if (requestedPath == "/" || requestedPath.empty()) {
            requestedPath = "/index.html";
        }

        // Prevent directory traversal attacks
        if (requestedPath.find("..") != std::string::npos) {
            res.statusCode = 403;
            res.statusText = "Forbidden";
            res.contentType = "text/plain";
            res.body = "403 Forbidden";
            return res;
        }

        std::string filePath = frontendDir + requestedPath;
        std::string fileContent;
        if (readFile(filePath, fileContent)) {
            res.statusCode = 200;
            res.contentType = getMimeType(filePath);
            res.body = fileContent;
        } else {
            // Check current directory fallback
            std::string fallbackPath = "." + requestedPath;
            if (readFile(fallbackPath, fileContent)) {
                res.statusCode = 200;
                res.contentType = getMimeType(fallbackPath);
                res.body = fileContent;
            } else {
                res.statusCode = 404;
                res.statusText = "Not Found";
                res.contentType = "text/html; charset=utf-8";
                res.body = "<h1>404 Not Found</h1><p>The requested file was not found.</p>";
            }
        }
        return res;
    }

public:
    HttpServer(int p = 8080, const std::string& fDir = "frontend")
        : port(p), frontendDir(fDir), listenSocket(INVALID_SOCKET) {}

    struct ClientContext {
        HttpServer* server;
        SOCKET clientSocket;
    };

#ifdef _WIN32
    static DWORD WINAPI ClientThread(LPVOID lpParam)
#else
    static void* ClientThread(void* lpParam)
#endif
    {
        ClientContext* ctx = reinterpret_cast<ClientContext*>(lpParam);
        HttpServer* self = ctx->server;
        SOCKET s = ctx->clientSocket;
        delete ctx;

        char buffer[8192];
        int bytesReceived = recv(s, buffer, sizeof(buffer) - 1, 0);
        if (bytesReceived <= 0) {
            closesocket(s);
            return 0;
        }
        buffer[bytesReceived] = '\0';
        std::string raw(buffer, bytesReceived);

        // Parse Request Line
        std::istringstream stream(raw);
        std::string requestLine;
        std::getline(stream, requestLine);
        if (!requestLine.empty() && requestLine.back() == '\r') requestLine.pop_back();

        std::istringstream rlStream(requestLine);
        HttpRequest req;
        rlStream >> req.method >> req.path;

        // Split Path & Query string
        size_t queryPos = req.path.find('?');
        if (queryPos != std::string::npos) {
            req.query = req.path.substr(queryPos + 1);
            req.path = req.path.substr(0, queryPos);
            parseQueryParams(req.query, req.queryParams);
        }

        // Parse Headers
        std::string headerLine;
        int contentLength = 0;
        while (std::getline(stream, headerLine) && headerLine != "\r" && !headerLine.empty()) {
            if (headerLine.back() == '\r') headerLine.pop_back();
            size_t colon = headerLine.find(':');
            if (colon != std::string::npos) {
                std::string k = toLowerString(trimString(headerLine.substr(0, colon)));
                std::string v = trimString(headerLine.substr(colon + 1));
                req.headers[k] = v;
                if (k == "content-length") {
                    try { contentLength = std::stoi(v); } catch (...) {}
                }
            }
        }

        // Parse Body
        size_t headerEnd = raw.find("\r\n\r\n");
        if (headerEnd != std::string::npos) {
            req.body = raw.substr(headerEnd + 4);
            // If body was truncated in first buffer, read the rest
            while ((int)req.body.size() < contentLength) {
                int more = recv(s, buffer, sizeof(buffer) - 1, 0);
                if (more <= 0) break;
                req.body.append(buffer, more);
            }
        }

        // Process Request
        HttpResponse res;
        if (req.method == "OPTIONS") {
            // CORS Preflight
            res.statusCode = 204;
            res.statusText = "No Content";
            res.contentType = "text/plain";
            res.body = "";
        } else if (req.path.find("/api/") == 0) {
            res = self->handleApiRequest(req);
        } else {
            res = self->handleStaticRequest(req);
        }

        // Build HTTP Response
        std::ostringstream responseStream;
        responseStream << "HTTP/1.1 " << res.statusCode << " " << res.statusText << "\r\n";
        responseStream << "Content-Type: " << res.contentType << "\r\n";
        responseStream << "Content-Length: " << res.body.size() << "\r\n";
        responseStream << "Access-Control-Allow-Origin: *\r\n";
        responseStream << "Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS\r\n";
        responseStream << "Access-Control-Allow-Headers: Content-Type, Authorization\r\n";
        responseStream << "Connection: close\r\n\r\n";
        responseStream << res.body;

        std::string respStr = responseStream.str();
        send(s, respStr.c_str(), (int)respStr.size(), 0);

        std::cout << "[" << req.method << "] " << req.path
                  << " -> " << res.statusCode << " (" << res.body.size() << " bytes)\n";

        closesocket(s);
        return 0;
    }

    bool start() {
#ifdef _WIN32
        WSADATA wsaData;
        int err = WSAStartup(MAKEWORD(2, 2), &wsaData);
        if (err != 0) {
            std::cerr << "WSAStartup failed with error: " << err << "\n";
            return false;
        }
#else
        // Ignore SIGPIPE on Linux to prevent process termination on client disconnect
        signal(SIGPIPE, SIG_IGN);
#endif

        listenSocket = socket(AF_INET, SOCK_STREAM, 0);
        if (listenSocket == INVALID_SOCKET) {
            std::cerr << "socket creation failed\n";
#ifdef _WIN32
            WSACleanup();
#endif
            return false;
        }

        // Allow address reuse
        int opt = 1;
#ifdef _WIN32
        setsockopt(listenSocket, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));
#else
        setsockopt(listenSocket, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

        sockaddr_in serverAddr;
        serverAddr.sin_family = AF_INET;
        serverAddr.sin_addr.s_addr = INADDR_ANY;
        serverAddr.sin_port = htons((u_short)port);

        if (bind(listenSocket, (sockaddr*)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR) {
            std::cerr << "bind failed on port " << port << "\n";
            closesocket(listenSocket);
#ifdef _WIN32
            WSACleanup();
#endif
            return false;
        }

        if (listen(listenSocket, SOMAXCONN) == SOCKET_ERROR) {
            std::cerr << "listen failed on port " << port << "\n";
            closesocket(listenSocket);
#ifdef _WIN32
            WSACleanup();
#endif
            return false;
        }

        std::cout << "========================================================\n";
        std::cout << "  RailNova C++ Railway Reservation Server (Live)\n";
        std::cout << "========================================================\n";
        std::cout << "Server running at:  http://localhost:" << port << "/\n";
        std::cout << "API base URL:       http://localhost:" << port << "/api/\n";
        std::cout << "Frontend directory: " << frontendDir << "/\n";
        std::cout << "Tickets file:       data/tickets.txt\n";
        std::cout << "--------------------------------------------------------\n\n";

        while (true) {
            sockaddr_in clientAddr;
            socklen_t clientLen = sizeof(clientAddr);
            SOCKET clientSocket = accept(listenSocket, (sockaddr*)&clientAddr, &clientLen);
            if (clientSocket == INVALID_SOCKET) {
                break;
            }

            ClientContext* ctx = new ClientContext();
            ctx->server = this;
            ctx->clientSocket = clientSocket;

#ifdef _WIN32
            HANDLE hThread = CreateThread(NULL, 0, ClientThread, ctx, 0, NULL);
            if (hThread != NULL) {
                CloseHandle(hThread); // Detach thread
            } else {
                delete ctx;
                closesocket(clientSocket);
            }
#else
            pthread_t tid;
            if (pthread_create(&tid, NULL, ClientThread, ctx) == 0) {
                pthread_detach(tid); // Detach thread
            } else {
                delete ctx;
                closesocket(clientSocket);
            }
#endif
        }

        closesocket(listenSocket);
#ifdef _WIN32
        WSACleanup();
#endif
        return true;
    }
};

#endif // HTTP_SERVER_HPP
