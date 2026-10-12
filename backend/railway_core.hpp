#ifndef RAILWAY_CORE_HPP
#define RAILWAY_CORE_HPP

#include <iostream>
#include <fstream>
#include <vector>
#include <string>
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <cctype>

#ifdef _WIN32
    #include <windows.h>
#else
    #include <mutex>
#endif

// String utility functions
inline std::string trimString(const std::string& str) {
    size_t first = str.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    size_t last = str.find_last_not_of(" \t\r\n");
    return str.substr(first, (last - first + 1));
}

inline std::string toLowerString(const std::string& str) {
    std::string res = str;
    std::transform(res.begin(), res.end(), res.begin(), [](unsigned char c) {
        return std::tolower(c);
    });
    return res;
}

inline std::string escapeJsonString(const std::string& input) {
    std::ostringstream ss;
    for (char c : input) {
        switch (c) {
            case '"':  ss << "\\\""; break;
            case '\\': ss << "\\\\"; break;
            case '\b': ss << "\\b";  break;
            case '\f': ss << "\\f";  break;
            case '\n': ss << "\\n";  break;
            case '\r': ss << "\\r";  break;
            case '\t': ss << "\\t";  break;
            default:
                if (static_cast<unsigned char>(c) < 32) {
                    ss << "\\u" << std::hex << std::setw(4) << std::setfill('0') << (int)(unsigned char)c;
                } else {
                    ss << c;
                }
        }
    }
    return ss.str();
}

// ---------- Train class ----------
class Train {
public:
    int number;
    std::string name;
    std::string source;
    std::string destination;
    int totalSeats;
    int availableSeats;
    double fare;

    Train() : number(0), totalSeats(0), availableSeats(0), fare(0.0) {}
    Train(int n, const std::string& nm, const std::string& s, const std::string& d, int seats, double f)
        : number(n), name(nm), source(s), destination(d), totalSeats(seats), availableSeats(seats), fare(f) {}

    std::string toJson() const {
        std::ostringstream ss;
        ss << "{"
           << "\"number\":" << number << ","
           << "\"name\":\"" << escapeJsonString(name) << "\","
           << "\"source\":\"" << escapeJsonString(source) << "\","
           << "\"destination\":\"" << escapeJsonString(destination) << "\","
           << "\"totalSeats\":" << totalSeats << ","
           << "\"availableSeats\":" << availableSeats << ","
           << "\"fare\":" << std::fixed << std::setprecision(2) << fare
           << "}";
        return ss.str();
    }
};

// ---------- Ticket class ----------
class Ticket {
public:
    int pnr;
    std::string passengerName;
    int age;
    int trainNumber;
    int seats;
    double totalFare;

    Ticket() : pnr(0), age(0), trainNumber(0), seats(0), totalFare(0.0) {}

    std::string toJson(const Train* tr = nullptr) const {
        std::ostringstream ss;
        ss << "{"
           << "\"pnr\":" << pnr << ","
           << "\"passengerName\":\"" << escapeJsonString(passengerName) << "\","
           << "\"age\":" << age << ","
           << "\"trainNumber\":" << trainNumber << ","
           << "\"trainName\":\"" << (tr ? escapeJsonString(tr->name) : "Express") << "\","
           << "\"source\":\"" << (tr ? escapeJsonString(tr->source) : "") << "\","
           << "\"destination\":\"" << (tr ? escapeJsonString(tr->destination) : "") << "\","
           << "\"seats\":" << seats << ","
           << "\"farePerSeat\":" << std::fixed << std::setprecision(2) << (tr ? tr->fare : (seats > 0 ? totalFare / seats : 0.0)) << ","
           << "\"totalFare\":" << std::fixed << std::setprecision(2) << totalFare << ","
           << "\"isChildDiscount\":" << (age < 12 ? "true" : "false")
           << "}";
        return ss.str();
    }
};

// Return structures for web operations
struct BookingResult {
    bool success;
    std::string message;
    Ticket ticket;
    Train train;
};

struct TicketResult {
    bool found;
    std::string message;
    Ticket ticket;
    Train train;
};

struct CancelResult {
    bool success;
    std::string message;
    double refundAmount;
    int restoredSeats;
    int trainNumber;
    std::string passengerName;
};

// ---------- Reservation System Engine ----------
class ReservationEngine {
private:
    std::vector<Train> trains;
    std::vector<Ticket> tickets;
    int nextPNR;
    std::string primaryFilePath;
    std::string secondaryFilePath;

#ifdef _WIN32
    CRITICAL_SECTION cs;
    struct LockGuard {
        CRITICAL_SECTION& sec;
        LockGuard(CRITICAL_SECTION& s) : sec(s) { EnterCriticalSection(&sec); }
        ~LockGuard() { LeaveCriticalSection(&sec); }
    };
#else
    std::mutex cs;
    struct LockGuard {
        std::mutex& sec;
        LockGuard(std::mutex& s) : sec(s) { sec.lock(); }
        ~LockGuard() { sec.unlock(); }
    };
#endif

    void saveTicketsInternal() {
        // Save to primary file
        std::ofstream out(primaryFilePath.c_str());
        if (out.is_open()) {
            out << nextPNR << "\n";
            for (const auto& t : tickets) {
                out << t.pnr << "|" << t.passengerName << "|" << t.age << "|"
                    << t.trainNumber << "|" << t.seats << "|" << t.totalFare << "\n";
            }
            out.close();
        }

        // Also sync to secondary file if path exists and differs
        if (!secondaryFilePath.empty() && secondaryFilePath != primaryFilePath) {
            std::ofstream outSec(secondaryFilePath.c_str());
            if (outSec.is_open()) {
                outSec << nextPNR << "\n";
                for (const auto& t : tickets) {
                    outSec << t.pnr << "|" << t.passengerName << "|" << t.age << "|"
                           << t.trainNumber << "|" << t.seats << "|" << t.totalFare << "\n";
                }
                outSec.close();
            }
        }
    }

    void loadTicketsInternal() {
        std::ifstream in(primaryFilePath.c_str());
        if (!in.is_open()) {
            // Try secondary file
            in.open(secondaryFilePath.c_str());
            if (!in.is_open()) return;
        }

        in >> nextPNR;
        std::string line;
        std::getline(in, line); // consume newline

        tickets.clear();
        // Reset train available seats to total seats before loading tickets
        for (auto& tr : trains) {
            tr.availableSeats = tr.totalSeats;
        }

        while (std::getline(in, line)) {
            line = trimString(line);
            if (line.empty()) continue;

            Ticket t;
            size_t p = line.find('|');
            if (p == std::string::npos) continue;
            t.pnr = std::stoi(line.substr(0, p));
            line.erase(0, p + 1);

            p = line.find('|');
            if (p == std::string::npos) continue;
            t.passengerName = line.substr(0, p);
            line.erase(0, p + 1);

            p = line.find('|');
            if (p == std::string::npos) continue;
            t.age = std::stoi(line.substr(0, p));
            line.erase(0, p + 1);

            p = line.find('|');
            if (p == std::string::npos) continue;
            t.trainNumber = std::stoi(line.substr(0, p));
            line.erase(0, p + 1);

            p = line.find('|');
            if (p == std::string::npos) continue;
            t.seats = std::stoi(line.substr(0, p));
            line.erase(0, p + 1);

            t.totalFare = std::stod(line);

            tickets.push_back(t);

            Train* tr = findTrainInternal(t.trainNumber);
            if (tr) {
                tr->availableSeats -= t.seats;
                if (tr->availableSeats < 0) tr->availableSeats = 0;
            }
        }
        in.close();
    }

    Train* findTrainInternal(int number) {
        for (auto& t : trains) {
            if (t.number == number) return &t;
        }
        return nullptr;
    }

public:
    ReservationEngine(const std::string& path1 = "data/tickets.txt", const std::string& path2 = "tickets.txt")
        : nextPNR(1001), primaryFilePath(path1), secondaryFilePath(path2) {
#ifdef _WIN32
        InitializeCriticalSection(&cs);
#endif

        // Predefined Fleet Demonstration Trains
        trains.push_back(Train(12001, "Shatabdi Express", "Delhi", "Bhopal", 50, 1200.0));
        trains.push_back(Train(12951, "Rajdhani Express", "Mumbai", "Delhi", 60, 2100.0));
        trains.push_back(Train(12627, "Karnataka Express", "Bangalore", "Delhi", 40, 1800.0));
        trains.push_back(Train(12841, "Coromandel Express", "Kolkata", "Chennai", 45, 1500.0));

        loadTicketsInternal();
    }

    ~ReservationEngine() {
#ifdef _WIN32
        DeleteCriticalSection(&cs);
#endif
    }

    // Get all trains as JSON array
    std::string getAllTrainsJson() {
        LockGuard lock(cs);
        std::ostringstream ss;
        ss << "[";
        for (size_t i = 0; i < trains.size(); ++i) {
            ss << trains[i].toJson();
            if (i + 1 < trains.size()) ss << ",";
        }
        ss << "]";
        return ss.str();
    }

    // Search trains by route with case-insensitive and trimmed station matching
    std::string searchTrainsJson(const std::string& rawSource, const std::string& rawDestination) {
        LockGuard lock(cs);
        std::string sClean = toLowerString(trimString(rawSource));
        std::string dClean = toLowerString(trimString(rawDestination));

        std::vector<Train> results;
        for (const auto& t : trains) {
            std::string tSource = toLowerString(t.source);
            std::string tDest = toLowerString(t.destination);

            bool matchSource = sClean.empty() || (tSource == sClean);
            bool matchDest = dClean.empty() || (tDest == dClean);

            if (matchSource && matchDest) {
                results.push_back(t);
            }
        }

        std::ostringstream ss;
        ss << "[";
        for (size_t i = 0; i < results.size(); ++i) {
            ss << results[i].toJson();
            if (i + 1 < results.size()) ss << ",";
        }
        ss << "]";
        return ss.str();
    }

    // Process a booking
    BookingResult bookTicket(int trainNo, const std::string& passengerName, int age, int seats) {
        LockGuard lock(cs);
        BookingResult res;
        res.success = false;

        std::string cleanName = trimString(passengerName);
        if (cleanName.empty()) {
            res.message = "Passenger name cannot be empty.";
            return res;
        }

        if (age <= 0 || age > 120) {
            res.message = "Please enter a valid age (1 to 120).";
            return res;
        }

        if (seats <= 0) {
            res.message = "Number of seats must be at least 1.";
            return res;
        }

        Train* t = findTrainInternal(trainNo);
        if (!t) {
            res.message = "Invalid train number. Train not found.";
            return res;
        }

        if (seats > t->availableSeats) {
            std::ostringstream msg;
            msg << "Insufficient seats available. Only " << t->availableSeats << " seat(s) remaining on " << t->name << ".";
            res.message = msg.str();
            return res;
        }

        // Perform booking
        Ticket tk;
        tk.pnr = nextPNR++;
        tk.passengerName = cleanName;
        tk.age = age;
        tk.trainNumber = trainNo;
        tk.seats = seats;
        tk.totalFare = seats * t->fare;

        // 50% discount for children under 12
        if (age < 12) {
            tk.totalFare /= 2.0;
        }

        t->availableSeats -= seats;
        tickets.push_back(tk);
        saveTicketsInternal();

        res.success = true;
        res.message = "Booking confirmed successfully.";
        res.ticket = tk;
        res.train = *t;
        return res;
    }

    // Lookup a booking by PNR
    TicketResult getTicketByPNR(int pnr) {
        LockGuard lock(cs);
        TicketResult res;
        res.found = false;

        for (const auto& tk : tickets) {
            if (tk.pnr == pnr) {
                res.found = true;
                res.message = "Ticket found.";
                res.ticket = tk;
                Train* tr = findTrainInternal(tk.trainNumber);
                if (tr) res.train = *tr;
                return res;
            }
        }

        res.message = "No booking found with PNR: " + std::to_string(pnr);
        return res;
    }

    // Cancel a ticket by PNR
    CancelResult cancelTicket(int pnr) {
        LockGuard lock(cs);
        CancelResult res;
        res.success = false;
        res.refundAmount = 0.0;
        res.restoredSeats = 0;
        res.trainNumber = 0;

        for (size_t i = 0; i < tickets.size(); ++i) {
            if (tickets[i].pnr == pnr) {
                Ticket tk = tickets[i];
                Train* t = findTrainInternal(tk.trainNumber);
                if (t) {
                    t->availableSeats += tk.seats;
                    res.trainNumber = t->number;
                }
                // 80% refund policy (20% cancellation fee)
                double refund = tk.totalFare * 0.8;
                res.refundAmount = refund;
                res.restoredSeats = tk.seats;
                res.passengerName = tk.passengerName;

                tickets.erase(tickets.begin() + i);
                saveTicketsInternal();

                res.success = true;
                res.message = "Ticket successfully cancelled.";
                return res;
            }
        }

        res.message = "Cannot cancel: No active booking found with PNR " + std::to_string(pnr);
        return res;
    }

    // Get all bookings as JSON array
    std::string getAllBookingsJson() {
        LockGuard lock(cs);
        std::ostringstream ss;
        ss << "[";
        for (size_t i = 0; i < tickets.size(); ++i) {
            Train* tr = findTrainInternal(tickets[i].trainNumber);
            ss << tickets[i].toJson(tr);
            if (i + 1 < tickets.size()) ss << ",";
        }
        ss << "]";
        return ss.str();
    }
};

#endif // RAILWAY_CORE_HPP
