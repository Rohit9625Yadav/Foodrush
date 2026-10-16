/**
 * FoodRush - Location Selector & Saved Addresses UI Controller (location-ui.js)
 * 
 * Implements:
 * - "Enter your location" button injected into the website header
 * - Interactive Location Modal with:
 *   1. Browser Geolocation ("Use My Current Location" via navigator.geolocation + OpenStreetMap Nominatim / Google Geocoding)
 *   2. Search by Area, Street, City, or PIN Code
 *   3. Saved Addresses (Home, Work, Other) with complete form (House/Flat, Street, Area, Landmark, City, State, PIN Code)
 * - Dispatches real-time location updates to filter restaurants & recalculate delivery fees
 */

document.addEventListener('DOMContentLoaded', () => {
    initHeaderLocationWidget();
    createLocationModalDOM();
});

function initHeaderLocationWidget() {
    const navbars = document.querySelectorAll('.navbar');
    if (!navbars.length) return;

    navbars.forEach(navbar => {
        if (navbar.querySelector('.header-location-pill')) return;

        const logo = navbar.querySelector('.logo');
        if (!logo) return;

        const locPill = document.createElement('button');
        locPill.type = 'button';
        locPill.className = 'header-location-pill';
        locPill.setAttribute('aria-label', 'Select Delivery Location');
        locPill.onclick = () => openLocationModal();

        updateHeaderLocationLabel(locPill);

        // Insert right after logo
        logo.insertAdjacentElement('afterend', locPill);
    });

    window.addEventListener('foodrush:locationChanged', () => {
        document.querySelectorAll('.header-location-pill').forEach(pill => {
            updateHeaderLocationLabel(pill);
        });
    });
}

function updateHeaderLocationLabel(pillEl) {
    let loc = null;
    try {
        loc = JSON.parse(localStorage.getItem('foodrush_delivery_location'));
    } catch (e) {}

    if (loc && (loc.area || loc.city || loc.pincode)) {
        const tag = loc.label ? `<strong>${loc.label}</strong> &bull; ` : '';
        const text = `${loc.area ? loc.area + ', ' : ''}${loc.city || ''} ${loc.pincode || ''}`.trim();
        pillEl.innerHTML = `
            <i class="fa-solid fa-location-dot" style="color: var(--primary); font-size: 1rem;"></i>
            <div class="loc-pill-text">
                <span class="loc-pill-top">Deliver to</span>
                <span class="loc-pill-main">${tag}${text.slice(0, 26)}${text.length > 26 ? '...' : ''} <i class="fa-solid fa-chevron-down" style="font-size: 0.7rem; margin-left: 3px;"></i></span>
            </div>
        `;
    } else {
        pillEl.innerHTML = `
            <i class="fa-solid fa-location-dot" style="color: var(--primary); font-size: 1rem;"></i>
            <div class="loc-pill-text">
                <span class="loc-pill-top">Delivery Location</span>
                <span class="loc-pill-main">Enter your location <i class="fa-solid fa-chevron-down" style="font-size: 0.7rem; margin-left: 3px;"></i></span>
            </div>
        `;
    }
}

export function openLocationModal() {
    let modal = document.getElementById('foodrush-location-modal');
    if (!modal) {
        createLocationModalDOM();
        modal = document.getElementById('foodrush-location-modal');
    }
    renderSavedAddressesList();
    modal.classList.add('active');
}

export function closeLocationModal() {
    const modal = document.getElementById('foodrush-location-modal');
    if (modal) modal.classList.remove('active');
}

function createLocationModalDOM() {
    if (document.getElementById('foodrush-location-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'foodrush-location-modal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
        <div class="location-modal-card">
            <div class="location-modal-header">
                <div>
                    <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 2px;">
                        <i class="fa-solid fa-map-location-dot" style="color: var(--primary);"></i> Choose Delivery Location
                    </h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;">
                        Select your address to see restaurants & accurate delivery times in your area
                    </p>
                </div>
                <button type="button" class="location-modal-close" id="close-loc-modal-btn">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div class="location-modal-body">
                <!-- Current GPS Location Trigger -->
                <button type="button" class="gps-detect-btn" id="detect-gps-location-btn">
                    <div class="gps-icon-circle">
                        <i class="fa-solid fa-location-crosshairs"></i>
                    </div>
                    <div style="text-align: left; flex: 1;">
                        <strong style="display: block; color: var(--primary); font-size: 0.95rem;">Use My Current Location</strong>
                        <span id="gps-status-subtext" style="font-size: 0.8rem; color: var(--text-muted);">Using browser Geolocation permission</span>
                    </div>
                    <i class="fa-solid fa-angle-right" style="color: var(--text-muted);"></i>
                </button>

                <!-- Quick PIN Code / Area Search -->
                <div class="loc-search-bar">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="quick-loc-search-input" placeholder="Enter PIN code (e.g. 110001) or Area / City...">
                    <button type="button" class="btn btn-primary btn-sm" id="apply-quick-loc-btn">Check</button>
                </div>

                <!-- Saved Addresses Section -->
                <div id="saved-addresses-wrapper" style="margin-top: 18px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin: 0;">
                            Saved Addresses
                        </h4>
                        <button type="button" class="btn-text-link" id="toggle-new-addr-form-btn">
                            <i class="fa-solid fa-plus"></i> Add New Address
                        </button>
                    </div>
                    <div id="saved-addresses-list" class="saved-addresses-list"></div>
                </div>

                <!-- Add New Address Full Form -->
                <form id="add-new-address-form" class="new-address-form" style="display: none; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                    <h4 style="font-size: 1rem; margin-bottom: 12px;">Add Complete Delivery Address</h4>
                    
                    <!-- Address Tag (Home / Work / Other) -->
                    <div class="addr-tag-selector" style="display: flex; gap: 10px; margin-bottom: 14px;">
                        <label class="addr-tag-pill active">
                            <input type="radio" name="addr_label" value="Home" checked style="display:none;">
                            <i class="fa-solid fa-house"></i> Home
                        </label>
                        <label class="addr-tag-pill">
                            <input type="radio" name="addr_label" value="Work" style="display:none;">
                            <i class="fa-solid fa-briefcase"></i> Work
                        </label>
                        <label class="addr-tag-pill">
                            <input type="radio" name="addr_label" value="Other" style="display:none;">
                            <i class="fa-solid fa-location-dot"></i> Other
                        </label>
                    </div>

                    <div class="form-grid-2">
                        <div class="form-group">
                            <label class="form-label">House / Flat / Floor No. *</label>
                            <input type="text" id="addr-house" class="form-control" placeholder="e.g. Flat 302, Tower B" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Street / Society *</label>
                            <input type="text" id="addr-street" class="form-control" placeholder="e.g. MG Road" required>
                        </div>
                    </div>

                    <div class="form-grid-2" style="margin-top: 10px;">
                        <div class="form-group">
                            <label class="form-label">Area / Locality *</label>
                            <input type="text" id="addr-area" class="form-control" placeholder="e.g. Connaught Place" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Landmark (Optional)</label>
                            <input type="text" id="addr-landmark" class="form-control" placeholder="e.g. Near Metro Gate 2">
                        </div>
                    </div>

                    <div class="form-grid-3" style="margin-top: 10px;">
                        <div class="form-group">
                            <label class="form-label">City *</label>
                            <input type="text" id="addr-city" class="form-control" placeholder="New Delhi" value="New Delhi" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">State *</label>
                            <input type="text" id="addr-state" class="form-control" placeholder="Delhi" value="Delhi" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">PIN Code *</label>
                            <input type="text" id="addr-pincode" class="form-control" placeholder="110001" maxlength="6" required>
                        </div>
                    </div>

                    <div style="display: flex; gap: 10px; margin-top: 16px;">
                        <button type="button" class="btn btn-outline btn-sm" id="cancel-new-addr-btn" style="flex: 1;">Cancel</button>
                        <button type="submit" class="btn btn-primary btn-sm" style="flex: 2;">
                            <i class="fa-solid fa-check"></i> Save & Deliver Here
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event bindings
    document.getElementById('close-loc-modal-btn')?.addEventListener('click', closeLocationModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeLocationModal();
    });

    // Tag radio pills
    const tagPills = modal.querySelectorAll('.addr-tag-pill');
    tagPills.forEach(pill => {
        pill.addEventListener('click', () => {
            tagPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const radio = pill.querySelector('input');
            if (radio) radio.checked = true;
        });
    });

    // Toggle new address form
    const newAddrForm = document.getElementById('add-new-address-form');
    document.getElementById('toggle-new-addr-form-btn')?.addEventListener('click', () => {
        newAddrForm.style.display = newAddrForm.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('cancel-new-addr-btn')?.addEventListener('click', () => {
        newAddrForm.style.display = 'none';
    });

    // Quick PIN/Area search
    document.getElementById('apply-quick-loc-btn')?.addEventListener('click', handleQuickLocationApply);
    document.getElementById('quick-loc-search-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleQuickLocationApply();
        }
    });

    // Browser Geolocation
    document.getElementById('detect-gps-location-btn')?.addEventListener('click', handleBrowserGeolocation);

    // Save complete address
    newAddrForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const label = modal.querySelector('input[name="addr_label"]:checked')?.value || 'Home';
        const house = document.getElementById('addr-house').value.trim();
        const street = document.getElementById('addr-street').value.trim();
        const area = document.getElementById('addr-area').value.trim();
        const landmark = document.getElementById('addr-landmark').value.trim();
        const city = document.getElementById('addr-city').value.trim();
        const state = document.getElementById('addr-state').value.trim();
        const pincode = document.getElementById('addr-pincode').value.trim();

        if (!/^[0-9]{6}$/.test(pincode)) {
            if (typeof showToast === 'function') showToast('Please enter a valid 6-digit PIN code', 'warning');
            return;
        }

        const addressObj = {
            label,
            house,
            street,
            area,
            landmark,
            city,
            state,
            pincode,
            fullAddress: `${house}, ${street}, ${area}${landmark ? ', Near ' + landmark : ''}, ${city}, ${state} - ${pincode}`
        };

        if (window.FoodRushStore) {
            await window.FoodRushStore.saveCustomerAddress(addressObj);
        }
        newAddrForm.reset();
        newAddrForm.style.display = 'none';
        renderSavedAddressesList();
        closeLocationModal();
        if (typeof showToast === 'function') {
            showToast(`📍 Delivery location set to ${label} (${area}, ${pincode})`, 'primary');
        }
    });
}

function handleQuickLocationApply() {
    const input = document.getElementById('quick-loc-search-input');
    if (!input || !input.value.trim()) return;

    const val = input.value.trim();
    const pinMatch = val.match(/\b\d{6}\b/);
    const pincode = pinMatch ? pinMatch[0] : (/^\d{6}$/.test(val) ? val : '110001');
    const area = val.replace(/\b\d{6}\b/, '').replace(/,/g, '').trim() || 'Central Zone';

    const locObj = {
        label: 'Selected Area',
        area: area,
        city: 'New Delhi',
        pincode: pincode,
        fullAddress: `${area}, PIN: ${pincode}`
    };

    if (window.FoodRushStore) {
        window.FoodRushStore.setActiveDeliveryLocation(locObj);
    } else {
        localStorage.setItem('foodrush_delivery_location', JSON.stringify(locObj));
    }

    closeLocationModal();
    if (typeof showToast === 'function') {
        showToast(`📍 Showing restaurants delivering to ${area} (${pincode})`, 'primary');
    }
}

function handleBrowserGeolocation() {
    const subtext = document.getElementById('gps-status-subtext');
    if (!navigator.geolocation) {
        if (typeof showToast === 'function') {
            showToast('Geolocation is not supported by your browser.', 'danger');
        }
        return;
    }

    if (subtext) subtext.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Requesting GPS permission...';

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            let area = 'Current GPS Location';
            let city = '';
            let state = '';
            let pincode = '110001';

            // Reverse geocode using OpenStreetMap Nominatim (free, real reverse geocoding without exposing private keys)
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                const data = await res.json();
                if (data && data.address) {
                    area = data.address.suburb || data.address.neighbourhood || data.address.road || 'Detected Area';
                    city = data.address.city || data.address.state_district || data.address.town || '';
                    state = data.address.state || '';
                    pincode = data.address.postcode || '110001';
                }
            } catch (e) {
                console.warn('Reverse geocoding fallback:', e.message);
            }

            const locObj = {
                label: 'Current Location',
                area,
                city,
                state,
                pincode,
                lat,
                lng,
                fullAddress: `${area}${city ? ', ' + city : ''} (${lat.toFixed(4)}, ${lng.toFixed(4)})`
            };

            if (window.FoodRushStore) {
                window.FoodRushStore.setActiveDeliveryLocation(locObj);
            }
            if (subtext) subtext.textContent = `Detected: ${area} (${pincode})`;
            closeLocationModal();

            if (typeof showToast === 'function') {
                showToast(`📍 GPS Location set: ${area} ${pincode}`, 'primary');
            }
        },
        (error) => {
            let msg = 'Location permission denied. Please enter your PIN code or address manually.';
            if (error.code === error.TIMEOUT) msg = 'GPS request timed out. Please enter address manually.';
            if (subtext) subtext.textContent = msg;
            if (typeof showToast === 'function') {
                showToast(`⚠️ ${msg}`, 'warning');
            }
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function renderSavedAddressesList() {
    const container = document.getElementById('saved-addresses-list');
    if (!container) return;

    const addresses = window.FoodRushStore ? window.FoodRushStore.getSavedAddresses() : [];
    const activeLoc = window.FoodRushStore ? window.FoodRushStore.getActiveDeliveryLocation() : null;

    if (addresses.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 16px; background: #F8FAFC; border-radius: 8px; color: var(--text-muted); font-size: 0.85rem;">
                No saved addresses yet. Click <strong>"+ Add New Address"</strong> above to save Home or Work!
            </div>
        `;
        return;
    }

    container.innerHTML = addresses.map(addr => {
        const isSelected = activeLoc && activeLoc.id === addr.id;
        const icon = addr.label === 'Home' ? 'fa-house' : (addr.label === 'Work' ? 'fa-briefcase' : 'fa-location-dot');
        return `
            <div class="saved-addr-card ${isSelected ? 'selected' : ''}" data-addr-id="${addr.id}">
                <div class="saved-addr-icon">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="saved-addr-info" onclick="selectSavedAddressById('${addr.id}')">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <strong>${addr.label}</strong>
                        <span class="badge badge-light" style="font-size: 0.7rem;">PIN: ${addr.pincode}</span>
                        ${isSelected ? '<span class="badge badge-primary" style="font-size:0.68rem;">Active</span>' : ''}
                    </div>
                    <p style="font-size: 0.82rem; color: var(--text-muted); margin: 3px 0 0;">
                        ${addr.house}, ${addr.street}, ${addr.area}, ${addr.city} - ${addr.pincode}
                    </p>
                </div>
                <button type="button" class="saved-addr-del" onclick="removeSavedAddressById('${addr.id}')" title="Delete Address">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </div>
        `;
    }).join('');
}

window.selectSavedAddressById = function(addrId) {
    if (!window.FoodRushStore) return;
    const addresses = window.FoodRushStore.getSavedAddresses();
    const found = addresses.find(a => a.id === addrId);
    if (found) {
        window.FoodRushStore.setActiveDeliveryLocation(found);
        closeLocationModal();
        if (typeof showToast === 'function') {
            showToast(`📍 Delivering to ${found.label}: ${found.area} (${found.pincode})`, 'primary');
        }
    }
};

window.removeSavedAddressById = function(addrId) {
    if (!window.FoodRushStore) return;
    window.FoodRushStore.deleteSavedAddress(addrId);
    renderSavedAddressesList();
};

window.openLocationModal = openLocationModal;
window.closeLocationModal = closeLocationModal;
