# RailNova — Modern C++ Railway Reservation System & Web Platform

A full-stack railway reservation platform built by integrating a native C++ object-oriented backend engine with a modern responsive web interface.

---

## 1. Project Overview & Architecture

The project bridges classical C++ object-oriented business logic with a web frontend:

```
+-------------------------------------------------------------------+
|               MODERN WEB FRONTEND (HTML5 / CSS3 / JS)             |
|  - RailNova Brand Interface (Deep Navy & Crisp White)             |
|  - Interactive Route Search & Instant Station Swapping            |
|  - Real-time Fare Calculator (50% Child Discount Preview)         |
|  - Official Digital Boarding Pass with Barcode & Print Support    |
|  - PNR Verification & 80% Refund Cancellation Portal              |
|  - Demonstration Inspector (Live All Bookings & Revenue Metrics)  |
+---------------------------------+---------------------------------+
                                  |
                           HTTP REST / JSON
                                  |
+---------------------------------v---------------------------------+
|                   C++ EMBEDDED WINSOCK2 HTTP SERVER               |
|  - Multi-threaded Request Dispatcher (Windows API Threads)        |
|  - Static Asset Provider (index.html, style.css, script.js)       |
|  - Full CORS Support & JSON Serialization / Deserialization       |
+---------------------------------+---------------------------------+
                                  |
+---------------------------------v---------------------------------+
|                    CORE C++ RESERVATION ENGINE                    |
|  - Classes: Train, Ticket, ReservationEngine                      |
|  - Atomic Seat Validation & Concurrency Protection (CRITICAL_SEC) |
|  - Exact Business Logic: 50% Child Discount, 80% Cancel Refund    |
|  - Trimmed & Case-Insensitive Route Search Matching               |
+---------------------------------+---------------------------------+
                                  |
                                  v
                    +-----------------------------+
                    |      data/tickets.txt       |
                    | (Persistent Pipe-Delimited) |
                    +-----------------------------+
```

---

## 2. Project Directory Structure

```
c++ project/
├── frontend/
│   ├── index.html           # Modern responsive landing page & application UI
│   ├── style.css            # Executive deep-navy styling & responsive layout
│   └── script.js            # Client controller connecting to C++ REST endpoints
├── backend/
│   ├── railway_core.hpp     # Core Train, Ticket, and ReservationEngine classes
│   ├── http_server.hpp      # Lightweight Winsock2 multi-threaded HTTP server
│   └── main.cpp             # Server entry point (starts server on port 8080)
├── data/
│   └── tickets.txt          # Persistent booking records (pipe-delimited)
├── railway_reservation.cpp  # Original console version (preserved 100% intact)
├── server.exe               # Compiled C++ backend executable
└── README.md                # Documentation & College Viva Guide
```

---

## 3. Predefined Trains (Fleet Demonstration Data)

| Train No | Name | Route | Total Seats | Base Fare | Child Fare (< 12) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **12001** | Shatabdi Express | Delhi ➔ Bhopal | 50 | ₹1,200 | ₹600 (50% off) |
| **12951** | Rajdhani Express | Mumbai ➔ Delhi | 60 | ₹2,100 | ₹1,050 (50% off) |
| **12627** | Karnataka Express | Bangalore ➔ Delhi | 40 | ₹1,800 | ₹900 (50% off) |
| **12841** | Coromandel Express | Kolkata ➔ Chennai | 45 | ₹1,500 | ₹750 (50% off) |

---

## 4. How to Compile & Run (Windows & MinGW)

### Prerequisites
* **OS**: Windows (10 or 11)
* **Compiler**: MinGW GCC (`g++`)
* **Libraries**: Native Windows Winsock (`-lws2_32` included with MinGW, zero external downloads required)

### Step 1: Open Terminal in the Project Directory
Open VS Code or Windows PowerShell in `c:\Users\shaik\OneDrive\Desktop\c++ project`.

### Step 2: Compile the C++ Backend Server
Run the following command:
```powershell
g++ -std=c++11 -O2 backend/main.cpp -o server.exe -lws2_32
```
* **Explanation of flags**:
  * `-std=c++11`: Enables modern C++ standards.
  * `-O2`: Enables code optimization.
  * `-lws2_32`: Links the Windows Sockets (Winsock2) library.

### Step 3: Start the Backend Server
Run:
```powershell
.\server.exe
```
You will see:
```
========================================================
  RailNova C++ Railway Reservation Server (Live)
========================================================
Server running at:  http://localhost:8080/
API base URL:       http://localhost:8080/api/
Frontend directory: frontend/
Tickets file:       data/tickets.txt
--------------------------------------------------------
```

### Step 4: Open the Website
Open your browser (Google Chrome, Microsoft Edge, or Firefox) and navigate to:
```
http://localhost:8080/
```
The website is now connected to your live C++ backend.

---

## 5. Testing the Key Workflows

### 1. Route Search
* Enter `Delhi` in **From** and `Bhopal` in **To** (or click the **Delhi ➔ Bhopal** quick route chip).
* Click **Search Trains**.
* The C++ backend performs a case-insensitive search and displays **#12001 Shatabdi Express**.

### 2. Booking a Ticket
* Click **Book Ticket** on any train card.
* Enter passenger name (e.g., `Rajesh Kumar`).
* Enter passenger age (e.g., `8` for child or `32` for adult).
* Notice the **Live Fare Calculator**:
  * Age `8`: Shows **50% Child Discount Applied**.
* Enter number of seats (e.g., `2`).
* Click **Confirm Booking & Generate PNR**.
* The C++ engine verifies seat availability, decrements available seats, generates an atomic PNR, writes to `tickets.txt`, and generates an official **Digital Boarding Pass**.

### 3. PNR Verification
* Navigate to **PNR Status** tab.
* Enter the generated PNR (e.g., `1004`).
* Click **Retrieve Ticket** to pull the real-time record from the C++ backend.

### 4. Cancellation & 80% Refund
* Navigate to **Cancel Ticket** tab.
* Enter the PNR and click **Inspect Booking**.
* The review card displays:
  * Original fare paid.
  * 20% cancellation deduction.
  * **80% Net Refund Amount**.
* Click **Confirm Cancellation**.
* The C++ backend:
  * Restores the exact number of seats to the train fleet.
  * Updates persistent storage in `tickets.txt`.
  * Returns the refund amount.

### 5. Verifying Data Persistence
* Book a ticket and note the PNR.
* Stop the server by pressing `Ctrl + C` in the terminal.
* Restart the server (`.\server.exe`).
* Check the PNR on the website — the booking is loaded from `tickets.txt`.

---

## 6. REST API Reference

| Method | Endpoint | Description | Sample Request / Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Backend status check | `{"status":"ok","engine":"RailNova C++ API Engine"}` |
| `GET` | `/api/trains` | List all trains & available seats | Returns array of Train objects |
| `POST` | `/api/search` | Search trains by route | `{"source":"Delhi","destination":"Bhopal"}` |
| `POST` | `/api/bookings` | Book ticket & generate PNR | `{"trainNumber":12001,"passengerName":"John","age":28,"seats":2}` |
| `GET` | `/api/bookings/{pnr}`| Retrieve ticket by PNR | Returns Ticket object with train details |
| `GET` | `/api/bookings` | Retrieve all active bookings | Returns array of all active Ticket objects |
| `POST` | `/api/bookings/cancel` | Cancel booking & issue refund | `{"pnr":1004}` |

---

## 7. College Demonstration & Viva Guide

### Q1: Why did you choose Winsock2 instead of a heavy third-party framework?
**Answer**:
> *"On Windows with MinGW, standard GCC distributions often use the Win32 threading model where POSIX thread wrappers or heavy C++17 web frameworks like Crow require complex dependencies, CMake, or vcpkg. By embedding a compact Winsock2 HTTP server directly in C++, the project compiles in one command with `g++ backend/main.cpp -lws2_32`, has zero external runtime dependencies, and demonstrates deep systems programming knowledge using native Windows networking APIs."*

### Q2: How does the web browser communicate with the C++ backend?
**Answer**:
> *"The frontend uses the modern JavaScript `fetch()` API to make HTTP requests (GET, POST) with JSON payloads to `http://localhost:8080/api/*`. The C++ server accepts incoming TCP socket connections, parses HTTP request headers and JSON bodies, routes them to the `ReservationEngine` methods, and formats C++ object data into standard JSON responses."*

### Q3: How is thread safety ensured when multiple web requests arrive simultaneously?
**Answer**:
> *"Each HTTP request is handled in a separate Windows thread created with `CreateThread()`. To prevent race conditions or data corruption when updating shared train seats or the tickets list, the `ReservationEngine` utilizes a Windows `CRITICAL_SECTION` with an RAII `LockGuard`. This guarantees that operations like seat decrement, PNR increment, and file writes are strictly atomic."*

### Q4: How is data persistence handled?
**Answer**:
> *"Data is persisted in `tickets.txt` using a pipe-delimited schema (`PNR|PassengerName|Age|TrainNo|Seats|TotalFare`). The first line stores `nextPNR` so that PNR counters never reset. On server boot, `loadTicketsInternal()` restores all bookings and automatically adjusts available seat counts for each train."*

### Q5: What happens to the original console application?
**Answer**:
> *"The original `railway_reservation.cpp` file remains completely intact and can still be compiled with `g++ railway_reservation.cpp -o rr.exe`. The core design logic was preserved and exposed cleanly for the web interface."*
