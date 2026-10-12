// ===================================================================
// RailNova — Client-side Integration Controller (Upgraded Edition)
// Communicates with C++ Backend REST Engine on Port 8080
// ===================================================================

const API_BASE = (window.location.protocol === 'file:') 
  ? 'http://localhost:8080/api' 
  : `${window.location.origin}/api`;

let currentTrains = [];
let originalFetchedTrains = [];
let selectedTrainForBooking = null;
let allBookingsData = [];

// Known Station Codes for Indian Railways Demonstration
const STATION_CODES = {
  'delhi': 'NDLS',
  'mumbai': 'BCT',
  'bangalore': 'SBC',
  'kolkata': 'HWH',
  'bhopal': 'BPL',
  'chennai': 'MAS'
};

function getStationCode(city) {
  if (!city) return 'STN';
  const clean = city.trim().toLowerCase();
  return STATION_CODES[clean] || clean.substring(0, 3).toUpperCase();
}

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  // Set default demo date to tomorrow
  const dateInput = document.getElementById('journeyDate');
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.value = tomorrow.toISOString().split('T')[0];
  }

  // Setup station code pills listener
  const srcIn = document.getElementById('sourceInput');
  const dstIn = document.getElementById('destInput');
  if (srcIn) {
    srcIn.addEventListener('input', () => updateStationCodePill('sourceInput', 'sourceCodePill'));
  }
  if (dstIn) {
    dstIn.addEventListener('input', () => updateStationCodePill('destInput', 'destCodePill'));
  }

  // Check backend server connectivity
  checkServerHealth();
  setInterval(checkServerHealth, 15000);

  // Initial data load
  fetchAllTrains();
});

function updateStationCodePill(inputId, pillId) {
  const input = document.getElementById(inputId);
  const pill = document.getElementById(pillId);
  if (!input || !pill) return;
  const val = input.value.trim();
  pill.textContent = val ? getStationCode(val) : 'STATION';
}

// ===================================================================
// Mobile Menu Navigation
// ===================================================================
function toggleMobileMenu() {
  const drawer = document.getElementById('mobileDrawer');
  if (drawer) {
    drawer.classList.toggle('open');
  }
}

// ===================================================================
// Server Health Check
// ===================================================================
async function checkServerHealth() {
  const statusPill = document.getElementById('serverStatusPill');
  const statusText = document.getElementById('serverStatusText');
  const statusDot = statusPill ? statusPill.querySelector('.status-dot') : null;

  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      if (statusText) statusText.textContent = 'Backend: Connected (Live)';
      if (statusDot) {
        statusDot.className = 'status-dot online';
      }
    } else {
      throw new Error('Non-200 response');
    }
  } catch (err) {
    if (statusText) statusText.textContent = 'Backend: Offline (Run server.exe)';
    if (statusDot) {
      statusDot.className = 'status-dot offline pulsating';
    }
  }
}

// ===================================================================
// Tab Navigation
// ===================================================================
function switchTab(tabId) {
  // Update nav buttons
  const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');
  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(tabId)) {
      link.classList.add('active');
    }
  });

  // Update tab sections
  const tabs = document.querySelectorAll('.tab-content');
  tabs.forEach(tab => tab.classList.remove('active'));

  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) {
    targetTab.classList.add('active');
  }

  // Context-specific actions
  if (tabId === 'admin') {
    fetchAllBookings();
  } else if (tabId === 'search') {
    fetchAllTrains();
  }

  // Smooth scroll to main container
  const mainCont = document.getElementById('mainContent');
  if (mainCont && window.scrollY > 450) {
    mainCont.scrollIntoView({ behavior: 'smooth' });
  }
}

// ===================================================================
// Fetch All Trains (GET /api/trains)
// ===================================================================
async function fetchAllTrains() {
  const container = document.getElementById('trainsContainer');
  const summary = document.getElementById('searchResultSummary');
  if (summary) summary.textContent = 'Showing all trains loaded from native C++ memory state.';

  if (container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Fetching train schedules from C++ backend...</p>
      </div>
    `;
  }

  try {
    const res = await fetch(`${API_BASE}/trains`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const trains = await res.json();
    currentTrains = [...trains];
    originalFetchedTrains = [...trains];
    applyTrainSorting();
  } catch (err) {
    console.error('Error fetching trains:', err);
    if (container) {
      container.innerHTML = `
        <div class="loading-state">
          <p style="color: var(--danger-red); font-weight: 700; margin-bottom: 0.5rem;">
            Unable to connect to C++ backend server.
          </p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
            Please ensure <code>server.exe</code> is running on port 8080.
          </p>
          <button class="btn btn-secondary btn-sm" onclick="fetchAllTrains()">Retry Connection</button>
        </div>
      `;
    }
  }
}

function resetAndFetchAllTrains() {
  const s = document.getElementById('sourceInput');
  const d = document.getElementById('destInput');
  if (s) s.value = '';
  if (d) d.value = '';
  updateStationCodePill('sourceInput', 'sourceCodePill');
  updateStationCodePill('destInput', 'destCodePill');
  fetchAllTrains();
}

// ===================================================================
// Sorting & Filtering Trains
// ===================================================================
function applyTrainSorting() {
  const sortSelect = document.getElementById('sortTrainsSelect');
  const sortVal = sortSelect ? sortSelect.value : 'default';

  let list = [...currentTrains];

  if (sortVal === 'fare-asc') {
    list.sort((a, b) => a.fare - b.fare);
  } else if (sortVal === 'fare-desc') {
    list.sort((a, b) => b.fare - a.fare);
  } else if (sortVal === 'seats-desc') {
    list.sort((a, b) => b.availableSeats - a.availableSeats);
  }

  renderTrainCards(list);
}

// ===================================================================
// Render Train Cards
// ===================================================================
function renderTrainCards(trains) {
  const container = document.getElementById('trainsContainer');
  if (!container) return;

  if (!trains || trains.length === 0) {
    container.innerHTML = `
      <div class="loading-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-light); margin-bottom: 0.75rem;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        <p style="font-weight: 800; font-size: 1.15rem; color: var(--midnight-bg); margin-bottom: 0.35rem;">No Matching Trains Found</p>
        <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1.5rem; max-width: 480px; margin-left: auto; margin-right: auto;">
          No predefined train route matches this departure and arrival combination. You can explore our 4 daily featured routes below.
        </p>
        <button class="btn btn-primary btn-sm" onclick="resetAndFetchAllTrains()">View All 4 Active Trains</button>
      </div>
    `;
    return;
  }

  container.innerHTML = trains.map(train => {
    let seatPillClass = 'available';
    let seatText = `${train.availableSeats} Seats Available`;
    if (train.availableSeats <= 0) {
      seatPillClass = 'full';
      seatText = 'Sold Out';
    } else if (train.availableSeats <= 10) {
      seatPillClass = 'low';
      seatText = `Only ${train.availableSeats} Left!`;
    }

    const isSoldOut = train.availableSeats <= 0;
    const childFare = (train.fare / 2).toFixed(2);
    const capacityPct = Math.round((train.availableSeats / train.totalSeats) * 100);

    const srcCode = getStationCode(train.source);
    const dstCode = getStationCode(train.destination);

    return `
      <div class="train-card">
        <div>
          <div class="train-card-header">
            <div>
              <span class="train-number-tag">#${train.number}</span>
              <h3 class="train-name">${escapeHtml(train.name)}</h3>
            </div>
            <span class="seat-status-pill ${seatPillClass}">${seatText}</span>
          </div>

          <!-- Route Visualizer with Station Code Badges -->
          <div class="train-route-visual">
            <div class="station-stop">
              <span class="station-code-badge">${srcCode}</span>
              <span class="station-label">Departure</span>
              <span class="station-name">${escapeHtml(train.source)}</span>
            </div>
            
            <div class="route-connector">
              <div class="connector-line"></div>
              <span class="route-type">Daily Express</span>
            </div>
            
            <div class="station-stop" style="text-align: right;">
              <span class="station-code-badge" style="margin-left: auto;">${dstCode}</span>
              <span class="station-label">Destination</span>
              <span class="station-name">${escapeHtml(train.destination)}</span>
            </div>
          </div>

          <!-- Capacity Bar Gauge -->
          <div class="seat-capacity-wrapper">
            <div class="capacity-text-row">
              <span>Capacity Available:</span>
              <span>${train.availableSeats} / ${train.totalSeats} Seats (${capacityPct}%)</span>
            </div>
            <div class="capacity-bar-track">
              <div class="capacity-bar-fill" style="width: ${capacityPct}%;"></div>
            </div>
          </div>
        </div>

        <div class="train-card-footer">
          <div class="fare-display">
            <span class="fare-label">Base Fare</span>
            <span class="fare-amount">₹${train.fare.toFixed(2)}</span>
            <span class="fare-child-note">&#10003; Child &lt;12: ₹${childFare} (50% off)</span>
          </div>

          <button 
            class="btn btn-primary" 
            ${isSoldOut ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
            onclick="openBookingModal(${train.number})"
          >
            ${isSoldOut ? 'Sold Out' : 'Book Ticket'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ===================================================================
// Search Trains (POST /api/search)
// ===================================================================
async function handleSearch(e) {
  if (e) e.preventDefault();

  const source = document.getElementById('sourceInput').value.trim();
  const dest = document.getElementById('destInput').value.trim();

  if (!source && !dest) {
    fetchAllTrains();
    return;
  }

  const container = document.getElementById('trainsContainer');
  const summary = document.getElementById('searchResultSummary');
  if (summary) summary.textContent = `Searching route: ${source || 'Any'} ➔ ${dest || 'Any'}...`;

  if (container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Querying C++ reservation engine...</p>
      </div>
    `;
  }

  try {
    const res = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: source, destination: dest })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const results = await res.json();
    currentTrains = [...results];
    
    if (summary) {
      summary.textContent = `Found ${results.length} train(s) matching "${source || 'Any'}" to "${dest || 'Any'}".`;
    }
    
    applyTrainSorting();

    // Scroll smoothly to results
    const tabSearch = document.getElementById('tab-search');
    if (tabSearch) tabSearch.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('Search error:', err);
    showToast('Failed to perform search. Please verify backend is running.', 'error');
  }
}

// Swap Stations helper
function swapStations() {
  const s = document.getElementById('sourceInput');
  const d = document.getElementById('destInput');
  if (s && d) {
    const temp = s.value;
    s.value = d.value;
    d.value = temp;
    updateStationCodePill('sourceInput', 'sourceCodePill');
    updateStationCodePill('destInput', 'destCodePill');
    showToast('Departure and destination stations swapped.', 'info');
  }
}

// Quick Route Chip Click
function quickFillRoute(src, dst) {
  const s = document.getElementById('sourceInput');
  const d = document.getElementById('destInput');
  if (s) s.value = src;
  if (d) d.value = dst;
  updateStationCodePill('sourceInput', 'sourceCodePill');
  updateStationCodePill('destInput', 'destCodePill');
  handleSearch();
}

// ===================================================================
// Multi-Step Booking Modal & Live Calculator
// ===================================================================
function openBookingModal(trainNumber) {
  const train = currentTrains.find(t => t.number === trainNumber) || originalFetchedTrains.find(t => t.number === trainNumber);
  if (!train) {
    showToast('Train information not found.', 'error');
    return;
  }

  selectedTrainForBooking = train;

  document.getElementById('modalTrainNumber').textContent = `#${train.number}`;
  document.getElementById('modalTrainName').textContent = train.name;
  document.getElementById('modalTrainRoute').textContent = `${train.source} ➔ ${train.destination}`;
  document.getElementById('modalAvailableSeats').textContent = `${train.availableSeats} Seats Left`;
  document.getElementById('modalBaseFare').textContent = `₹${train.fare.toFixed(2)} / seat`;
  document.getElementById('bookTrainNumber').value = train.number;

  const seatCountInput = document.getElementById('bookSeatCount');
  if (seatCountInput) {
    seatCountInput.max = train.availableSeats;
    seatCountInput.value = 1;
  }

  const errBanner = document.getElementById('bookingErrorBanner');
  if (errBanner) errBanner.style.display = 'none';

  updateFareCalculator();

  const modal = document.getElementById('bookingModal');
  if (modal) modal.classList.add('active');
}

function closeBookingModal() {
  const modal = document.getElementById('bookingModal');
  if (modal) modal.classList.remove('active');
}

function updateFareCalculator() {
  if (!selectedTrainForBooking) return;

  const ageInput = document.getElementById('bookPassengerAge');
  const seatsInput = document.getElementById('bookSeatCount');
  const step3 = document.getElementById('stepIndicator3');

  const age = parseInt(ageInput ? ageInput.value : 0) || 0;
  const seats = parseInt(seatsInput ? seatsInput.value : 1) || 1;
  const baseFare = selectedTrainForBooking.fare;

  let total = seats * baseFare;
  const isChildDiscount = (age > 0 && age < 12);

  const calcBase = document.getElementById('calcBaseFare');
  const calcSeats = document.getElementById('calcSeats');
  const calcDiscountRow = document.getElementById('calcDiscountRow');
  const calcTotal = document.getElementById('calcTotalFare');

  if (calcBase) calcBase.textContent = `₹${baseFare.toFixed(2)}`;
  if (calcSeats) calcSeats.textContent = `${seats} Seat(s)`;

  if (isChildDiscount) {
    total = total / 2;
    if (calcDiscountRow) calcDiscountRow.style.display = 'flex';
  } else {
    if (calcDiscountRow) calcDiscountRow.style.display = 'none';
  }

  if (calcTotal) calcTotal.textContent = `₹${total.toFixed(2)}`;

  // Update step 3 highlight when inputs are filled
  const nameInput = document.getElementById('bookPassengerName');
  if (step3) {
    if (nameInput && nameInput.value.trim() && age > 0) {
      step3.classList.add('active');
    } else {
      step3.classList.remove('active');
    }
  }
}

// ===================================================================
// Booking Submission (POST /api/bookings)
// ===================================================================
async function handleBookingSubmit(e) {
  e.preventDefault();

  const trainNumber = parseInt(document.getElementById('bookTrainNumber').value);
  const passengerName = document.getElementById('bookPassengerName').value.trim();
  const age = parseInt(document.getElementById('bookPassengerAge').value);
  const seats = parseInt(document.getElementById('bookSeatCount').value);

  const errorBanner = document.getElementById('bookingErrorBanner');
  const spinner = document.getElementById('bookingSpinner');
  const submitBtn = document.getElementById('btnSubmitBooking');

  if (!passengerName) {
    displayModalError('Please enter a valid passenger name.');
    return;
  }

  if (isNaN(age) || age <= 0 || age > 120) {
    displayModalError('Please enter a valid passenger age (1 - 120).');
    return;
  }

  if (isNaN(seats) || seats <= 0) {
    displayModalError('Number of seats must be at least 1.');
    return;
  }

  if (errorBanner) errorBanner.style.display = 'none';
  if (spinner) spinner.style.display = 'inline-block';
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trainNumber: trainNumber,
        passengerName: passengerName,
        age: age,
        seats: seats
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      closeBookingModal();
      showToast(`Booking Successful! PNR Reference: ${data.ticket.pnr}`, 'success');
      showTicketModal(data.ticket);
      // Refresh current trains and bookings table
      fetchAllTrains();
      fetchAllBookings();
    } else {
      displayModalError(data.message || 'Booking request rejected by backend.');
    }
  } catch (err) {
    console.error('Booking error:', err);
    displayModalError('Connection failed. Could not communicate with C++ server.');
  } finally {
    if (spinner) spinner.style.display = 'none';
    if (submitBtn) submitBtn.disabled = false;
  }
}

function displayModalError(msg) {
  const errBanner = document.getElementById('bookingErrorBanner');
  if (errBanner) {
    errBanner.textContent = msg;
    errBanner.style.display = 'block';
  }
}

// ===================================================================
// Premium Digital Boarding Pass Modal
// ===================================================================
function showTicketModal(ticket) {
  const content = document.getElementById('ticketModalContent');
  if (!content) return;

  const isChildDiscount = ticket.isChildDiscount || (ticket.age < 12);
  const trainName = ticket.trainName || 'Express';
  const srcCode = getStationCode(ticket.source);
  const dstCode = getStationCode(ticket.destination);

  content.innerHTML = `
    <div class="digital-ticket">
      <div class="ticket-top">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.85;">Indian Railways &bull; RailNova Demonstrator</span>
          <h2 style="font-size: 1.5rem; font-weight: 800; margin-top: 0.25rem;">${escapeHtml(trainName)}</h2>
          <span style="font-size: 0.85rem; opacity: 0.9;">Train #${ticket.trainNumber} &bull; ${srcCode} ➔ ${dstCode} (${escapeHtml(ticket.source || '')} to ${escapeHtml(ticket.destination || '')})</span>
        </div>
        <div class="ticket-pnr-box">
          <div class="ticket-pnr-label">PNR REFERENCE</div>
          <div class="ticket-pnr-val">${ticket.pnr}</div>
        </div>
      </div>

      <div class="ticket-body">
        <div class="ticket-grid">
          <div>
            <div class="ticket-field-label">Passenger Name</div>
            <div class="ticket-field-val">${escapeHtml(ticket.passengerName)}</div>
          </div>
          <div>
            <div class="ticket-field-label">Age / Category</div>
            <div class="ticket-field-val">
              ${ticket.age} Years ${isChildDiscount ? '<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.75rem; padding: 2px 7px; border-radius: 4px; font-weight: 700;">50% Child Discount</span>' : '(Adult)'}
            </div>
          </div>
          <div>
            <div class="ticket-field-label">Seats Allocated</div>
            <div class="ticket-field-val">${ticket.seats} Seat(s)</div>
          </div>
          <div>
            <div class="ticket-field-label">Total Fare Paid</div>
            <div class="ticket-field-val" style="color: var(--brand-blue); font-family: var(--font-mono); font-size: 1.3rem;">₹${Number(ticket.totalFare).toFixed(2)}</div>
          </div>
        </div>

        <div class="ticket-perforation"></div>

        <!-- Realistic Ticket Barcode Graphic -->
        <div style="margin: 1.25rem 0;">
          <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px;">Electronic Barcode Authentication:</div>
          <div class="ticket-barcode-graphic">
            <div class="barcode-line" style="width: 3px;"></div>
            <div class="barcode-line" style="width: 1px;"></div>
            <div class="barcode-line" style="width: 4px;"></div>
            <div class="barcode-line" style="width: 2px;"></div>
            <div class="barcode-line" style="width: 1px;"></div>
            <div class="barcode-line" style="width: 5px;"></div>
            <div class="barcode-line" style="width: 2px;"></div>
            <div class="barcode-line" style="width: 3px;"></div>
            <div class="barcode-line" style="width: 6px;"></div>
            <div class="barcode-line" style="width: 1px;"></div>
            <div class="barcode-line" style="width: 3px;"></div>
            <div class="barcode-line" style="width: 2px;"></div>
            <div class="barcode-line" style="width: 4px;"></div>
            <div class="barcode-line" style="width: 1px;"></div>
            <div class="barcode-line" style="width: 5px;"></div>
            <div class="barcode-line" style="width: 2px;"></div>
            <div class="barcode-line" style="width: 4px;"></div>
            <div class="barcode-line" style="width: 2px;"></div>
            <div class="barcode-line" style="width: 1px;"></div>
            <div class="barcode-line" style="width: 4px;"></div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; flex-wrap: wrap; gap: 0.75rem;">
          <div class="ticket-status-stamp">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            CONFIRMED &amp; PERSISTED IN TICKETS.TXT
          </div>
          <div style="font-size: 0.775rem; color: var(--text-muted); text-align: right; line-height: 1.4;">
            Seat quantity confirmed.<br>Individual berths not assigned by engine.
          </div>
        </div>
      </div>
    </div>
  `;

  const modal = document.getElementById('ticketModal');
  if (modal) modal.classList.add('active');
}

function closeTicketModal() {
  const modal = document.getElementById('ticketModal');
  if (modal) modal.classList.remove('active');
}

function printOfficialTicket() {
  window.print();
}

// ===================================================================
// PNR Status Lookup (GET /api/bookings/{pnr})
// ===================================================================
async function handlePnrLookup(e) {
  e.preventDefault();
  const pnr = document.getElementById('pnrSearchInput').value.trim();
  const container = document.getElementById('pnrResultContainer');

  if (!pnr) return;

  if (container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Querying C++ engine for PNR ${escapeHtml(pnr)}...</p>
      </div>
    `;
  }

  try {
    const res = await fetch(`${API_BASE}/bookings/${pnr}`);
    const data = await res.json();

    if (res.ok && data.success) {
      renderPnrResult(data.ticket);
    } else {
      if (container) {
        container.innerHTML = `
          <div class="digital-ticket" style="padding: 2.5rem; text-align: center; border-left: 4px solid var(--danger-red);">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--danger-red)" stroke-width="2" style="margin-bottom: 0.75rem;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <h3 style="color: var(--danger-red); font-size: 1.3rem; margin-bottom: 0.35rem;">PNR Not Found</h3>
            <p style="color: var(--text-muted); font-size: 0.925rem; max-width: 440px; margin: 0 auto 1.25rem;">
              No booking record exists for PNR <strong>${escapeHtml(pnr)}</strong> in <code>tickets.txt</code>.
            </p>
            <button class="btn btn-secondary btn-sm" onclick="switchTab('admin')">Inspect All Active PNRs</button>
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('PNR lookup error:', err);
    if (container) {
      container.innerHTML = `
        <div class="error-banner">Unable to reach backend server. Please verify server.exe is running.</div>
      `;
    }
  }
}

function renderPnrResult(ticket) {
  const container = document.getElementById('pnrResultContainer');
  if (!container) return;

  const isChildDiscount = ticket.isChildDiscount || (ticket.age < 12);
  const trainName = ticket.trainName || 'Express';
  const srcCode = getStationCode(ticket.source);
  const dstCode = getStationCode(ticket.destination);

  container.innerHTML = `
    <div class="digital-ticket">
      <div class="ticket-top">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.85;">Verified Booking Slip &bull; RailNova</span>
          <h2 style="font-size: 1.45rem; font-weight: 800; margin-top: 0.2rem;">${escapeHtml(trainName)}</h2>
          <span style="font-size: 0.85rem; opacity: 0.9;">Train #${ticket.trainNumber} &bull; ${srcCode} ➔ ${dstCode} (${escapeHtml(ticket.source || '')} to ${escapeHtml(ticket.destination || '')})</span>
        </div>
        <div class="ticket-pnr-box">
          <div class="ticket-pnr-label">PNR REFERENCE</div>
          <div class="ticket-pnr-val">${ticket.pnr}</div>
        </div>
      </div>

      <div class="ticket-body">
        <div class="ticket-grid">
          <div>
            <div class="ticket-field-label">Passenger Name</div>
            <div class="ticket-field-val">${escapeHtml(ticket.passengerName)}</div>
          </div>
          <div>
            <div class="ticket-field-label">Age &bull; Category</div>
            <div class="ticket-field-val">
              ${ticket.age} Years ${isChildDiscount ? '<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">50% Child Discount</span>' : '(Adult)'}
            </div>
          </div>
          <div>
            <div class="ticket-field-label">Seats Booked</div>
            <div class="ticket-field-val">${ticket.seats} Seat(s)</div>
          </div>
          <div>
            <div class="ticket-field-label">Total Fare Paid</div>
            <div class="ticket-field-val" style="color: var(--brand-blue); font-family: var(--font-mono); font-size: 1.25rem;">₹${Number(ticket.totalFare).toFixed(2)}</div>
          </div>
        </div>

        <div class="ticket-perforation"></div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; flex-wrap: wrap; gap: 0.75rem;">
          <div class="ticket-status-stamp">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Active Confirmed Record
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="showTicketModal(${JSON.stringify(ticket).replace(/"/g, '&quot;')})">
              Print Slip
            </button>
            <button class="btn btn-warning btn-sm" onclick="initiateCancelFromTicket(${ticket.pnr})">
              Cancel This Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function initiateCancelFromTicket(pnr) {
  switchTab('cancel');
  const input = document.getElementById('cancelPnrInput');
  if (input) {
    input.value = pnr;
    handleCancelLookup();
  }
}

// ===================================================================
// Ticket Cancellation (Review & Confirm)
// ===================================================================
async function handleCancelLookup(e) {
  if (e) e.preventDefault();

  const pnr = document.getElementById('cancelPnrInput').value.trim();
  const container = document.getElementById('cancelDetailsContainer');
  if (!pnr) return;

  if (container) {
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Retrieving booking for cancellation inspection...</p>
      </div>
    `;
  }

  try {
    const res = await fetch(`${API_BASE}/bookings/${pnr}`);
    const data = await res.json();

    if (res.ok && data.success) {
      const ticket = data.ticket;
      const originalFare = Number(ticket.totalFare);
      const refund = originalFare * 0.8;
      const cancellationFee = originalFare * 0.2;

      container.innerHTML = `
        <div class="digital-ticket" style="margin-top: 1.75rem; border-color: rgba(239, 68, 68, 0.4);">
          <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.35) 100%); color: #FCA5A5; padding: 1.25rem 1.75rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(239, 68, 68, 0.3);">
            <div>
              <span style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #FCA5A5;">STEP 2 OF 2 &bull; FINANCIAL AUDIT</span>
              <h4 style="font-weight: 800; font-size: 1.2rem; margin-top: 2px; color: #FFFFFF;">Review Cancellation Terms</h4>
            </div>
            <span style="font-family: var(--font-mono); font-weight: 800; font-size: 1.1rem; background: rgba(0,0,0,0.5); border: 1px solid rgba(239, 68, 68, 0.4); color: #FCA5A5; padding: 4px 10px; border-radius: 6px;">PNR #${ticket.pnr}</span>
          </div>

          <div style="padding: 1.75rem;">
            <div class="ticket-grid">
              <div>
                <div class="ticket-field-label">Passenger</div>
                <div class="ticket-field-val">${escapeHtml(ticket.passengerName)} (Age ${ticket.age})</div>
              </div>
              <div>
                <div class="ticket-field-label">Train</div>
                <div class="ticket-field-val">#${ticket.trainNumber} - ${escapeHtml(ticket.trainName || 'Express')}</div>
              </div>
              <div>
                <div class="ticket-field-label">Original Fare Paid</div>
                <div class="ticket-field-val">₹${originalFare.toFixed(2)}</div>
              </div>
              <div>
                <div class="ticket-field-label">Cancellation Deduction (20%)</div>
                <div class="ticket-field-val" style="color: var(--danger-red);">- ₹${cancellationFee.toFixed(2)}</div>
              </div>
            </div>

            <div class="fare-calculation-box" style="background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); margin: 1.25rem 0;">
              <div class="fare-row" style="color: #34D399; font-size: 1.05rem; font-weight: 800;">
                <span>Net Refund Credited (80%):</span>
                <span style="font-size: 1.45rem; font-family: var(--font-mono); color: var(--brand-turquoise);">₹${refund.toFixed(2)}</span>
              </div>
              <div style="font-size: 0.8rem; color: #6EE7B7; margin-top: 0.35rem; font-weight: 600;">
                &#10003; Upon confirmation, ${ticket.seats} seat(s) will be immediately restored to Train #${ticket.trainNumber}.
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.85rem; margin-top: 1.5rem;">
              <button type="button" class="btn btn-secondary" onclick="container.innerHTML = ''">Abort Cancellation</button>
              <button type="button" class="btn btn-warning" onclick="executeCancellation(${ticket.pnr})">
                Confirm Cancellation &amp; Process ₹${refund.toFixed(2)} Refund
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      if (container) {
        container.innerHTML = `
          <div class="error-banner" style="margin-top: 1.5rem;">
            No active booking found with PNR ${escapeHtml(pnr)}.
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Cancellation lookup error:', err);
    if (container) {
      container.innerHTML = `<div class="error-banner" style="margin-top: 1.5rem;">Connection error with C++ server.</div>`;
    }
  }
}

// Execute cancellation against C++ backend (POST /api/bookings/cancel)
async function executeCancellation(pnr) {
  const container = document.getElementById('cancelDetailsContainer');

  try {
    const res = await fetch(`${API_BASE}/bookings/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pnr: pnr })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast(`Ticket cancelled! Refund of ₹${data.refundAmount.toFixed(2)} processed.`, 'success');

      if (container) {
        container.innerHTML = `
          <div class="digital-ticket" style="margin-top: 1.75rem; border-color: rgba(16, 185, 129, 0.4);">
            <div style="background: rgba(16, 185, 129, 0.12); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 2rem; text-align: center;">
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 0.75rem;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <h3 style="font-weight: 800; font-size: 1.5rem; color: #FFFFFF;">Cancellation Processed Successfully</h3>
              <p style="font-size: 1rem; margin-top: 0.35rem; color: #CBD5E1;">
                Ticket for <strong>${escapeHtml(data.passengerName)}</strong> (PNR #${data.pnr}) has been cancelled.
              </p>
              <div style="font-size: 1.85rem; font-weight: 800; font-family: var(--font-mono); color: var(--brand-turquoise); margin: 1.25rem 0;">
                Refund Issued: ₹${data.refundAmount.toFixed(2)}
              </div>
              <p style="font-size: 0.85rem; color: #6EE7B7; font-weight: 600;">
                ${data.restoredSeats} seat(s) restored to Train #${data.trainNumber}. Persistence updated in <code>tickets.txt</code>.
              </p>
            </div>
          </div>
        `;
      }

      // Update trains and bookings
      fetchAllTrains();
      fetchAllBookings();
    } else {
      showToast(data.message || 'Cancellation failed.', 'error');
    }
  } catch (err) {
    console.error('Execute cancel error:', err);
    showToast('Failed to cancel ticket. Check backend connection.', 'error');
  }
}

// ===================================================================
// Demonstration Records / All Bookings (GET /api/bookings)
// ===================================================================
async function fetchAllBookings() {
  const tbody = document.getElementById('bookingsTableBody');
  const metricBookings = document.getElementById('metricTotalBookings');
  const metricSeats = document.getElementById('metricTotalSeats');
  const metricRevenue = document.getElementById('metricTotalRevenue');

  try {
    const res = await fetch(`${API_BASE}/bookings`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const bookings = await res.json();
    allBookingsData = bookings;

    // Calculate metrics
    let totalSeats = 0;
    let totalRevenue = 0;
    bookings.forEach(b => {
      totalSeats += b.seats;
      totalRevenue += b.totalFare;
    });

    if (metricBookings) metricBookings.textContent = bookings.length;
    if (metricSeats) metricSeats.textContent = totalSeats;
    if (metricRevenue) metricRevenue.textContent = `₹${totalRevenue.toFixed(2)}`;

    renderBookingsTable(bookings);
  } catch (err) {
    console.error('All bookings fetch error:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--danger-red);">
            Failed to fetch bookings from C++ backend.
          </td>
        </tr>
      `;
    }
  }
}

function renderBookingsTable(bookings) {
  const tbody = document.getElementById('bookingsTableBody');
  const countLabel = document.getElementById('tableFilterCount');
  if (!tbody) return;

  if (countLabel) {
    countLabel.textContent = `Showing ${bookings.length} of ${allBookingsData.length} records`;
  }

  if (bookings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          No bookings recorded yet in <code>tickets.txt</code>. Book a train to see entries appear here!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = bookings.map(b => {
    const isChild = b.isChildDiscount || (b.age < 12);
    return `
      <tr>
        <td><strong style="font-family: var(--font-mono); color: var(--brand-blue); font-size: 1rem;">#${b.pnr}</strong></td>
        <td><strong>${escapeHtml(b.passengerName)}</strong></td>
        <td>${b.age}</td>
        <td>#${b.trainNumber} (${escapeHtml(b.trainName || 'Express')})</td>
        <td><span style="font-weight: 800;">${b.seats}</span></td>
        <td style="font-family: var(--font-mono); font-weight: 800;">₹${Number(b.totalFare).toFixed(2)}</td>
        <td>
          ${isChild ? '<span style="color: #34D399; font-weight: 800; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 8px; border-radius: 4px; font-size: 0.775rem;">50% Off</span>' : '<span style="color: var(--text-light);">No</span>'}
        </td>
        <td>
          <div style="display: flex; gap: 0.45rem;">
            <button class="btn btn-secondary btn-sm" onclick="showTicketModal(${JSON.stringify(b).replace(/"/g, '&quot;')})">Slip</button>
            <button class="btn btn-warning btn-sm" onclick="initiateCancelFromTicket(${b.pnr})">Cancel</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterBookingsTable() {
  const filterInput = document.getElementById('adminTableFilterInput');
  if (!filterInput) return;
  const q = filterInput.value.trim().toLowerCase();

  if (!q) {
    renderBookingsTable(allBookingsData);
    return;
  }

  const filtered = allBookingsData.filter(b => {
    return String(b.pnr).includes(q) ||
           (b.passengerName && b.passengerName.toLowerCase().includes(q)) ||
           String(b.trainNumber).includes(q) ||
           (b.trainName && b.trainName.toLowerCase().includes(q));
  });

  renderBookingsTable(filtered);
}

// ===================================================================
// UI Helpers & Utilities
// ===================================================================
function closeModalOnBackdrop(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
  `;
  if (type === 'success') {
    icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success-green)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  } else if (type === 'error') {
    icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger-red)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else if (type === 'info') {
    icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-cyan)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  toast.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.25s reverse ease-in';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
