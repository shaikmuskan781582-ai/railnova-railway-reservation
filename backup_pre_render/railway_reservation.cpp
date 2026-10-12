// Railway Reservation System - C++ console project
// Concepts used: classes, vectors, file handling, menu-driven program

#include <iostream>
#include <fstream>
#include <vector>
#include <string>
#include <iomanip>
using namespace std;

// ---------- Train class ----------
class Train {
public:
    int number;
    string name, source, destination;
    int totalSeats, availableSeats;
    double fare;

    Train() {}
    Train(int n, string nm, string s, string d, int seats, double f) {
        number = n; name = nm; source = s; destination = d;
        totalSeats = seats; availableSeats = seats; fare = f;
    }

    void display() const {
        cout << left << setw(8) << number << setw(20) << name
             << setw(12) << source << setw(12) << destination
             << setw(8) << availableSeats << "Rs." << fare << endl;
    }
};

// ---------- Ticket class ----------
class Ticket {
public:
    int pnr;
    string passengerName;
    int age;
    int trainNumber;
    int seats;
    double totalFare;

    void display() const {
        cout << "\n----------- TICKET -----------\n";
        cout << "PNR         : " << pnr << endl;
        cout << "Passenger   : " << passengerName << " (Age " << age << ")\n";
        cout << "Train No    : " << trainNumber << endl;
        cout << "Seats       : " << seats << endl;
        cout << "Total Fare  : Rs." << totalFare << endl;
        cout << "------------------------------\n";
    }
};

// ---------- Reservation system ----------
class ReservationSystem {
    vector<Train> trains;
    vector<Ticket> tickets;
    int nextPNR;

    Train* findTrain(int number) {
        for (auto &t : trains)
            if (t.number == number) return &t;
        return nullptr;
    }

    // Save all tickets to a file so data is not lost
    void saveTickets() {
        ofstream out("tickets.txt");
        out << nextPNR << endl;
        for (auto &t : tickets)
            out << t.pnr << "|" << t.passengerName << "|" << t.age << "|"
                << t.trainNumber << "|" << t.seats << "|" << t.totalFare << endl;
    }

    // Load tickets from file when the program starts
    void loadTickets() {
        ifstream in("tickets.txt");
        if (!in) return;
        in >> nextPNR;
        in.ignore();
        string line;
        while (getline(in, line)) {
            if (line.empty()) continue;
            Ticket t;
            size_t p;
            p = line.find('|'); t.pnr = stoi(line.substr(0, p)); line.erase(0, p + 1);
            p = line.find('|'); t.passengerName = line.substr(0, p); line.erase(0, p + 1);
            p = line.find('|'); t.age = stoi(line.substr(0, p)); line.erase(0, p + 1);
            p = line.find('|'); t.trainNumber = stoi(line.substr(0, p)); line.erase(0, p + 1);
            p = line.find('|'); t.seats = stoi(line.substr(0, p)); line.erase(0, p + 1);
            t.totalFare = stod(line);
            tickets.push_back(t);
            Train* tr = findTrain(t.trainNumber);
            if (tr) tr->availableSeats -= t.seats;
        }
    }
public:
    ReservationSystem() {
        nextPNR = 1001;
        trains.push_back(Train(12001, "Shatabdi Express", "Delhi", "Bhopal", 50, 1200));
        trains.push_back(Train(12951, "Rajdhani Express", "Mumbai", "Delhi", 60, 2100));
        trains.push_back(Train(12627, "Karnataka Express", "Bangalore", "Delhi", 40, 1800));
        trains.push_back(Train(12841, "Coromandel Express", "Kolkata", "Chennai", 45, 1500));
        loadTickets();
    }

    void showTrains() {
        cout << "\n" << left << setw(8) << "No" << setw(20) << "Name"
             << setw(12) << "From" << setw(12) << "To"
             << setw(8) << "Seats" << "Fare\n";
        cout << string(68, '-') << endl;
        for (auto &t : trains) t.display();
    }

    void searchTrains() {
        string s, d;
        cout << "Enter source: "; cin >> s;
        cout << "Enter destination: "; cin >> d;
        bool found = false;
        for (auto &t : trains) {
            if (t.source == s && t.destination == d) {
                t.display();
                found = true;
            }
        }
        if (!found) cout << "No trains found on this route.\n";
    }

    void bookTicket() {
        showTrains();
        int trainNo, seats;
        cout << "\nEnter train number: ";
        cin >> trainNo;
        Train* t = findTrain(trainNo);
        if (!t) { cout << "Invalid train number!\n"; return; }

        Ticket tk;
        cout << "Enter passenger name: ";
        cin.ignore();
        getline(cin, tk.passengerName);
        cout << "Enter age: "; cin >> tk.age;
        cout << "Number of seats: "; cin >> seats;

        if (seats <= 0 || seats > t->availableSeats) {
            cout << "Sorry, only " << t->availableSeats << " seats available.\n";
            return;
        }

        tk.pnr = nextPNR++;
        tk.trainNumber = trainNo;
        tk.seats = seats;
        tk.totalFare = seats * t->fare;
        // Child discount (under 12 pays half)
        if (tk.age < 12) tk.totalFare /= 2;

        t->availableSeats -= seats;
        tickets.push_back(tk);
        saveTickets();

        cout << "\nBooking successful!";
        tk.display();
    }

    void viewTicket() {
        int pnr;
        cout << "Enter PNR: "; cin >> pnr;
        for (auto &t : tickets) {
            if (t.pnr == pnr) { t.display(); return; }
        }
        cout << "No ticket found with this PNR.\n";
    }

    void cancelTicket() {
        int pnr;
        cout << "Enter PNR to cancel: "; cin >> pnr;
        for (size_t i = 0; i < tickets.size(); i++) {
            if (tickets[i].pnr == pnr) {
                Train* t = findTrain(tickets[i].trainNumber);
                if (t) t->availableSeats += tickets[i].seats;
                double refund = tickets[i].totalFare * 0.8; // 20% cancellation charge
                tickets.erase(tickets.begin() + i);
                saveTickets();
                cout << "Ticket cancelled. Refund: Rs." << refund << endl;
                return;
            }
        }
        cout << "No ticket found with this PNR.\n";
    }

    void showAllBookings() {
        if (tickets.empty()) { cout << "No bookings yet.\n"; return; }
        for (auto &t : tickets) t.display();
    }
};

// ---------- Main ----------
int main() {
    ReservationSystem rs;
    int choice;

    do {
        cout << "\n===== RAILWAY RESERVATION SYSTEM =====\n";
        cout << "1. View all trains\n";
        cout << "2. Search trains by route\n";
        cout << "3. Book ticket\n";
        cout << "4. View ticket (PNR)\n";
        cout << "5. Cancel ticket\n";
        cout << "6. View all bookings\n";
        cout << "0. Exit\n";
        cout << "Enter choice: ";
        cin >> choice;

        switch (choice) {
            case 1: rs.showTrains(); break;
            case 2: rs.searchTrains(); break;
            case 3: rs.bookTicket(); break;
            case 4: rs.viewTicket(); break;
            case 5: rs.cancelTicket(); break;
            case 6: rs.showAllBookings(); break;
            case 0: cout << "Thank you! Have a safe journey.\n"; break;
            default: cout << "Invalid choice, try again.\n";
        }
    } while (choice != 0);

    return 0;
}
