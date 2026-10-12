#include <iostream>
#include <string>
#include "http_server.hpp"

int main(int argc, char* argv[]) {
    int port = 8080;
    if (argc > 1) {
        try {
            port = std::stoi(argv[1]);
        } catch (...) {
            port = 8080;
        }
    }

    std::string frontendDir = "frontend";
    if (argc > 2) {
        frontendDir = argv[2];
    }

    HttpServer server(port, frontendDir);
    if (!server.start()) {
        std::cerr << "Failed to start server on port " << port << std::endl;
        return 1;
    }

    return 0;
}
