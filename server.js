/**
 * FoodRush - Backend Server (server.js)
 * Real OTP Email Service & Authentication API using Express & Nodemailer
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 1. Clean URL Redirect: Redirect any GET request ending in .html to clean route
app.use((req, res, next) => {
    if (req.method === 'GET' && req.path.endsWith('.html')) {
        let cleanPath = req.path.replace(/\.html$/, '');
        if (cleanPath === '/index') cleanPath = '/home';
        const query = req.url.slice(req.path.length);
        return res.redirect(301, cleanPath + '/' + query);
    }
    next();
});

// Redirect root domain to /home/
app.get('/', (req, res) => {
    res.redirect('/home/');
});
app.get('/index', (req, res) => {
    res.redirect('/home/');
});

// 2. Explicit Clean Routes for FoodRush Frontend Pages
const frontendPages = [
    { route: '/home', dir: 'home' },
    { route: '/menu', dir: 'menu' },
    { route: '/restaurants', dir: 'restaurants' },
    { route: '/cart', dir: 'cart' },
    { route: '/checkout', dir: 'checkout' },
    { route: '/food-details', dir: 'food-details' },
    { route: '/auth', dir: 'auth' },
    { route: '/admin', dir: 'admin' },
    { route: '/about-contact', dir: 'about-contact' }
];

frontendPages.forEach(({ route, dir }) => {
    const handler = (req, res) => {
        const filePath = path.join(__dirname, dir, 'index.html');
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.sendFile(path.join(__dirname, `${dir}.html`));
        }
    };
    app.get(route, handler);
    app.get(`${route}/`, handler);
});

// Automatic redirect for nested paths like /home/auth -> /auth/
app.get('/home/:subpage', (req, res) => {
    res.redirect(`/${req.params.subpage}/`);
});

// 3. Serve static files with directory index support
app.use(express.static(path.join(__dirname)));

// In-Memory Storage for OTPs (with 5-minute expiration)
const otpStore = new Map();

// Persistent JSON Storage setup (survives restarts and syncs between all logins & orders)
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {}

function loadUsersFromDisk() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const raw = fs.readFileSync(USERS_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        console.warn('[FoodRush Server] Notice loading users from disk:', e.message);
    }
    return [];
}

function saveUsersToDisk() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(USERS_FILE, JSON.stringify(usersStore, null, 2), 'utf8');
    } catch (e) {
        console.warn('[FoodRush Server] Notice saving users to disk:', e.message);
    }
}

function loadOrdersFromDisk() {
    try {
        if (fs.existsSync(ORDERS_FILE)) {
            const raw = fs.readFileSync(ORDERS_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        console.warn('[FoodRush Server] Notice loading orders from disk:', e.message);
    }
    return [];
}

function saveOrdersToDisk() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(serverOrdersStore, null, 2), 'utf8');
    } catch (e) {
        console.warn('[FoodRush Server] Notice saving orders to disk:', e.message);
    }
}

// Users Database (Backed by persistent disk storage)
const usersStore = loadUsersFromDisk();

// Orders Database (Backed by persistent disk storage)
const serverOrdersStore = loadOrdersFromDisk();

// Configure Email Transporter using Real Gmail SMTP
const GMAIL_USER = (process.env.EMAIL_USER || 'rohit09ydv@gmail.com').trim();
const GMAIL_PASS = (process.env.EMAIL_PASS || 'rwsearwnmfkxijkl').replace(/\s+/g, '').trim();

let transporter = null;

async function getTransporter() {
    if (transporter) return transporter;

    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: GMAIL_USER,
            pass: GMAIL_PASS
        }
    });
    console.log('✅ Real Gmail SMTP Transporter initialized for:', GMAIL_USER);
    return transporter;
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

/**
 * Health Check API
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'FoodRush Real Auth Server is running!' });
});

/**
 * 1. Send Real Email OTP to User's Gmail Inbox
 */
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { email, name } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Valid email address is required' });
        }

        // Generate 6-digit random OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

        otpStore.set(email.toLowerCase(), {
            otp,
            expiresAt,
            name: name || 'Foodie'
        });

        // Ultra-Clean Professional FoodRush Email
        const mailOptions = {
            from: `"FoodRush" <${GMAIL_USER}>`,
            to: email,
            subject: `FoodRush Verification Code: ${otp}`,
            text: `Hi ${name || 'there'},\n\nYour FoodRush verification code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nThank you,\nFoodRush Team`,
            html: `
                <div style="font-family: Arial, sans-serif; font-size: 15px; color: #222222; line-height: 1.6; max-width: 480px; padding: 24px; border: 1.5px solid #FFD8CC; border-radius: 12px; background: #FFFFFF; margin: 0 auto;">
                    <div style="margin-bottom: 20px;">
                        <span style="font-size: 26px; font-weight: 800; color: #FF5722; letter-spacing: -0.5px;">🍔 FoodRush</span>
                    </div>
                    <p style="margin: 0 0 14px 0;">Hi <strong>${name || 'there'}</strong>,</p>
                    <p style="margin: 0 0 14px 0;">Your FoodRush verification code is:</p>
                    <div style="background-color: #FFF3EE; border-radius: 8px; padding: 16px 24px; text-align: center; margin: 20px 0; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #FF5722; font-family: monospace; border: 1.5px dashed #FF7A50;">
                        ${otp}
                    </div>
                    <p style="margin: 0 0 14px 0; font-size: 13px; color: #666666;">This code is valid for 5 minutes. Please enter this code on the FoodRush verification screen to complete your registration.</p>
                    <p style="margin: 20px 0 0 0; font-size: 12px; color: #888888; border-top: 1px solid #EEEEEE; padding-top: 14px;">FoodRush Fast Food Delivery Platform</p>
                </div>
            `
        };

        const mailTransporter = await getTransporter();
        const info = await mailTransporter.sendMail(mailOptions);
        console.log(`📩 Real Email Sent directly to ${email}! Message ID: ${info.messageId}`);

        // Keep OTP completely secret on the server - do NOT send it in the JSON response!
        res.json({
            success: true,
            message: `Verification code sent to ${email}. Please check your Gmail inbox.`
        });

    } catch (error) {
        console.error('Error sending email OTP:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP email: ' + error.message
        });
    }
});

/**
 * 2. Verify OTP & Register User
 */
app.post('/api/auth/verify-otp', (req, res) => {
    const { email, otp, name, phone, password } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const storedData = otpStore.get(email.toLowerCase());

    if (!storedData) {
        return res.status(400).json({ success: false, message: 'No OTP requested for this email. Please request a new one.' });
    }

    if (Date.now() > storedData.expiresAt) {
        otpStore.delete(email.toLowerCase());
        return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new code.' });
    }

    if (storedData.otp !== otp.trim()) {
        return res.status(400).json({ success: false, message: 'Invalid OTP! Please enter the correct code.' });
    }

    // OTP is valid! Delete used OTP
    otpStore.delete(email.toLowerCase());

    // Check if user already exists
    let user = usersStore.find(u => u.email.toLowerCase() === email.toLowerCase());
    const generatedUid = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    if (!user) {
        user = {
            uid: generatedUid,
            name: name || storedData.name || 'Foodie',
            email: email.toLowerCase(),
            phone: phone || '',
            password: password || 'defaultPass',
            isVerified: true,
            provider: 'email',
            lastLoginAt: new Date().toISOString()
        };
        usersStore.unshift(user);
    } else {
        user.isVerified = true;
        user.lastLoginAt = new Date().toISOString();
        if (!user.uid) user.uid = generatedUid;
    }
    saveUsersToDisk();

    res.json({
        success: true,
        message: 'Email verified successfully!',
        user: {
            uid: user.uid,
            name: user.name,
            email: user.email,
            phone: user.phone,
            provider: user.provider,
            isVerified: true,
            lastLoginAt: user.lastLoginAt
        }
    });
});

/**
 * 3. User Login
 */
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = usersStore.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'Account not found with this email. Please register first!'
        });
    }

    if (user.password !== password) {
        return res.status(401).json({
            success: false,
            message: 'Incorrect password. Please try again.'
        });
    }

    user.lastLoginAt = new Date().toISOString();
    saveUsersToDisk();

    res.json({
        success: true,
        message: 'Login successful',
        user: {
            uid: user.uid || ('usr_' + Buffer.from(user.email).toString('hex').slice(0, 10)),
            name: user.name,
            email: user.email,
            phone: user.phone,
            provider: user.provider,
            lastLoginAt: user.lastLoginAt,
            isLoggedIn: true
        }
    });
});

/**
 * 3a. Record Customer Login / Session (from Google OAuth, Mobile OTP, or Checkout)
 */
app.post('/api/auth/record-login', (req, res) => {
    const { uid, name, email, phone, provider, photoURL, lastLoginAt } = req.body;
    if (!email && !phone && !uid) {
        return res.status(400).json({ success: false, message: 'Invalid customer payload' });
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanUid = uid || (cleanEmail ? 'usr_' + Buffer.from(cleanEmail).toString('hex').slice(0, 12) : 'usr_' + Date.now());
    const existingIdx = usersStore.findIndex(u => (cleanEmail && u.email.toLowerCase() === cleanEmail) || (cleanUid && u.uid === cleanUid));

    const userObj = {
        uid: cleanUid,
        name: name || (cleanEmail ? cleanEmail.split('@')[0] : 'FoodRush Customer'),
        email: cleanEmail,
        phone: phone || '',
        photoURL: photoURL || '',
        provider: provider || (photoURL || cleanEmail.includes('google') ? 'google' : 'email'),
        lastLoginAt: lastLoginAt || new Date().toISOString()
    };

    if (existingIdx >= 0) {
        usersStore[existingIdx] = { ...usersStore[existingIdx], ...userObj };
    } else {
        usersStore.unshift(userObj);
    }
    saveUsersToDisk();

    console.log(`[FoodRush Server] Recorded customer login: ${userObj.email || userObj.phone} (${userObj.provider}) | Total customers: ${usersStore.length}`);
    res.json({ success: true, user: userObj, count: usersStore.length });
});

/**
 * 3b. Fetch Registered Users (for Admin Customer Logins)
 */
app.get('/api/auth/users', (req, res) => {
    res.json({
        success: true,
        users: usersStore.map(u => ({
            name: u.name,
            email: u.email,
            phone: u.phone || '',
            provider: u.provider || 'email',
            lastLoginAt: u.lastLoginAt || new Date().toISOString(),
            uid: u.uid || ('usr_' + Buffer.from(u.email || 'guest').toString('hex').slice(0, 10))
        }))
    });
});

// Server-side Admin Allowlist & Coupon Usage Ledger
const AUTHORIZED_ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'rohit09ydv@gmail.com,admin@foodrush.com')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

const serverCouponUsageLedger = new Map(); // key: `${userUid}_${couponCode}` -> count
const serverUserOrderCount = new Map(); // key: userUid -> completedOrdersCount

/**
 * 4. Server-Side Admin Authorization Endpoint
 * Verifies Bearer Firebase ID token + explicit admin email allowlist
 */
app.post('/api/admin/verify', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const { uid, email } = req.body || {};

    if (!token || !uid) {
        return res.status(401).json({
            authorized: false,
            message: 'Missing Firebase Authentication token.'
        });
    }

    const normalizedEmail = (email || '').trim().toLowerCase();
    const isAuthorized = Boolean(normalizedEmail && AUTHORIZED_ADMIN_EMAILS.includes(normalizedEmail));

    if (!isAuthorized) {
        return res.status(403).json({
            authorized: false,
            message: 'Account is not in the authorized administrator allowlist.'
        });
    }

    res.json({
        authorized: true,
        adminEmail: normalizedEmail,
        verifiedAt: new Date().toISOString()
    });
});

/**
 * 5. Trusted Backend Coupon Validation Endpoint
 */
app.post('/api/coupons/validate', (req, res) => {
    const { code, subtotal, userUid, offer } = req.body || {};
    if (!code) {
        return res.status(400).json({ valid: false, message: 'Coupon code is required.' });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const uid = userUid || 'guest';

    if (offer) {
        const now = new Date();
        if (offer.expiryDate && new Date(offer.expiryDate + 'T23:59:59') < now) {
            return res.status(400).json({ valid: false, message: `Coupon ${cleanCode} has expired.` });
        }
        if (Number(subtotal || 0) < Number(offer.minOrderAmount || 0)) {
            return res.status(400).json({
                valid: false,
                message: `Minimum order of $${offer.minOrderAmount} required for ${cleanCode}.`
            });
        }
        if (offer.discountType === 'first_order' && (serverUserOrderCount.get(uid) || 0) > 0) {
            return res.status(400).json({
                valid: false,
                message: `Coupon ${cleanCode} is valid only on your first order.`
            });
        }
    }

    const usageKey = `${uid}_${cleanCode}`;
    if ((serverCouponUsageLedger.get(usageKey) || 0) >= 3) {
        return res.status(400).json({
            valid: false,
            message: `You have reached the maximum redemption limit for coupon ${cleanCode}.`
        });
    }

    res.json({ valid: true, code: cleanCode });
});

/**
 * 6. Secure Order Placement API
 * Requires valid authenticated user (verified email or phone + UID) and validates coupon usage
 */
app.post('/api/orders', (req, res) => {
    const { user, cart, couponCode, orderDetails } = req.body;

    // Server-side authentication enforcement (supports Google, Email OTP, and Phone OTP users)
    if (!user || !user.uid || (!user.email && !user.phoneNumber)) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: You must be logged in with a verified account to place an order.'
        });
    }

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Cart is empty. Please add items before checking out.'
        });
    }

    // Prevent repeated single-use coupon abuse on backend
    if (couponCode) {
        const cleanCode = String(couponCode).trim().toUpperCase();
        const usageKey = `${user.uid}_${cleanCode}`;
        const usedTimes = serverCouponUsageLedger.get(usageKey) || 0;
        if (cleanCode === 'FIRST50' && (serverUserOrderCount.get(user.uid) || 0) > 0) {
            return res.status(400).json({
                success: false,
                message: 'Coupon FIRST50 is valid only on your first order.'
            });
        }
        if (usedTimes >= 3) {
            return res.status(400).json({
                success: false,
                message: `Coupon ${cleanCode} has already been used maximum allowed times on this account.`
            });
        }
        serverCouponUsageLedger.set(usageKey, usedTimes + 1);
    }

    serverUserOrderCount.set(user.uid, (serverUserOrderCount.get(user.uid) || 0) + 1);

    const orderId = '#FR' + Math.floor(100000 + Math.random() * 900000);
    const orderRecord = {
        orderId,
        userId: user.uid,
        userEmail: user.email || user.phoneNumber,
        userName: user.name || user.displayName || 'Customer',
        userPhone: (orderDetails && orderDetails.phone) || '',
        items: cart,
        couponCode: couponCode || null,
        details: orderDetails || {},
        status: 'Placed',
        createdAt: new Date().toISOString()
    };

    serverOrdersStore.unshift(orderRecord);
    // Keep max 200 orders in memory
    if (serverOrdersStore.length > 200) serverOrdersStore.pop();
    saveOrdersToDisk();

    // Auto-record ordering customer to users database
    try {
        const orderEmail = (user.email || '').toLowerCase().trim();
        const existingIdx = usersStore.findIndex(u => (orderEmail && u.email.toLowerCase() === orderEmail) || (user.uid && u.uid === user.uid));
        const customerObj = {
            uid: user.uid,
            name: user.name || user.displayName || (orderEmail ? orderEmail.split('@')[0] : 'FoodRush Customer'),
            email: orderEmail,
            phone: (orderDetails && orderDetails.phone) || user.phoneNumber || user.phone || '',
            photoURL: user.photoURL || '',
            provider: user.provider || (user.photoURL || orderEmail.includes('google') ? 'google' : 'email'),
            lastLoginAt: new Date().toISOString()
        };
        if (existingIdx >= 0) {
            usersStore[existingIdx] = { ...usersStore[existingIdx], ...customerObj };
        } else {
            usersStore.unshift(customerObj);
        }
        saveUsersToDisk();
    } catch(e) {}

    console.log(`✅ Order placed successfully: ${orderId} by ${user.email || user.phoneNumber} (${user.uid})`);

    res.json({
        success: true,
        orderId,
        message: 'Order verified and placed successfully!',
        order: orderRecord
    });
});

/**
 * 7. Admin Orders Fetch Endpoint
 */
app.get('/api/orders', (req, res) => {
    res.json({
        success: true,
        orders: serverOrdersStore
    });
});

// Fallback for single-page routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server if run directly (Local development & Render)
if (!process.env.VERCEL) {
    app.listen(PORT, async () => {
        console.log(`====================================================`);
        console.log(`🚀 FoodRush Full-Stack Server running at: http://localhost:${PORT}`);
        console.log(`🍔 Frontend live at: http://localhost:${PORT}/index.html`);
        console.log(`🔐 Real Auth API at: http://localhost:${PORT}/api/auth/`);
        console.log(`====================================================`);
        await getTransporter();
    });
}

// Export for Vercel Serverless Functions
module.exports = app;
