/**
 * FoodRush - Advanced Authentication Logic (auth.js)
 * Full-Stack & Real Client Auth Integration:
 * - Real Email OTP Dispatch via Backend Server (Express + Nodemailer)
 * - Official Google OAuth Popup with Firebase Auth SDK
 * - Registered Account Enforcement & Validation
 * - Persistent Users Database
 */

const USERS_DB_KEY = 'foodrush_users_db';
const ACTIVE_USER_KEY = 'foodrush_user';

// Automatically detect whether frontend is served from live server/Render, localhost:5000, or file:///
const isLocalDevOtherPort = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000';
const API_BASE = (window.location.protocol === 'file:' || isLocalDevOtherPort) ? 'http://localhost:5000' : '';

// State for OTP flow
let pendingRegistrationUser = null;
let currentPreviewUrl = null;
let otpTimerInterval = null;
let otpTimeLeft = 30;

document.addEventListener('DOMContentLoaded', () => {
    initAuthSystem();
});

function initAuthSystem() {
    initSeedDatabase();
    initAuthTabs();
    initLoginForm();
    initRegisterForm();
    initOtpInputHandling();
    checkCurrentUserState();
}

// Ensure default user accounts exist in DB
function initSeedDatabase() {
    let users = getUsersDatabase();
    if (!users) {
        users = [];
        saveUsersDatabase(users);
    }
}

function getUsersDatabase() {
    try {
        return JSON.parse(localStorage.getItem(USERS_DB_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function saveUsersDatabase(users) {
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
}

/* --- Tab Switching --- */
function initAuthTabs() {
    const tabBtns = document.querySelectorAll('.auth-tab-btn');
    const panes = document.querySelectorAll('.auth-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            const targetPane = document.getElementById(`pane-${target}`);
            if (targetPane) targetPane.classList.add('active');
        });
    });
}

function switchToRegisterTab() {
    const regTabBtn = document.getElementById('tab-btn-register');
    if (regTabBtn) regTabBtn.click();
}

function switchToLoginTab() {
    const loginTabBtn = document.getElementById('tab-btn-login');
    if (loginTabBtn) loginTabBtn.click();
}

/* --- LOGIN LOGIC WITH REGISTERED CHECK --- */
function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById('login-email');
        const passInput = document.getElementById('login-password');
        const email = emailInput.value.trim().toLowerCase();
        const password = passInput.value;

        let isValid = true;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showInputError(emailInput, 'Please enter a valid email address');
            isValid = false;
        } else {
            clearInputError(emailInput);
        }

        if (!password || password.length < 6) {
            showInputError(passInput, 'Password must be at least 6 characters');
            isValid = false;
        } else {
            clearInputError(passInput);
        }

        if (!isValid) return;

        // Try Backend API Login if available
        try {
            const apiRes = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await apiRes.json();
            if (data.success) {
                localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(data.user));
                try {
                    fetch('/api/auth/record-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data.user),
                        keepalive: true
                    }).catch(() => {});
                    if (typeof window.FoodRushStore?.syncUserToCloud === 'function') {
                        window.FoodRushStore.syncUserToCloud(data.user);
                    }
                } catch(e) {}
                if (typeof showToast === 'function') {
                    showToast(`👋 Welcome back, ${data.user.name}!`, 'primary');
                }
                setTimeout(() => { window.location.href = '/home/'; }, 800);
                return;
            }
        } catch (err) {
            // Local client fallback
        }

        // Local Database Check
        const users = getUsersDatabase();
        const existingUser = users.find(u => u.email.toLowerCase() === email);

        if (!existingUser) {
            showInputError(emailInput, 'No account found with this email. Please register first!');
            if (typeof showToast === 'function') {
                showToast('⚠️ Account not registered. Please sign up first!', 'warning');
            }
            setTimeout(() => {
                switchToRegisterTab();
                const regEmail = document.getElementById('reg-email');
                if (regEmail) regEmail.value = email;
            }, 1200);
            return;
        }

        if (existingUser.password !== password) {
            showInputError(passInput, 'Incorrect password. Please try again.');
            if (typeof showToast === 'function') {
                showToast('❌ Incorrect password!', 'danger');
            }
            return;
        }

        const sessionUser = {
            name: existingUser.name,
            email: existingUser.email,
            phone: existingUser.phone || '',
            uid: existingUser.uid || ('user-' + Math.random().toString(36).substr(2, 6)),
            provider: existingUser.provider || 'email',
            isLoggedIn: true
        };
        localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(sessionUser));

        // Sync to Cloud Firestore & Admin Panel
        try {
            fetch('/api/auth/record-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionUser),
                keepalive: true
            }).catch(() => {});
        } catch(e) {}

        if (typeof window.FoodRushStore?.syncUserToCloud === 'function') {
            window.FoodRushStore.syncUserToCloud(sessionUser);
        } else {
            import('./store-data.js').then(mod => {
                if (mod?.FoodRushStore?.syncUserToCloud) {
                    mod.FoodRushStore.syncUserToCloud(sessionUser);
                }
            }).catch(() => {});
        }

        if (typeof showToast === 'function') {
            showToast(`👋 Welcome back, ${existingUser.name}!`, 'primary');
        }

        setTimeout(() => {
            window.location.href = '/home/';
        }, 800);
    });
}

/* --- REGISTRATION LOGIC WITH REAL EMAIL OTP --- */
function initRegisterForm() {
    const regForm = document.getElementById('register-form');
    if (!regForm) return;

    regForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('reg-name');
        const emailInput = document.getElementById('reg-email');
        const passInput = document.getElementById('reg-password');
        const confirmPassInput = document.getElementById('reg-confirm-password');

        const name = nameInput.value.trim();
        const email = emailInput.value.trim().toLowerCase();
        const pass = passInput.value;
        const confirmPass = confirmPassInput.value;

        let isValid = true;

        if (!name || name.length < 3) {
            showInputError(nameInput, 'Full name must be at least 3 characters');
            isValid = false;
        } else {
            clearInputError(nameInput);
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showInputError(emailInput, 'Enter a valid Gmail or email address');
            isValid = false;
        } else {
            clearInputError(emailInput);
        }

        if (!pass || pass.length < 6) {
            showInputError(passInput, 'Password must be at least 6 characters');
            isValid = false;
        } else {
            clearInputError(passInput);
        }

        if (pass !== confirmPass) {
            showInputError(confirmPassInput, 'Passwords do not match');
            isValid = false;
        } else {
            clearInputError(confirmPassInput);
        }

        if (!isValid) return;

        const users = getUsersDatabase();
        const alreadyExists = users.some(u => u.email.toLowerCase() === email);
        if (alreadyExists) {
            showInputError(emailInput, 'This email is already registered. Please Login.');
            if (typeof showToast === 'function') {
                showToast('⚠️ Email already registered. Please log in!', 'warning');
            }
            setTimeout(() => {
                switchToLoginTab();
                const loginEmail = document.getElementById('login-email');
                if (loginEmail) loginEmail.value = email;
            }, 1200);
            return;
        }

        pendingRegistrationUser = {
            name: name,
            email: email,
            phone: '',
            password: pass,
            isVerified: false,
            provider: 'email'
        };

        dispatchRegistrationOtp(email, name);
    });
}

async function dispatchRegistrationOtp(email, name) {
    const regSubmitBtn = document.getElementById('reg-submit-btn');
    if (regSubmitBtn) {
        regSubmitBtn.disabled = true;
        regSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending real OTP to your Gmail...';
    }

    try {
        const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            if (typeof showToast === 'function') {
                showToast(`✉️ 6-digit verification code sent to ${email}! Please check your Gmail inbox.`, 'primary');
            }
            openOtpModal(email, 'email');
        } else {
            throw new Error(data.message || 'Failed to dispatch email verification code');
        }
    } catch (err) {
        console.error('Email OTP dispatch error:', err);
        if (typeof showToast === 'function') {
            showToast(`❌ ${err.message}`, 'danger');
        }
    } finally {
        if (regSubmitBtn) {
            regSubmitBtn.disabled = false;
            regSubmitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send OTP to Gmail & Verify';
        }
    }
}

function openOtpModal(recipient, type = 'email') {
    const modal = document.getElementById('otp-verification-modal');
    const recipientSpan = document.getElementById('otp-recipient-email');
    const modalTitle = document.getElementById('otp-modal-title');
    const iconWrap = document.getElementById('otp-icon-wrap');
    if (!modal) return;

    if (modalTitle) modalTitle.textContent = 'Gmail OTP Verification';
    if (iconWrap) {
        iconWrap.innerHTML = '<i class="fa-solid fa-envelope-circle-check"></i>';
    }

    if (recipientSpan) {
        recipientSpan.textContent = recipient;
    }

    const otpFields = modal.querySelectorAll('.otp-field');
    otpFields.forEach(f => {
        f.value = '';
        f.style.borderColor = '';
    });

    modal.classList.add('active');
    setTimeout(() => {
        if (otpFields[0]) otpFields[0].focus();
    }, 200);

    startOtpTimer();
}

function closeOtpModal() {
    const modal = document.getElementById('otp-verification-modal');
    if (modal) modal.classList.remove('active');
    clearInterval(otpTimerInterval);
}

function startOtpTimer() {
    clearInterval(otpTimerInterval);
    otpTimeLeft = 30;

    const timerText = document.getElementById('otp-timer-text');
    const countdownSpan = document.getElementById('otp-countdown');
    const resendBtn = document.getElementById('otp-resend-button');

    if (timerText) timerText.style.display = 'inline';
    if (resendBtn) resendBtn.style.display = 'none';
    if (countdownSpan) countdownSpan.textContent = otpTimeLeft;

    otpTimerInterval = setInterval(() => {
        otpTimeLeft--;
        if (countdownSpan) countdownSpan.textContent = otpTimeLeft;

        if (otpTimeLeft <= 0) {
            clearInterval(otpTimerInterval);
            if (timerText) timerText.style.display = 'none';
            if (resendBtn) resendBtn.style.display = 'inline';
        }
    }, 1000);
}

function resendRegistrationOTP() {
    if (!pendingRegistrationUser) return;
    dispatchRegistrationOtp(pendingRegistrationUser.email, pendingRegistrationUser.name);
}

/* --- OTP Box Input Handlers (Auto-focus & Paste) --- */
function initOtpInputHandling() {
    const modal = document.getElementById('otp-verification-modal');
    if (!modal) return;

    const otpFields = modal.querySelectorAll('.otp-field');
    otpFields.forEach((field, idx) => {
        field.addEventListener('input', (e) => {
            const val = e.target.value.replace(/\D/g, '');
            field.value = val ? val.charAt(0) : '';

            if (field.value && idx < otpFields.length - 1) {
                otpFields[idx + 1].focus();
            }

            const fullOtp = Array.from(otpFields).map(f => f.value).join('');
            if (fullOtp.length === 6) {
                submitOtpVerification();
            }
        });

        field.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !field.value && idx > 0) {
                otpFields[idx - 1].focus();
            }
        });

        field.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = (e.clipboardData || window.clipboardData).getData('text').trim();
            const digits = pastedData.replace(/\D/g, '').slice(0, 6);
            if (digits) {
                digits.split('').forEach((char, i) => {
                    if (otpFields[i]) otpFields[i].value = char;
                });
                if (otpFields[Math.min(digits.length, 5)]) {
                    otpFields[Math.min(digits.length, 5)].focus();
                }
                if (digits.length === 6) {
                    submitOtpVerification();
                }
            }
        });
    });
}

async function submitOtpVerification() {
    if (!pendingRegistrationUser) return;

    const modal = document.getElementById('otp-verification-modal');
    const otpFields = modal.querySelectorAll('.otp-field');
    const enteredOtp = Array.from(otpFields).map(f => f.value).join('');

    if (enteredOtp.length < 6) {
        if (typeof showToast === 'function') {
            showToast('Please enter the complete 6-digit code sent to your Gmail', 'warning');
        }
        return;
    }

    const verifyBtn = document.getElementById('verify-otp-btn');
    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    }

    try {
        const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: pendingRegistrationUser.email,
                otp: enteredOtp,
                name: pendingRegistrationUser.name,
                password: pendingRegistrationUser.password
            })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            if (typeof showToast === 'function') {
                showToast(`❌ ${data.message || 'Invalid code! Please check the code in your Gmail.'}`, 'danger');
            }
            otpFields.forEach(f => f.style.borderColor = 'var(--danger)');
            setTimeout(() => {
                otpFields.forEach(f => f.style.borderColor = '');
            }, 1500);
            if (verifyBtn) {
                verifyBtn.disabled = false;
                verifyBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Verify & Register';
            }
            return;
        }

        // Successfully verified & registered!
        pendingRegistrationUser.isVerified = true;
        const users = getUsersDatabase();
        const newUser = {
            name: pendingRegistrationUser.name,
            email: pendingRegistrationUser.email.toLowerCase(),
            phone: pendingRegistrationUser.phone || '',
            password: pendingRegistrationUser.password,
            uid: data.user?.uid || ('user-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5)),
            isVerified: true,
            provider: 'email',
            isLoggedIn: true
        };

        const existingIdx = users.findIndex(u => u.email.toLowerCase() === newUser.email);
        if (existingIdx !== -1) {
            users[existingIdx] = newUser;
        } else {
            users.push(newUser);
        }
        saveUsersDatabase(users);

        // Set Active Session so user is instantly logged in!
        localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(newUser));

        // Sync to Cloud Firestore & Admin Panel
        try {
            fetch('/api/auth/record-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser),
                keepalive: true
            }).catch(() => {});
        } catch(e) {}

        if (typeof window.FoodRushStore?.syncUserToCloud === 'function') {
            window.FoodRushStore.syncUserToCloud(newUser);
        } else {
            import('./store-data.js').then(mod => {
                if (mod?.FoodRushStore?.syncUserToCloud) {
                    mod.FoodRushStore.syncUserToCloud(newUser);
                }
            }).catch(() => {});
        }

        closeOtpModal();

        // Reset register form
        const regForm = document.getElementById('register-form');
        if (regForm) regForm.reset();

        if (typeof showToast === 'function') {
            showToast(`🎉 Verification Successful! Welcome, ${newUser.name}!`, 'primary');
        }

        setTimeout(() => {
            window.location.href = '/home/';
        }, 800);

    } catch (err) {
        console.error('Verification error:', err);
        if (typeof showToast === 'function') {
            showToast(`⚠️ Verification error: ${err.message}`, 'danger');
        }
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Verify & Register';
        }
    }
}

/* --- OFFICIAL DIRECT GOOGLE OAUTH SIGN-IN (FIREBASE MODULAR SDK) --- */
async function waitForFoodRushAuth(timeoutMs = 4000) {
    if (window.FoodRushAuth && typeof window.FoodRushAuth.signInWithGoogle === 'function') {
        return window.FoodRushAuth;
    }
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        await new Promise(r => setTimeout(r, 60));
        if (window.FoodRushAuth && typeof window.FoodRushAuth.signInWithGoogle === 'function') {
            return window.FoodRushAuth;
        }
    }
    return null;
}

async function openGoogleAuthModal() {
    const googleBtn = document.querySelector('.btn-google');
    if (googleBtn) {
        googleBtn.disabled = true;
        googleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting to Google...';
    }

    try {
        const authModule = await waitForFoodRushAuth(4000);
        if (!authModule) {
            throw new Error('Google Authentication service is initializing. Please refresh the page and try again.');
        }

        const signedUser = await authModule.signInWithGoogle();
        if (signedUser && signedUser.isLoggedIn) {
            setTimeout(() => {
                window.location.href = '/home/';
            }, 800);
        }

    } catch (err) {
        console.warn('Google Sign-In notice:', err.message || err);
        const isCancelled = err.code === 'auth/popup-closed-by-user' ||
                            err.isCancelled ||
                            (err.message && (err.message.toLowerCase().includes('cancel') || err.message.toLowerCase().includes('closed')));

        if (isCancelled) {
            // User cancelled / closed the popup - no error modal needed
            return;
        }

        if (window.FoodRushAuth && typeof window.FoodRushAuth.showGoogleAuthErrorModal === 'function') {
            window.FoodRushAuth.showGoogleAuthErrorModal(err);
        } else if (typeof showToast === 'function') {
            showToast(`⚠️ ${err.message || 'Google Sign-In Error'}`, 'danger');
        }
    } finally {
        if (googleBtn) {
            googleBtn.disabled = false;
            googleBtn.innerHTML = `
                <svg class="google-icon-svg" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Continue with Google
            `;
        }
    }
}

/* --- HELPERS & CURRENT USER STATE --- */
function showInputError(input, msg) {
    input.classList.add('is-invalid');
    let errEl = input.parentElement.querySelector('.error-text');
    if (!errEl) {
        errEl = document.createElement('span');
        errEl.className = 'error-text';
        input.parentElement.appendChild(errEl);
    }
    errEl.textContent = msg;
    errEl.style.display = 'block';
}

function clearInputError(input) {
    input.classList.remove('is-invalid');
    const errEl = input.parentElement.querySelector('.error-text');
    if (errEl) errEl.style.display = 'none';
}

function checkCurrentUserState() {
    let user = null;
    try {
        user = JSON.parse(localStorage.getItem(ACTIVE_USER_KEY));
        // Clean out any old mock session from earlier testing
        if (user && (user.uid?.startsWith('google-user-') || user.password === 'google-oauth-token')) {
            localStorage.removeItem(ACTIVE_USER_KEY);
            user = null;
        }
    } catch (e) {
        user = null;
    }

    const sessionCard = document.getElementById('logged-in-session-view');
    const authWrapper = document.querySelector('.auth-wrapper');

    if (user && user.isLoggedIn && sessionCard && authWrapper) {
        authWrapper.style.display = 'none';
        sessionCard.style.display = 'block';

        const nameEl = document.getElementById('session-user-name');
        const emailEl = document.getElementById('session-user-email');
        if (nameEl) nameEl.textContent = user.name;
        if (emailEl) emailEl.textContent = user.email + (user.provider === 'google' ? ' (Google Account)' : ' (Verified)');
    }
}

function handleUserLogout() {
    if (window.FoodRushAuth && typeof window.FoodRushAuth.signOutUser === 'function') {
        window.FoodRushAuth.signOutUser();
        return;
    }
    localStorage.removeItem(ACTIVE_USER_KEY);
    if (typeof showToast === 'function') {
        showToast('You have been logged out successfully', 'primary');
    }
    setTimeout(() => {
        window.location.href = '/home/';
    }, 600);
}
