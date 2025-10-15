document.addEventListener('DOMContentLoaded', function() {
    
    const burgerBtn = document.getElementById('burgerBtn');
    const navMenu = document.getElementById('navMenu');
    const body = document.body;
    
    if (!burgerBtn || !navMenu) {
        console.log('Burger menu elements not found:', {
            burgerBtn: !!burgerBtn,
            navMenu: !!navMenu
        });
        return;
    }
    
    let overlay = document.querySelector('.nav-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'nav-overlay';
        body.appendChild(overlay);
    }
    
    let isOpen = false;
    
    function openMenu() {
        isOpen = true;
        burgerBtn.classList.add('active');
        navMenu.classList.add('active');
        overlay.classList.add('active');
        body.classList.add('menu-open');
        try { burgerBtn.setAttribute('aria-expanded', 'true'); } catch(e){}
    }
    
    function closeMenu() {
        isOpen = false;
        burgerBtn.classList.remove('active');
        navMenu.classList.remove('active');
        overlay.classList.remove('active');
        body.classList.remove('menu-open');
        try { burgerBtn.setAttribute('aria-expanded', 'false'); } catch(e){}
    }
    
    function toggleMenu(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Burger menu toggled, isOpen:', isOpen);
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    }

    burgerBtn.addEventListener('click', toggleMenu);
    burgerBtn.addEventListener('touchend', function(e) {
        e.preventDefault();
        toggleMenu(e);
    });
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeMenu();
        }
    });
    
    navMenu.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    const links = navMenu.querySelectorAll('a');
    links.forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.stopPropagation();
            setTimeout(closeMenu, 300);
        });
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isOpen) {
            closeMenu();
        }
    });
    
    window.addEventListener('resize', function() {
        if (window.innerWidth > 968 && isOpen) {
            closeMenu();
        }
    });
});

const bookingForm = document.getElementById('bookingForm');
const formSuccess = document.getElementById('formSuccess');
const formError = document.getElementById('formError');
// Determine serverless endpoint (GitHub Pages friendly): use meta[name="form-endpoint"] if set
const endpointMeta = document.querySelector('meta[name="form-endpoint"]');
const FUNCTION_ENDPOINT = (endpointMeta && endpointMeta.content && endpointMeta.content.trim().length > 0)
    ? endpointMeta.content.trim()
    : '/.netlify/functions/send-telegram';

bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let isValid = true;
    
    if (!validateField('name')) isValid = false;
    
    if (!validateField('phone')) isValid = false;
    
    const dateValue = document.getElementById('date')?.value;
    if (dateValue) {
        if (!validateField('date')) isValid = false;
    }
    
    if (!isValid) {
        const firstError = bookingForm.querySelector('.input-wrapper.error input, .input-wrapper.error select, .input-wrapper.error textarea');
        if (firstError) {
            firstError.focus();
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    const formData = new FormData(bookingForm);
    const data = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        service: formData.get('service'),
        date: formData.get('date'),
        comment: formData.get('comment'),
        // spam honeypot
        website: formData.get('website') || ''
    };
    
    const submitBtn = bookingForm.querySelector('.btn-submit');
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loader').style.display = 'inline-flex';
    
    formSuccess.style.display = 'none';
    formError.style.display = 'none';
    
    try {
        // Send to serverless function (Netlify or external) — configurable via meta[name="form-endpoint"]
        const response = await fetch(FUNCTION_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            formSuccess.style.display = 'flex';
            try { formSuccess.focus(); } catch(e){}
            bookingForm.reset();
            
            if (commentCount) commentCount.textContent = '0/500';
            
            setTimeout(() => {
                formSuccess.style.display = 'none';
            }, 8000);
        } else {
            // Try to log server details for easier debugging
            let details = '';
            try {
                const ct = response.headers.get('content-type') || '';
                if (ct.includes('application/json')) {
                    const j = await response.json();
                    details = JSON.stringify(j);
                } else {
                    details = await response.text();
                }
            } catch(_) {}
            console.error('Form submit failed:', { status: response.status, details });
            throw new Error('Помилка відправки');
        }
        
    } catch (error) {
        console.error('Error:', error);
        formError.style.display = 'flex';
        try { formError.focus(); } catch(e){}
        
        setTimeout(() => {
            formError.style.display = 'none';
        }, 8000);
    } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').style.display = 'inline';
        submitBtn.querySelector('.btn-loader').style.display = 'none';
    }
});

const formValidation = {
    name: {
        validate: (value) => {
            if (!value || value.trim().length < 2) {
                return 'Будь ласка, введіть ваше ім\'я (мінімум 2 символи)';
            }
            if (!/^[A-Za-zА-ЯІЇЄҐа-яіїєґ'’ -]+$/.test(value)) {
                return 'Ім\'я може містити тільки літери, пробіли, апостроф та дефіс';
            }
            if (value.trim().length > 50) {
                return 'Ім\'я занадто довге (максимум 50 символів)';
            }
            return '';
        }
    },
    phone: {
        validate: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Будь ласка, введіть номер телефону';
            }
            const phoneDigits = value.replace(/\D/g, '');
            if (phoneDigits.length !== 12 || !phoneDigits.startsWith('380')) {
                return 'Введіть коректний номер телефону (+380XXXXXXXXX)';
            }
            return '';
        }
    },
    date: {
        validate: (value) => {
            if (value) {
                const selectedDate = new Date(value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                if (selectedDate < today) {
                    return 'Дата не може бути в минулому';
                }
                
                const dayOfWeek = selectedDate.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    return 'Будь ласка, оберіть робочий день (понеділок-п\'ятниця)';
                }
            }
            return '';
        }
    }
};

function showError(fieldId, message) {
    const errorElement = document.getElementById(`${fieldId}Error`);
    const inputElement = document.getElementById(fieldId);
    const inputWrapper = inputElement?.closest('.input-wrapper');
    
    if (errorElement && message) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        inputWrapper?.classList.add('error');
        inputElement?.setAttribute('aria-invalid', 'true');
    }
}

function hideError(fieldId) {
    const errorElement = document.getElementById(`${fieldId}Error`);
    const inputElement = document.getElementById(fieldId);
    const inputWrapper = inputElement?.closest('.input-wrapper');
    
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
        inputWrapper?.classList.remove('error');
        inputElement?.setAttribute('aria-invalid', 'false');
    }
}

function validateField(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return true;
    
    const value = field.value;
    const validator = formValidation[fieldId];
    
    if (validator) {
        const errorMessage = validator.validate(value);
        if (errorMessage) {
            showError(fieldId, errorMessage);
            return false;
        } else {
            hideError(fieldId);
            return true;
        }
    }
    
    hideError(fieldId);
    return true;
}

const phoneInput = document.getElementById('phone');
if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length > 0) {
            if (!value.startsWith('380')) {
                if (value.startsWith('80')) {
                    value = '3' + value;
                } else if (value.startsWith('0')) {
                    value = '38' + value;
                } else if (!value.startsWith('3')) {
                    value = '380' + value;
                }
            }
            
            let formatted = '+380';
            if (value.length > 3) formatted += ' ' + value.slice(3, 5);
            if (value.length > 5) formatted += ' ' + value.slice(5, 8);
            if (value.length > 8) formatted += ' ' + value.slice(8, 10);
            if (value.length > 10) formatted += ' ' + value.slice(10, 12);
            
            e.target.value = formatted;
        } else {
            e.target.value = '';
        }
    });
    
    phoneInput.addEventListener('blur', () => {
        validateField('phone');
    });
    
    phoneInput.addEventListener('keydown', (e) => {
        const cursorPosition = e.target.selectionStart;
        if ((e.key === 'Backspace' || e.key === 'Delete') && cursorPosition <= 4) {
            e.preventDefault();
        }
    });
}

const dateInput = document.getElementById('date');
if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
    
    dateInput.addEventListener('change', () => {
        validateField('date');
    });
}

const nameInput = document.getElementById('name');
if (nameInput) {
    nameInput.addEventListener('blur', () => validateField('name'));
}



const commentInput = document.getElementById('comment');
const commentCount = document.getElementById('commentCount');
if (commentInput && commentCount) {
    commentInput.addEventListener('input', (e) => {
        const length = e.target.value.length;
        commentCount.textContent = `${length}/500`;
        
        if (length > 450) {
            commentCount.style.color = '#e74c3c';
        } else {
            commentCount.style.color = '';
        }
    });
}

document.querySelectorAll('.btn-primary, .btn-cta, .btn-mobile-cta').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = document.getElementById('booking-section') || document.getElementById('bookingForm');
        if (target && typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Додатковий скрол для кращого позиціонування на мобільному
            setTimeout(() => {
                window.scrollBy(0, -20);
            }, 500);
            // Закрити мобільне меню після кліку
            const burgerBtn = document.getElementById('burgerBtn');
            const navMenu = document.getElementById('navMenu');
            const overlay = document.querySelector('.nav-overlay');
            const body = document.body;
            if (burgerBtn && navMenu) {
                burgerBtn.classList.remove('active');
                navMenu.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
                body.classList.remove('menu-open');
            }
        } else {
            console.warn('Booking section not found');
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const priceCards = document.querySelectorAll('.price-card');
    const bookingForm = document.getElementById('bookingForm');
    const serviceSelect = document.getElementById('service');
    const phoneInput = document.getElementById('phone');

    if (!bookingForm) return;

    priceCards.forEach((card, idx) => {
        if (card.querySelector('.card-actions')) return;

        card.setAttribute('role', 'group');

        const titleEl = card.querySelector('.card-title');
        if (titleEl) {
            if (!titleEl.id) titleEl.id = `price-card-title-${idx+1}`;
            if (!titleEl.querySelector('.card-icon')) {
                const icon = document.createElement('span');
                icon.className = 'card-icon';
                icon.innerHTML = `
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                        <path d="M12 2C8 2 5 5 5 9c0 4 7 11 7 11s7-7 7-11c0-4-3-7-7-7z"></path>
                    </svg>
                `;
                titleEl.insertBefore(icon, titleEl.firstChild);
            }
        }

        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const existingPriceEl = card.querySelector('.card-price');
        let priceSmall = null;
        if (existingPriceEl) {
            priceSmall = existingPriceEl;
            try { existingPriceEl.parentElement && existingPriceEl.parentElement.removeChild(existingPriceEl); } catch(e){}
            priceSmall.classList.add('card-price-small');
        } else {
            priceSmall = document.createElement('div');
            priceSmall.className = 'card-price-small';
            const priceText = '';
            priceSmall.textContent = priceText;
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'card-cta';
        btn.textContent = 'Записатися';

        btn.addEventListener('click', (e) => {
            const titleEl2 = card.querySelector('.card-title');
            const serviceName = titleEl2 ? titleEl2.textContent.trim() : '';

            if (serviceSelect) {
                let opt = Array.from(serviceSelect.options).find(o => o.text === serviceName || o.value === serviceName);
                if (!opt) {
                    const slug = serviceName.toLowerCase().replace(/[^a-z0-9а-яіїєґ\s]/g, '').replace(/\s+/g, '_');
                    opt = document.createElement('option');
                    opt.value = slug || serviceName;
                    opt.text = serviceName;
                    serviceSelect.appendChild(opt);
                }
                serviceSelect.value = opt.value;
            }

            try { btn.setAttribute('aria-label', `Записатися на ${serviceName}`); } catch(e){}

            const target = document.getElementById('контакти') || bookingForm || null;
            if (target && typeof target.scrollIntoView === 'function') {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                console.warn('Scroll target not found for card CTA: #контакти or bookingForm');
            }
                if (titleEl && titleEl.id) {
                    btn.setAttribute('aria-labelledby', titleEl.id);
                }

            setTimeout(() => {
                if (phoneInput) phoneInput.focus();
            }, 700);
        });

    actions.appendChild(priceSmall);
        actions.appendChild(btn);
        card.appendChild(actions);
    });
});

// FAQ Accordion functionality
document.addEventListener('DOMContentLoaded', function() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        
        if (question && answer) {
            question.addEventListener('click', function() {
                const isExpanded = this.getAttribute('aria-expanded') === 'true';
                
                // Close all other FAQ items
                faqItems.forEach(otherItem => {
                    const otherQuestion = otherItem.querySelector('.faq-question');
                    const otherAnswer = otherItem.querySelector('.faq-answer');
                    
                    if (otherQuestion && otherAnswer && otherItem !== item) {
                        otherQuestion.setAttribute('aria-expanded', 'false');
                        otherAnswer.setAttribute('aria-hidden', 'true');
                    }
                });
                
                // Toggle current item
                if (isExpanded) {
                    this.setAttribute('aria-expanded', 'false');
                    answer.setAttribute('aria-hidden', 'true');
                } else {
                    this.setAttribute('aria-expanded', 'true');
                    answer.setAttribute('aria-hidden', 'false');
                }
            });
            
            // Keyboard navigation
            question.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.click();
                }
            });
        }
    });
});

try {
    const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:';
    if (isDev) {
        console.log('✅ Dental Lab website loaded successfully!');
        console.log('🔄 Версія: 2.1');
        
        // Debug function to clear cache
        window.clearSiteCache = function() {
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                    console.log('🗑️ Кеш очищено');
                    location.reload(true);
                });
            }
        };
        console.log('💡 Виконайте clearSiteCache() для очищення кешу');
    }
} catch (_) {}

// Floating CTA
document.addEventListener('DOMContentLoaded', function() {
    const floatingCta = document.getElementById('floatingCta');
    
    // Show floating elements after user scrolls past hero
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const heroHeight = document.querySelector('.hero').offsetHeight || 600;
        
        if (scrolled > heroHeight / 2) {
            floatingCta.classList.add('visible');
        } else {
            floatingCta.classList.remove('visible');
        }
    });

    // Floating CTA click handler
    floatingCta.addEventListener('click', function() {
        const target = document.getElementById('booking-section') || document.getElementById('bookingForm');
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Додатковий скрол для кращого позиціонування на мобільному
            setTimeout(() => {
                window.scrollBy(0, -20);
            }, 500);
        } else {
            console.warn('Booking section not found');
        }
    });
});

// Callback Form Modal
document.addEventListener('DOMContentLoaded', function() {
    const callbackOverlay = document.getElementById('callbackOverlay');
    const closeCallbackBtn = document.getElementById('closeCallbackPopup');
    const callbackForm = document.getElementById('callbackForm');
    const callbackPhone = document.getElementById('callbackPhone');
    
    // Close callback popup
    closeCallbackBtn.addEventListener('click', function() {
        callbackOverlay.classList.remove('active');
    });
    
    // Close on outside click
    callbackOverlay.addEventListener('click', function(e) {
        if (e.target === callbackOverlay) {
            callbackOverlay.classList.remove('active');
        }
    });
    
    // Phone formatting for callback
    callbackPhone.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        
        if (value.length > 0) {
            if (!value.startsWith('380')) {
                if (value.startsWith('80')) {
                    value = '3' + value;
                } else if (value.startsWith('0')) {
                    value = '38' + value;
                } else if (!value.startsWith('3')) {
                    value = '380' + value;
                }
            }
            
            let formatted = '+380';
            if (value.length > 3) formatted += ' ' + value.slice(3, 5);
            if (value.length > 5) formatted += ' ' + value.slice(5, 8);
            if (value.length > 8) formatted += ' ' + value.slice(8, 10);
            if (value.length > 10) formatted += ' ' + value.slice(10, 12);
            
            e.target.value = formatted;
        } else {
            e.target.value = '';
        }
    });
    
    // Callback form submission
    callbackForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const phone = callbackPhone.value;
        const phoneDigits = phone.replace(/\D/g, '');
        
        if (phoneDigits.length !== 12 || !phoneDigits.startsWith('380')) {
            document.getElementById('callbackPhoneError').textContent = 'Введіть коректний номер телефону';
            return;
        }
        
        const submitBtn = callbackForm.querySelector('.btn-callback-submit');
        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').style.display = 'none';
        submitBtn.querySelector('.btn-loader').style.display = 'inline-flex';
        
        try {
            const response = await fetch(FUNCTION_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Зворотний дзвінок',
                    phone: phone,
                    service: 'callback',
                    comment: 'Запит на зворотний дзвінок',
                    website: ''
                })
            });
            
            if (response.ok) {
                document.getElementById('callbackSuccess').style.display = 'flex';
                callbackForm.style.display = 'none';
                
                setTimeout(() => {
                    callbackOverlay.classList.remove('active');
                    callbackForm.style.display = 'block';
                    document.getElementById('callbackSuccess').style.display = 'none';
                    callbackForm.reset();
                }, 3000);
            } else {
                throw new Error('Помилка відправки');
            }
        } catch (error) {
            document.getElementById('callbackPhoneError').textContent = 'Помилка відправки. Спробуйте ще раз.';
        } finally {
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-text').style.display = 'inline';
            submitBtn.querySelector('.btn-loader').style.display = 'none';
        }
    });
});

// Form Progress Indicator
document.addEventListener('DOMContentLoaded', function() {
    const formFields = ['name', 'phone', 'service', 'date'];
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    function updateProgress() {
        let completedFields = 0;
        
        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field && field.value.trim() !== '') {
                completedFields++;
            }
        });
        
        const progress = Math.round((completedFields / formFields.length) * 100);
        progressFill.style.width = progress + '%';
        progressText.textContent = progress + '% заповнено';
        
        // Change color based on progress
        if (progress === 100) {
            progressFill.style.background = 'linear-gradient(90deg, #22c55e, #16a34a)';
            progressText.style.color = '#16a34a';
        } else {
            progressFill.style.background = 'linear-gradient(90deg, var(--mint), #7ed4ad)';
            progressText.style.color = 'var(--text-gray)';
        }
    }
    
    // Add event listeners to form fields
    formFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', updateProgress);
            field.addEventListener('change', updateProgress);
        }
    });
    
    // Initial update
    updateProgress();
});

// Escape key handlers
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        document.getElementById('callbackOverlay').classList.remove('active');
    }
});

(function setFooterCopyright(){
    try {
        const el = document.getElementById('footerCopyright');
        if (!el) return;
        const year = new Date().getFullYear();
        el.textContent = `© ${year} Dental Lab.`;
    } catch (e) {
    }
})();