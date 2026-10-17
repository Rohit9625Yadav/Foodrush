/**
 * FoodRush - Checkout Page Logic (checkout.js)
 * Form validation, saved address auto-fill, coupon apply/remove at checkout,
 * itemized subtotal/discount/delivery/taxes calculation, and backend order verification.
 */

let selectedDeliveryOption = 'standard'; // 'standard' or 'express'
let selectedPaymentMethod = 'cod'; // 'cod', 'upi', 'card'

document.addEventListener('DOMContentLoaded', () => {
    initCheckoutPage();

    window.addEventListener('foodrush:locationChanged', (e) => {
        prefillAddressFromActiveLocation(e.detail);
        renderCheckoutSummary();
    });
});

function initCheckoutPage() {
    const checkoutForm = document.getElementById('checkout-form');
    if (!checkoutForm) return;

    const cart = typeof getCart === 'function' ? getCart() : [];
    if (cart.length === 0) {
        window.location.href = '/cart/';
        return;
    }

    // Auto-fill user profile & active saved delivery location
    setTimeout(() => {
        prefillUserAndLocation();
    }, 250);

    renderCheckoutSummary();
    initDeliveryOptions();
    initPaymentTabs();
    initFormValidation();
}

function prefillUserAndLocation() {
    if (window.FoodRushAuth && typeof window.FoodRushAuth.getCurrentUser === 'function') {
        const user = window.FoodRushAuth.getCurrentUser();
        if (user) {
            const nameInput = document.getElementById('full-name');
            const emailInput = document.getElementById('email');
            const phoneInput = document.getElementById('phone');
            if (nameInput && !nameInput.value && user.name) nameInput.value = user.name;
            if (emailInput && !emailInput.value && user.email) emailInput.value = user.email;
            if (phoneInput && !phoneInput.value && user.phoneNumber) {
                phoneInput.value = user.phoneNumber.replace(/\D/g, '').slice(-10);
            }
        }
    }

    if (window.FoodRushStore && typeof window.FoodRushStore.getActiveLocation === 'function') {
        const loc = window.FoodRushStore.getActiveLocation();
        if (loc) prefillAddressFromActiveLocation(loc);
    }
}

function prefillAddressFromActiveLocation(loc) {
    if (!loc) return;
    const addrInput = document.getElementById('address');
    const cityInput = document.getElementById('city');
    const stateInput = document.getElementById('state');
    const pinInput = document.getElementById('pincode');

    const fullStreet = [loc.house, loc.street, loc.area, loc.landmark ? `Near ${loc.landmark}` : '']
        .filter(Boolean)
        .join(', ');

    if (addrInput && fullStreet) addrInput.value = fullStreet;
    if (cityInput && loc.city) cityInput.value = loc.city;
    if (stateInput && loc.state) stateInput.value = loc.state;
    if (pinInput && loc.pincode) pinInput.value = loc.pincode;
}

window.renderCheckoutSummary = function () {
    const summaryContainer = document.getElementById('checkout-items-summary');
    if (!summaryContainer) return;

    const cart = getCart();
    const totals = calculateCartTotals();

    let deliveryCost = totals.deliveryFee;
    if (selectedDeliveryOption === 'express') {
        deliveryCost = Number((deliveryCost + 40).toFixed(2));
    }

    const finalGrandTotal = Number(Math.max(0, totals.subtotal + deliveryCost + totals.taxes - (totals.freeDeliveryApplied ? 0 : totals.discount)).toFixed(2));

    summaryContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 class="box-title" style="margin: 0;"><i class="fa-solid fa-basket-shopping"></i> Order Summary (${totals.itemCount})</h3>
            <button type="button" class="btn btn-outline btn-sm" onclick="openLocationModal()" style="font-size: 0.76rem; padding: 4px 10px;">
                <i class="fa-solid fa-location-dot" style="color: var(--primary);"></i> Saved Addresses
            </button>
        </div>

        <div style="max-height: 200px; overflow-y: auto; margin-bottom: 18px; padding-right: 5px;">
            ${cart.map(item => `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 0.9rem;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${item.image}" alt="${item.name}" style="width: 42px; height: 42px; border-radius: 6px; object-fit: cover;">
                        <div>
                            <strong>${item.name}</strong>
                            <div style="color: var(--text-muted); font-size: 0.8rem;">Qty: ${item.quantity} × ₹${item.price}</div>
                        </div>
                    </div>
                    <span style="font-weight: 700;">₹${Number(item.price * item.quantity).toFixed(2)}</span>
                </div>
            `).join('')}
        </div>

        <!-- Coupon Input & Remove in Checkout -->
        <div style="margin-bottom: 16px; padding: 12px; background: #F8FAFC; border-radius: 10px; border: 1px dashed var(--border-color);">
            <label style="font-size: 0.8rem; font-weight: 700; display: block; margin-bottom: 6px;">
                <i class="fa-solid fa-ticket" style="color: var(--primary);"></i> Have a Promo / Coupon Code?
            </label>
            <div style="display: flex; gap: 8px;">
                <input type="text" id="coupon-input-field" class="form-control" placeholder="FOODRUSH20 / FIRST50 / FREEDEL" value="${totals.couponCode}" style="text-transform: uppercase; font-size: 0.85rem;">
                ${totals.hasCoupon ? `
                    <button type="button" class="btn btn-outline btn-sm" onclick="removeAppliedCoupon()" style="color: #DC2626; border-color: #FECACA;">Remove</button>
                ` : `
                    <button type="button" class="btn btn-primary btn-sm" onclick="applyCouponCode()">Apply</button>
                `}
            </div>
            <div id="coupon-feedback-msg" style="font-size: 0.78rem; margin-top: 6px;"></div>
        </div>

        <div class="summary-row">
            <span>Original Subtotal</span>
            <span>₹${totals.subtotal}</span>
        </div>

        <div class="summary-row">
            <span>Delivery Fee (${selectedDeliveryOption === 'express' ? 'Express' : 'Standard'})</span>
            <span>${deliveryCost === 0 ? '<strong style="color: var(--success);">FREE</strong>' : '₹' + deliveryCost}</span>
        </div>

        <div class="summary-row">
            <span>Taxes & Charges (5% GST)</span>
            <span>₹${totals.taxes}</span>
        </div>

        ${totals.hasCoupon ? `
            <div class="summary-row" style="color: var(--success); font-weight: 700;">
                <span>Coupon Discount (${totals.couponCode})</span>
                <span>- ₹${totals.discount}</span>
            </div>
        ` : ''}

        <div class="summary-row total">
            <span>Final Payable Amount</span>
            <span style="color: var(--primary);">₹${finalGrandTotal}</span>
        </div>
    `;
};

function initDeliveryOptions() {
    const radioCards = document.querySelectorAll('.delivery-radio-card');
    radioCards.forEach(card => {
        card.addEventListener('click', () => {
            radioCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const radio = card.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                selectedDeliveryOption = radio.value;
                renderCheckoutSummary();
            }
        });
    });
}

function initPaymentTabs() {
    const tabs = document.querySelectorAll('.payment-tab');
    const panes = document.querySelectorAll('.payment-content-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            selectedPaymentMethod = tab.getAttribute('data-payment');
            const targetPane = document.getElementById(`payment-pane-${selectedPaymentMethod}`);
            if (targetPane) {
                targetPane.classList.add('active');
            }
        });
    });
}

function initFormValidation() {
    const form = document.getElementById('checkout-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        let isValid = true;

        const fields = [
            { id: 'full-name', validate: val => val.trim().length >= 3, msg: 'Please enter your full name (min 3 chars)' },
            { id: 'email', validate: val => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()), msg: 'Please enter a valid email address' },
            { id: 'phone', validate: val => /^[0-9]{10}$/.test(val.trim().replace(/\D/g, '').slice(-10)), msg: 'Please enter a valid 10-digit phone number' },
            { id: 'address', validate: val => val.trim().length >= 6, msg: 'Please enter your complete street address' },
            { id: 'city', validate: val => val.trim().length >= 2, msg: 'Please enter your city' },
            { id: 'state', validate: val => val.trim().length >= 2, msg: 'Please enter your state' },
            { id: 'pincode', validate: val => /^[0-9]{5,6}$/.test(val.trim()), msg: 'Please enter a valid 6-digit PIN code' }
        ];

        if (selectedPaymentMethod === 'card') {
            fields.push(
                { id: 'card-number', validate: val => val.trim().replace(/\s/g, '').length >= 16, msg: 'Enter valid 16-digit card number' },
                { id: 'card-expiry', validate: val => /^(0[1-9]|1[0-2])\/?([0-9]{2})$/.test(val.trim()), msg: 'Enter MM/YY format' },
                { id: 'card-cvv', validate: val => /^[0-9]{3}$/.test(val.trim()), msg: 'Enter 3-digit CVV' }
            );
        } else if (selectedPaymentMethod === 'upi') {
            fields.push(
                { id: 'upi-id', validate: val => val.trim().includes('@'), msg: 'Enter a valid UPI ID (e.g. name@okhdfcbank)' }
            );
        }

        fields.forEach(field => {
            const input = document.getElementById(field.id);
            if (!input) return;

            const val = input.value;
            let errorEl = input.parentElement.querySelector('.error-text');

            if (!field.validate(val)) {
                isValid = false;
                input.classList.add('is-invalid');
                if (!errorEl) {
                    errorEl = document.createElement('span');
                    errorEl.className = 'error-text';
                    input.parentElement.appendChild(errorEl);
                }
                errorEl.textContent = field.msg;
                errorEl.style.display = 'block';
            } else {
                input.classList.remove('is-invalid');
                if (errorEl) errorEl.style.display = 'none';
            }
        });

        if (isValid) {
            handleOrderPlacement();
        } else {
            if (typeof showToast === 'function') {
                showToast('Please fix the highlighted errors in the form', 'danger');
            }
        }
    });
}

async function handleOrderPlacement() {
    if (window.FoodRushAuth && typeof window.FoodRushAuth.requireAuth === 'function') {
        const isAuth = window.FoodRushAuth.requireAuth('place_order', null, () => {
            handleOrderPlacement();
        });
        if (!isAuth) {
            return;
        }
    }

    const submitBtn = document.getElementById('place-order-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validating & Placing Order...';
    }

    const customerName = document.getElementById('full-name')?.value || 'Valued Customer';
    const address = document.getElementById('address')?.value || 'Your delivery address';
    const city = document.getElementById('city')?.value || 'New Delhi';
    const state = document.getElementById('state')?.value || 'Delhi';
    const pincode = document.getElementById('pincode')?.value || '110001';

    const cart = getCart();
    const totals = calculateCartTotals();
    const user = window.FoodRushAuth ? window.FoodRushAuth.getCurrentUser() : null;

    // Save customer address securely in Firebase if signed in
    if (window.FoodRushStore && user && user.uid) {
        try {
            await window.FoodRushStore.saveUserAddress(user.uid, {
                label: 'Home',
                house: address,
                street: '',
                area: city,
                city,
                state,
                pincode
            });
        } catch (e) {}
    }

    let orderId = '#FR' + Math.floor(100000 + Math.random() * 900000);

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user: user,
                cart: cart,
                couponCode: totals.couponCode || null,
                orderDetails: {
                    customerName,
                    address: `${address}, ${city}, ${state} - ${pincode}`,
                    pincode,
                    deliveryOption: selectedDeliveryOption,
                    paymentMethod: selectedPaymentMethod,
                    totals: totals
                }
            })
        });

        const data = await response.json();
        if (data.success && data.orderId) {
            orderId = data.orderId;
        } else if (!data.success && response.status === 401) {
            if (typeof showToast === 'function') {
                showToast(`❌ ${data.message || 'Login required to place orders.'}`, 'danger');
            }
            if (window.FoodRushAuth) {
                window.FoodRushAuth.openGoogleAuthModal('place_order');
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Place Order';
            }
            return;
        } else if (!data.success && response.status === 400) {
            if (typeof showToast === 'function') {
                showToast(`❌ ${data.message}`, 'danger');
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Place Order';
            }
            return;
        }
    } catch (err) {
        console.warn('Backend order sync notice:', err.message);
    }

    // Persist complete customer order to Cloud Firestore & Admin Store
    const orderPayload = {
        orderId: orderId,
        userId: user ? user.uid : 'guest',
        userName: customerName,
        userEmail: user ? (user.email || user.phoneNumber || '') : '',
        phone: document.getElementById('phone')?.value || '',
        items: cart,
        couponCode: totals.couponCode || null,
        details: {
            customerName,
            address: `${address}, ${city}, ${state} - ${pincode}`,
            pincode,
            deliveryOption: selectedDeliveryOption,
            paymentMethod: selectedPaymentMethod,
            totals: totals
        },
        status: 'Placed',
        createdAt: new Date().toISOString()
    };

    if (window.FoodRushStore && typeof window.FoodRushStore.saveOrderToCloud === 'function') {
        try {
            await window.FoodRushStore.saveOrderToCloud(orderPayload);
        } catch(e) {
            console.warn('Order sync to cloud notice:', e);
        }
    }

    // Record coupon usage & first-order completion so single-use/first-order coupons cannot be abused
    if (totals.hasCoupon && window.FoodRushStore && typeof window.FoodRushStore.recordCouponUsage === 'function') {
        try {
            const couponObj = JSON.parse(localStorage.getItem('foodrush_active_coupon_obj') || 'null');
            if (couponObj && couponObj.id) {
                await window.FoodRushStore.recordCouponUsage(couponObj.id, user ? user.uid : 'guest');
            }
        } catch (e) {}
    }

    clearCart();

    showOrderSuccessModal({
        orderId: orderId,
        customerName: customerName,
        address: `${address}, ${city} (${pincode})`,
        deliverySpeed: selectedDeliveryOption === 'express' ? 'Express (20-25 mins)' : 'Standard (35-40 mins)',
        paymentMethod: selectedPaymentMethod.toUpperCase()
    });

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Place Order';
    }
}

function showOrderSuccessModal(details) {
    const modalBackdrop = document.getElementById('order-success-modal');
    if (!modalBackdrop) return;

    const modalOrderId = document.getElementById('modal-order-id-val');
    const modalCustName = document.getElementById('modal-customer-name');
    const modalEstTime = document.getElementById('modal-est-time');

    if (modalOrderId) modalOrderId.textContent = details.orderId;
    if (modalCustName) modalCustName.textContent = details.customerName;
    if (modalEstTime) modalEstTime.textContent = details.deliverySpeed;

    modalBackdrop.classList.add('active');
}

function closeOrderModal() {
    const modalBackdrop = document.getElementById('order-success-modal');
    if (modalBackdrop) modalBackdrop.classList.remove('active');
    window.location.href = '/home/';
}
