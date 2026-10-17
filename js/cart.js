/**
 * FoodRush - Cart Engine & Page Logic (cart.js)
 * Handles localStorage persistence, quantity mutations, dynamic coupon validation,
 * location-based delivery fees, taxes (5% GST), and cart rendering.
 */

const CART_STORAGE_KEY = 'foodrush_cart';
const COUPON_STORAGE_KEY = 'foodrush_active_coupon';
const COUPON_DATA_KEY = 'foodrush_active_coupon_obj';

function getCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    if (typeof updateCartCountBadge === 'function') {
        updateCartCountBadge();
    }
}

function addToCart(productId, quantity = 1, showToastNotification = true) {
    const product = typeof getProductById === 'function' ? getProductById(productId) : null;
    if (!product) {
        console.error('Product not found:', productId);
        return;
    }

    let cart = getCart();
    const existingIndex = cart.findIndex(item => String(item.id) === String(productId));

    if (existingIndex > -1) {
        cart[existingIndex].quantity += quantity;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            image: product.image,
            category: product.category,
            restaurantId: product.restaurantId || null,
            restaurantName: product.restaurantName || null,
            quantity: quantity
        });
    }

    saveCart(cart);

    if (showToastNotification && typeof showToast === 'function') {
        showToast(`🍔 ${product.name} added to cart!`, 'primary');
    }
}

function updateItemQuantity(productId, delta) {
    let cart = getCart();
    const itemIndex = cart.findIndex(item => String(item.id) === String(productId));

    if (itemIndex > -1) {
        cart[itemIndex].quantity += delta;
        if (cart[itemIndex].quantity <= 0) {
            cart.splice(itemIndex, 1);
            if (typeof showToast === 'function') {
                showToast('Item removed from cart', 'warning');
            }
        }
        saveCart(cart);
        renderCartPage();
    }
}

function removeFromCart(productId) {
    let cart = getCart();
    const product = cart.find(item => String(item.id) === String(productId));
    cart = cart.filter(item => String(item.id) !== String(productId));
    saveCart(cart);

    if (typeof showToast === 'function' && product) {
        showToast(`Removed ${product.name} from cart`, 'warning');
    }

    renderCartPage();
}

function clearCart() {
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(COUPON_STORAGE_KEY);
    localStorage.removeItem(COUPON_DATA_KEY);
    localStorage.removeItem('foodrush_cart_restaurant');
    if (typeof updateCartCountBadge === 'function') {
        updateCartCountBadge();
    }
}

/**
 * Calculate Subtotal, Discount, Location/Restaurant Delivery Fee, Taxes (5% GST), and Final Payable Amount
 */
function calculateCartTotals() {
    const cart = getCart();
    const subtotal = Number(cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0).toFixed(2));

    // Determine base delivery fee from active restaurant or standard rule
    let baseDeliveryFee = 40;
    let freeThreshold = 500;
    try {
        const restMeta = JSON.parse(localStorage.getItem('foodrush_cart_restaurant') || 'null');
        if (restMeta && typeof restMeta.deliveryFee === 'number') {
            baseDeliveryFee = restMeta.deliveryFee;
            freeThreshold = restMeta.freeDeliveryAbove || 500;
        }
    } catch (e) {}

    let deliveryFee = subtotal > 0 ? (subtotal >= freeThreshold ? 0 : baseDeliveryFee) : 0;

    // Evaluate active coupon
    const couponCode = localStorage.getItem(COUPON_STORAGE_KEY) || '';
    let couponObj = null;
    try {
        couponObj = JSON.parse(localStorage.getItem(COUPON_DATA_KEY) || 'null');
    } catch (e) {}

    let discount = 0;
    let freeDeliveryApplied = false;

    if (couponCode && subtotal > 0) {
        if (couponObj && couponObj.code === couponCode) {
            const minOrder = Number(couponObj.minOrderAmount || 0);
            if (subtotal >= minOrder) {
                if (couponObj.discountType === 'percentage') {
                    discount = Number(((subtotal * Number(couponObj.discountValue)) / 100).toFixed(2));
                    if (couponObj.maxDiscount && discount > Number(couponObj.maxDiscount)) {
                        discount = Number(couponObj.maxDiscount);
                    }
                } else if (couponObj.discountType === 'flat' || couponObj.discountType === 'first_order') {
                    discount = Math.min(subtotal, Number(couponObj.discountValue));
                } else if (couponObj.discountType === 'free_delivery') {
                    freeDeliveryApplied = true;
                    discount = deliveryFee;
                    deliveryFee = 0;
                }
            }
        } else if (couponCode === 'FOODRUSH20' || couponCode === 'SAVE20') {
            discount = Math.round(subtotal * 0.20);
        }
    }

    const taxableAmount = Math.max(0, subtotal - (freeDeliveryApplied ? 0 : discount));
    const taxes = subtotal > 0 ? Number((taxableAmount * 0.05).toFixed(2)) : 0; // 5% GST
    const total = Number(Math.max(0, subtotal + deliveryFee + taxes - (freeDeliveryApplied ? 0 : discount)).toFixed(2));

    return {
        subtotal,
        deliveryFee,
        taxes,
        discount,
        freeDeliveryApplied,
        total,
        itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
        hasCoupon: Boolean(couponCode && (discount > 0 || freeDeliveryApplied)),
        couponCode: couponCode || ''
    };
}

function renderCartPage() {
    const cartContainer = document.getElementById('cart-items-container');
    const summaryContainer = document.getElementById('cart-summary-container');
    const emptyState = document.getElementById('cart-empty-state');
    const cartLayout = document.getElementById('cart-content-layout');

    if (!cartContainer || !summaryContainer) return;

    const cart = getCart();
    const totals = calculateCartTotals();

    if (cart.length === 0) {
        if (cartLayout) cartLayout.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (cartLayout) cartLayout.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';

    cartContainer.innerHTML = `
        <table class="cart-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Subtotal</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${cart.map(item => `
                    <tr class="cart-item-row">
                        <td class="cart-col-product">
                            <div class="cart-product-cell">
                                <img src="${item.image}" alt="${item.name}" class="cart-product-img">
                                <div class="cart-product-info">
                                    <h4 class="cart-product-name"><a href="/food-details/?id=${item.id}">${item.name}</a></h4>
                                    <span class="cart-product-price">₹${item.price} each</span>
                                </div>
                            </div>
                        </td>
                        <td class="cart-col-price">₹${item.price}</td>
                        <td class="cart-col-qty">
                            <div class="qty-control">
                                <button type="button" class="qty-btn" onclick="updateItemQuantity('${item.id}', -1)">-</button>
                                <span class="qty-input">${item.quantity}</span>
                                <button type="button" class="qty-btn" onclick="updateItemQuantity('${item.id}', 1)">+</button>
                            </div>
                        </td>
                        <td class="cart-col-subtotal">
                            <span class="mobile-subtotal-label">Total:</span>
                            <strong>₹${Number(item.price * item.quantity).toFixed(2)}</strong>
                        </td>
                        <td class="cart-col-remove">
                            <button type="button" class="cart-remove-btn" onclick="removeFromCart('${item.id}')" title="Remove item">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="cart-actions-bar">
            <div class="cart-continue-btns">
                <a href="/restaurants/" class="btn btn-outline btn-sm">
                    <i class="fa-solid fa-store"></i> Browse Restaurants
                </a>
                <a href="/menu/" class="btn btn-outline btn-sm">
                    <i class="fa-solid fa-utensils"></i> Full Menu
                </a>
            </div>
            <button type="button" class="btn btn-outline btn-sm cart-clear-btn" onclick="handleClearCartAction()">
                <i class="fa-regular fa-trash-can"></i> Clear Cart
            </button>
        </div>
    `;

    summaryContainer.innerHTML = `
        <h3 class="box-title" style="margin-bottom: 20px;">
            <i class="fa-solid fa-receipt"></i> Order Bill Summary
        </h3>

        <div class="summary-row">
            <span>Original Subtotal (${totals.itemCount} items)</span>
            <span>₹${totals.subtotal}</span>
        </div>

        <div class="summary-row">
            <span>Delivery Fee</span>
            <span>${totals.deliveryFee === 0 ? '<strong style="color: var(--success);">FREE</strong>' : '₹' + totals.deliveryFee}</span>
        </div>

        <div class="summary-row">
            <span>Taxes & Charges (5% GST)</span>
            <span>₹${totals.taxes}</span>
        </div>

        ${totals.hasCoupon ? `
            <div class="summary-row" style="color: var(--success); font-weight: 700; background: #ECFDF5; padding: 8px 10px; border-radius: 8px;">
                <span><i class="fa-solid fa-tag"></i> Coupon (${totals.couponCode})</span>
                <span>
                    - ₹${totals.discount}
                    <button type="button" onclick="removeAppliedCoupon()" style="background:none; border:none; color:#DC2626; font-weight:700; cursor:pointer; margin-left:6px;" title="Remove Coupon">✕</button>
                </span>
            </div>
        ` : ''}

        <div class="coupon-box" style="margin-top: 14px;">
            <input type="text" id="coupon-input-field" class="coupon-input" placeholder="Enter coupon code (e.g. FOODRUSH20)" value="${totals.couponCode}" style="text-transform: uppercase;">
            ${totals.hasCoupon ? `
                <button type="button" class="btn btn-outline btn-sm" onclick="removeAppliedCoupon()" style="color: #DC2626; border-color: #FECACA;">Remove</button>
            ` : `
                <button type="button" class="btn btn-secondary btn-sm" onclick="applyCouponCode()">Apply</button>
            `}
        </div>
        <div id="coupon-feedback-msg" style="font-size: 0.8rem; margin-top: 6px;"></div>

        <div class="summary-row total" style="margin-top: 16px;">
            <span>Final Payable Amount</span>
            <span style="color: var(--primary);">₹${totals.total}</span>
        </div>

        <button type="button" class="btn btn-primary btn-block btn-lg" style="margin-top: 24px;" onclick="handleProceedToCheckout()">
            Proceed to Checkout <i class="fa-solid fa-arrow-right"></i>
        </button>
    `;
}

function handleProceedToCheckout() {
    const cart = getCart();
    if (cart.length === 0) {
        if (typeof showToast === 'function') {
            showToast('Your cart is empty!', 'warning');
        }
        return;
    }

    if (window.FoodRushAuth && typeof window.FoodRushAuth.requireAuth === 'function') {
        const isAuth = window.FoodRushAuth.requireAuth('proceed_to_checkout', null, () => {
            window.location.href = '/checkout/';
        });
        if (isAuth) {
            window.location.href = '/checkout/';
        }
    } else {
        window.location.href = '/checkout/';
    }
}

async function applyCouponCode() {
    const input = document.getElementById('coupon-input-field');
    const feedbackEl = document.getElementById('coupon-feedback-msg');
    if (!input) return;

    const code = input.value.trim().toUpperCase();
    if (!code) {
        if (typeof showToast === 'function') showToast('Please enter a coupon code', 'warning');
        return;
    }

    const cart = getCart();
    const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    let restId = 'ALL';
    try {
        const restMeta = JSON.parse(localStorage.getItem('foodrush_cart_restaurant') || 'null');
        if (restMeta && restMeta.id) restId = restMeta.id;
    } catch (e) {}

    const user = window.FoodRushAuth ? window.FoodRushAuth.getCurrentUser() : null;

    // 1. Validate via FoodRushStore (Firestore + local rules)
    if (window.FoodRushStore && typeof window.FoodRushStore.validateCouponForOrder === 'function') {
        const result = await window.FoodRushStore.validateCouponForOrder({
            code,
            subtotal,
            restaurantId: restId,
            deliveryFee: 40,
            userUid: user ? user.uid : 'guest'
        });

        if (!result.valid) {
            if (feedbackEl) {
                feedbackEl.style.color = '#DC2626';
                feedbackEl.textContent = result.message;
            }
            if (typeof showToast === 'function') showToast(`❌ ${result.message}`, 'warning');
            return;
        }

        localStorage.setItem(COUPON_STORAGE_KEY, result.offer.code);
        localStorage.setItem(COUPON_DATA_KEY, JSON.stringify(result.offer));

        if (typeof showToast === 'function') {
            showToast(result.message, 'primary');
        }
        renderCartPage();
        if (typeof window.renderCheckoutSummary === 'function') {
            window.renderCheckoutSummary();
        }
        return;
    }

    // Fallback if store-data.js hasn't loaded yet
    if (code === 'FOODRUSH20' || code === 'SAVE20') {
        localStorage.setItem(COUPON_STORAGE_KEY, code);
        if (typeof showToast === 'function') showToast('🎉 20% Discount coupon applied!', 'primary');
        renderCartPage();
    } else {
        if (typeof showToast === 'function') showToast('Invalid promo code. Try "FOODRUSH20"', 'warning');
    }
}

window.removeAppliedCoupon = function () {
    localStorage.removeItem(COUPON_STORAGE_KEY);
    localStorage.removeItem(COUPON_DATA_KEY);
    if (typeof showToast === 'function') {
        showToast('Coupon removed from your order.', 'info');
    }
    renderCartPage();
    if (typeof window.renderCheckoutSummary === 'function') {
        window.renderCheckoutSummary();
    }
};

function handleClearCartAction() {
    if (confirm('Are you sure you want to clear your cart?')) {
        clearCart();
        renderCartPage();
        if (typeof showToast === 'function') {
            showToast('Cart cleared', 'warning');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Check if user copied a coupon from homepage/restaurants page
    const pendingCoupon = localStorage.getItem('foodrush_pending_coupon');
    if (pendingCoupon && !localStorage.getItem(COUPON_STORAGE_KEY)) {
        const input = document.getElementById('coupon-input-field');
        if (input) input.value = pendingCoupon;
    }

    if (document.getElementById('cart-items-container')) {
        renderCartPage();
    }
});
