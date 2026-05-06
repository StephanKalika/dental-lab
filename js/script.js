// Shared phone number formatter — normalises to +380 XX XXX XX XX
function formatPhoneValue(raw) {
    let value = raw.replace(/\D/g, '');
    if (!value.length) return '';
    if (!value.startsWith('380')) {
        if (value.startsWith('80')) value = '3' + value;
        else if (value.startsWith('0')) value = '38' + value;
        else if (!value.startsWith('3')) value = '380' + value;
    }
    let formatted = '+380';
    if (value.length > 3) formatted += ' ' + value.slice(3, 5);
    if (value.length > 5) formatted += ' ' + value.slice(5, 8);
    if (value.length > 8) formatted += ' ' + value.slice(8, 10);
    if (value.length > 10) formatted += ' ' + value.slice(10, 12);
    return formatted;
}

// Focus trap utility for modals
function createFocusTrap(containerEl) {
    const focusableSelectors = [
        'a[href]', 'button:not([disabled])', 'input:not([disabled])',
        'select:not([disabled])', 'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(', ');

    function handleKeydown(e) {
        if (e.key !== 'Tab') return;
        const focusable = Array.from(containerEl.querySelectorAll(focusableSelectors))
            .filter(el => !el.closest('[aria-hidden="true"]'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
            if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    }

    return {
        activate() { containerEl.addEventListener('keydown', handleKeydown); },
        deactivate() { containerEl.removeEventListener('keydown', handleKeydown); }
    };
}

// ===== BEFORE/AFTER SLIDER LOGIC =====
function initBASliders() {
    const sliders = document.querySelectorAll('.ba-slider-container');
    if (!sliders.length) return;

    sliders.forEach((slider) => {
        const handle = slider.querySelector('.ba-handle');
        const beforeWrapper = slider.querySelector('.ba-before-wrapper');
        const beforeLabel = slider.querySelector('.ba-label-before');
        const afterLabel = slider.querySelector('.ba-label-after');
        if (!handle || !beforeWrapper) return;

        let isActive = false;

        function syncLabelVisibility(percentage) {
            if (beforeLabel) {
                const hideBefore = percentage < 12;
                beforeLabel.classList.toggle('ba-label-hidden', hideBefore);
                beforeLabel.setAttribute('aria-hidden', hideBefore ? 'true' : 'false');
            }

            if (afterLabel) {
                const hideAfter = percentage > 88;
                afterLabel.classList.toggle('ba-label-hidden', hideAfter);
                afterLabel.setAttribute('aria-hidden', hideAfter ? 'true' : 'false');
            }
        }

        const moveHandler = (clientX) => {
            const rect = slider.getBoundingClientRect();
            if (!rect.width) return;

            let positionX = clientX - rect.left;
            if (positionX < 0) positionX = 0;
            if (positionX > rect.width) positionX = rect.width;

            const percentage = (positionX / rect.width) * 100;
            handle.style.left = `${percentage}%`;
            handle.setAttribute('aria-valuenow', Math.round(percentage));
            beforeWrapper.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
            syncLabelVisibility(percentage);
        };

        const startDrag = () => {
            isActive = true;
            slider.classList.add('is-dragging');
            slider.classList.add('ba-interacted');
            handle.style.transition = 'none';
            beforeWrapper.style.transition = 'none';
        };

        const stopDrag = () => {
            isActive = false;
            slider.classList.remove('is-dragging');
            handle.style.transition = '';
            beforeWrapper.style.transition = '';
        };

        handle.addEventListener('mousedown', startDrag);
        slider.addEventListener('mousedown', (e) => {
            startDrag();
            moveHandler(e.clientX);
        });
        slider.addEventListener('click', () => {
            slider.classList.add('ba-interacted');
        });
        window.addEventListener('mouseup', stopDrag);

        slider.addEventListener('mousemove', (e) => {
            if (!isActive) return;
            moveHandler(e.clientX);
        });

        handle.addEventListener('touchstart', startDrag, { passive: true });
        slider.addEventListener('touchstart', (e) => {
            startDrag();
            moveHandler(e.touches[0].clientX);
        }, { passive: true });
        window.addEventListener('touchend', stopDrag, { passive: true });

        slider.addEventListener('touchmove', (e) => {
            if (!isActive) return;
            moveHandler(e.touches[0].clientX);
        }, { passive: true });

        // One-time intro animation to hint interactivity.
        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!prefersReducedMotion) {
            setTimeout(() => {
                if (slider.classList.contains('ba-interacted')) return;
                const sequence = [40, 60, 50];
                sequence.forEach((value, index) => {
                    setTimeout(() => {
                        handle.style.left = `${value}%`;
                        handle.setAttribute('aria-valuenow', value);
                        beforeWrapper.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
                        syncLabelVisibility(value);
                    }, index * 220);
                });
            }, 450);
        }

        syncLabelVisibility(50);
    });
}

function initReviewsCarousel() {
    const carousel = document.querySelector('[data-reviews-carousel]');
    if (!carousel) return;

    const track = carousel.querySelector('.reviews-grid');
    const slides = Array.from(carousel.querySelectorAll('.review-card'));
    const prevBtn = carousel.querySelector('.reviews-nav-prev');
    const nextBtn = carousel.querySelector('.reviews-nav-next');
    const dotsRoot = carousel.querySelector('#reviewsDots');

    if (!track || !prevBtn || !nextBtn || !dotsRoot || slides.length < 2) return;

    let currentIndex = 0;
    let slidesPerView = 3;
    let maxIndex = 0;
    let swipeStartX = null;
    let swipeDeltaX = 0;
    let autoplayTimer = null;
    const AUTOPLAY_DELAY = 5000;
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function getSlidesPerView() {
        if (window.innerWidth <= 768) return 1;
        if (window.innerWidth <= 968) return 2;
        return 3;
    }

    function getSlideStep() {
        const firstSlide = slides[0];
        if (!firstSlide) return 0;
        const gap = parseFloat(window.getComputedStyle(track).gap || '0') || 0;
        return firstSlide.getBoundingClientRect().width + gap;
    }

    function updateButtons() {
        const shouldDisable = maxIndex === 0;
        prevBtn.disabled = shouldDisable;
        nextBtn.disabled = shouldDisable;
    }

    function updateDots() {
        const dots = Array.from(dotsRoot.querySelectorAll('.reviews-dot'));
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentIndex);
            dot.setAttribute('aria-current', index === currentIndex ? 'true' : 'false');
        });
    }

    function render() {
        const offset = getSlideStep() * currentIndex;
        track.style.transform = `translateX(-${offset}px)`;
        updateButtons();
        updateDots();
    }

    function stopAutoplay() {
        if (!autoplayTimer) return;
        window.clearInterval(autoplayTimer);
        autoplayTimer = null;
    }

    function startAutoplay() {
        if (prefersReducedMotion || maxIndex <= 0 || autoplayTimer || document.hidden) return;
        autoplayTimer = window.setInterval(function() {
            setIndex(currentIndex + 1, { restartAutoplay: false });
        }, AUTOPLAY_DELAY);
    }

    function restartAutoplay() {
        stopAutoplay();
        startAutoplay();
    }

    function setIndex(nextIndex, options) {
        const settings = options || {};
        if (maxIndex <= 0) {
            currentIndex = 0;
            render();
            return;
        }

        let targetIndex = nextIndex;
        if (nextIndex > maxIndex) targetIndex = 0;
        if (nextIndex < 0) targetIndex = maxIndex;

        if (targetIndex === currentIndex) return;
        currentIndex = targetIndex;
        render();
        if (settings.restartAutoplay !== false) restartAutoplay();
    }

    function rebuildDots() {
        dotsRoot.innerHTML = '';
        for (let i = 0; i <= maxIndex; i += 1) {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'reviews-dot';
            dot.setAttribute('aria-label', `Перейти до слайда ${i + 1}`);
            dot.addEventListener('click', function() {
                setIndex(i);
            });
            dotsRoot.appendChild(dot);
        }
    }

    function recalc() {
        slidesPerView = getSlidesPerView();
        maxIndex = Math.max(0, slides.length - slidesPerView);
        if (currentIndex > maxIndex) currentIndex = maxIndex;
        rebuildDots();
        render();
        restartAutoplay();
    }

    prevBtn.addEventListener('click', function() {
        setIndex(currentIndex - 1);
    });

    nextBtn.addEventListener('click', function() {
        setIndex(currentIndex + 1);
    });

    carousel.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft') setIndex(currentIndex - 1);
        if (e.key === 'ArrowRight') setIndex(currentIndex + 1);
    });

    carousel.setAttribute('tabindex', '0');

    track.addEventListener('touchstart', function(e) {
        stopAutoplay();
        swipeStartX = e.touches[0].clientX;
        swipeDeltaX = 0;
    }, { passive: true });

    track.addEventListener('touchmove', function(e) {
        if (swipeStartX == null) return;
        swipeDeltaX = e.touches[0].clientX - swipeStartX;
    }, { passive: true });

    track.addEventListener('touchend', function() {
        if (swipeStartX == null) return;
        if (swipeDeltaX < -40) setIndex(currentIndex + 1);
        if (swipeDeltaX > 40) setIndex(currentIndex - 1);
        swipeStartX = null;
        swipeDeltaX = 0;
        startAutoplay();
    }, { passive: true });

    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', startAutoplay);
    carousel.addEventListener('focusin', stopAutoplay);
    carousel.addEventListener('focusout', function() {
        if (!carousel.contains(document.activeElement)) startAutoplay();
    });

    document.addEventListener('visibilitychange', function() {
        if (document.hidden) stopAutoplay();
        else startAutoplay();
    });

    window.addEventListener('resize', recalc);

    carousel.classList.add('is-ready');
    recalc();
}

function initAdvantagesCarousel() {
    const grid = document.querySelector('.advantages-grid');
    const dotsRoot = document.getElementById('advantagesDots');

    if (!grid || !dotsRoot) return;

    const cards = Array.from(grid.querySelectorAll('.advantage-card'));
    const dots = Array.from(dotsRoot.querySelectorAll('.advantages-dot'));

    if (cards.length < 2 || dots.length !== cards.length) return;

    let currentIndex = 0;
    let swipeStartX = null;
    let swipeDeltaX = 0;

    function setActive(index) {
        currentIndex = index;
        dots.forEach((dot, dotIndex) => {
            const isActive = dotIndex === index;
            dot.classList.toggle('active', isActive);
            dot.setAttribute('aria-current', isActive ? 'true' : 'false');
        });
    }

    function getClosestCardIndex() {
        const gridRect = grid.getBoundingClientRect();
        const gridCenter = gridRect.left + gridRect.width / 2;
        let closestIndex = 0;
        let closestDistance = Infinity;

        cards.forEach((card, index) => {
            const cardRect = card.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const distance = Math.abs(cardCenter - gridCenter);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        });

        return closestIndex;
    }

    function syncDots() {
        setActive(getClosestCardIndex());
    }

    function goToIndex(index) {
        const targetIndex = (index + cards.length) % cards.length;
        cards[targetIndex].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        setActive(targetIndex);
    }

    dots.forEach((dot, index) => {
        dot.addEventListener('click', function() {
            goToIndex(index);
        });
    });

    grid.addEventListener('scroll', function() {
        window.requestAnimationFrame(syncDots);
    }, { passive: true });

    grid.addEventListener('touchstart', function(e) {
        swipeStartX = e.touches[0].clientX;
        swipeDeltaX = 0;
    }, { passive: true });

    grid.addEventListener('touchmove', function(e) {
        if (swipeStartX == null) return;
        swipeDeltaX = e.touches[0].clientX - swipeStartX;
    }, { passive: true });

    grid.addEventListener('touchend', function() {
        if (swipeStartX == null) return;

        const activeIndex = getClosestCardIndex();
        const lastIndex = cards.length - 1;

        if (swipeDeltaX < -40) {
            if (activeIndex === lastIndex) goToIndex(0);
            else goToIndex(activeIndex + 1);
        } else if (swipeDeltaX > 40) {
            if (activeIndex === 0) goToIndex(lastIndex);
            else goToIndex(activeIndex - 1);
        } else {
            syncDots();
        }

        swipeStartX = null;
        swipeDeltaX = 0;
    }, { passive: true });

    window.addEventListener('resize', syncDots);

    syncDots();
}

document.addEventListener('DOMContentLoaded', function() {

    const burgerBtn = document.getElementById('burgerBtn');
    const navMenu = document.getElementById('nav-menu') || document.getElementById('navMenu');
    const body = document.body;

    if (!burgerBtn || !navMenu) return;

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
        burgerBtn.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
        isOpen = false;
        burgerBtn.classList.remove('active');
        navMenu.classList.remove('active');
        overlay.classList.remove('active');
        body.classList.remove('menu-open');
        burgerBtn.setAttribute('aria-expanded', 'false');
    }

    function toggleMenu(e) {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen) closeMenu(); else openMenu();
    }

    burgerBtn.addEventListener('click', toggleMenu);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeMenu();
    });

    navMenu.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    navMenu.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.stopPropagation();
            setTimeout(closeMenu, 300);
        });
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isOpen) closeMenu();
    });

    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            if (window.innerWidth > 968 && isOpen) closeMenu();
        }, 100);
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const header = document.querySelector('.header');
    if (!header) return;

    const mobileQuery = window.matchMedia('(max-width: 968px)');
    let lastScrollY = window.scrollY || 0;
    let ticking = false;

    function updateHeaderState() {
        ticking = false;

        if (!mobileQuery.matches) {
            header.classList.remove('is-hidden');
            lastScrollY = window.scrollY || 0;
            return;
        }

        if (document.body.classList.contains('menu-open')) {
            header.classList.remove('is-hidden');
            lastScrollY = window.scrollY || 0;
            return;
        }

        const currentScrollY = window.scrollY || 0;
        const delta = currentScrollY - lastScrollY;

        if (currentScrollY <= 20) {
            header.classList.remove('is-hidden');
        } else if (delta > 8) {
            header.classList.add('is-hidden');
        } else if (delta < -8) {
            header.classList.remove('is-hidden');
        }

        lastScrollY = currentScrollY;
    }

    function onScroll() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(updateHeaderState);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function() {
        header.classList.remove('is-hidden');
        lastScrollY = window.scrollY || 0;
    });
    mobileQuery.addEventListener('change', function() {
        header.classList.remove('is-hidden');
        lastScrollY = window.scrollY || 0;
    });

    updateHeaderState();
});

const bookingForm = document.getElementById('bookingForm');
const formSuccess = document.getElementById('formSuccess');
const formError = document.getElementById('formError');

const endpointMeta = document.querySelector('meta[name="form-endpoint"]');
const SAME_ORIGIN_ENDPOINT = '/.netlify/functions/send-telegram';
const REMOTE_ENDPOINTS = [
    'https://dental-lab.site/.netlify/functions/send-telegram',
    'https://dentalab.netlify.app/.netlify/functions/send-telegram'
];
const FUNCTION_ENDPOINT = (endpointMeta && endpointMeta.content && endpointMeta.content.trim().length > 0)
    ? endpointMeta.content.trim()
    : SAME_ORIGIN_ENDPOINT;

function redirectToThankYou() {
    // Local file preview resolves absolute paths like /thank-you to C:/thank-you.
    if (window.location.protocol === 'file:') {
        const pathname = (window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
        const localTarget = pathname.includes('/services/') ? '../thank-you.html' : './thank-you.html';
        window.location.assign(localTarget);
        return;
    }

    window.location.assign('/thank-you');
}

function getFriendlySubmitError(errorPayload, statusCode) {
    const raw = (typeof errorPayload === 'string' ? errorPayload : (errorPayload && errorPayload.error) || '').toLowerCase();

    if (raw.includes('server misconfigured')) {
        return 'Сервіс тимчасово недоступний. Будь ласка, зателефонуйте нам: +38 (066) 182-95-40';
    }
    if (raw.includes('too many requests') || statusCode === 429) {
        return 'Забагато спроб. Спробуйте ще раз через 10 хвилин.';
    }
    if (raw.includes('invalid phone')) {
        return 'Введіть коректний номер телефону у форматі +380 XX XXX XX XX.';
    }
    if (raw.includes('missing required')) {
        return 'Заповніть обов\'язкові поля: ім\'я та телефон.';
    }
    if (raw.includes('telegram error') || statusCode === 502) {
        return 'Помилка сервісу повідомлень. Спробуйте ще раз або зателефонуйте нам.';
    }
    if (statusCode >= 500) {
        return 'Помилка сервера. Спробуйте ще раз через кілька хвилин.';
    }
    if (statusCode === 404) {
        return 'Сервіс відправки недоступний на цьому домені. Спробуйте ще раз пізніше або зателефонуйте нам.';
    }
    return 'Помилка відправки. Спробуйте ще раз або зателефонуйте нам: +38 (066) 182-95-40';
}

async function sendFormRequest(payload) {
    const currentHost = window.location.hostname;
    const isLocalHost = currentHost === 'localhost' || currentHost === '127.0.0.1' || currentHost === '::1';

    const endpoints = Array.from(new Set(isLocalHost
        ? [FUNCTION_ENDPOINT, ...REMOTE_ENDPOINTS, SAME_ORIGIN_ENDPOINT]
        : [FUNCTION_ENDPOINT, SAME_ORIGIN_ENDPOINT, ...REMOTE_ENDPOINTS]
    ).values());

    let lastError = null;

    for (const endpoint of endpoints) {
        try {
            const encodedBody = new URLSearchParams(
                Object.entries(payload || {}).map(([key, value]) => [key, value == null ? '' : String(value)])
            ).toString();

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body: encodedBody
            });

            if (response.ok) return response;

            const contentType = response.headers.get('content-type') || '';
            const details = contentType.includes('application/json')
                ? await response.json().catch(() => ({}))
                : await response.text().catch(() => '');

            lastError = new Error(`HTTP ${response.status} from ${endpoint}`);
            lastError.status = response.status;
            lastError.details = details;
            lastError.userMessage = getFriendlySubmitError(details, response.status);
            console.error('Form endpoint returned error', { endpoint, status: response.status, details });
        } catch (error) {
            lastError = error;
            lastError.userMessage = 'Не вдалося підключитися до сервісу відправки. Перевірте з\'єднання або зателефонуйте нам: +38 (066) 182-95-40';
            console.error('Form endpoint network error', { endpoint, error });
        }
    }

    throw lastError || new Error('Form submission failed');
}

if (bookingForm) bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    let isValid = true;
    if (!validateField('name')) isValid = false;
    if (!validateField('phone')) isValid = false;

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
        comment: (formData.get('comment') || '').toString().trim(),
        website: formData.get('website') || ''  // spam honeypot
    };

    const submitBtn = bookingForm.querySelector('.btn-submit');
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loader').style.display = 'inline-flex';

    formSuccess.style.display = 'none';
    formError.style.display = 'none';

    try {
        await sendFormRequest(data);
        bookingForm.reset();
        redirectToThankYou();
    } catch (error) {
        console.error('Form submit error:', error);
        const errorText = formError?.querySelector('p');
        if (errorText) {
            errorText.textContent = error?.userMessage || 'Помилка відправки. Спробуйте ще раз або зателефонуйте нам: +38 (066) 182-95-40';
        }
        formError.style.display = 'flex';
        formError.focus();
        setTimeout(() => { formError.style.display = 'none'; }, 12000);
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
            if (!/^[A-Za-zА-ЯІЇЄҐа-яіїєґ'' -]+$/.test(value)) {
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
};

function showError(fieldId, message) {
    const errorElement = document.getElementById(`${fieldId}Error`);
    const inputElement = document.getElementById(fieldId);
    const inputWrapper = inputElement?.closest('.input-wrapper');

    if (errorElement && message) {
        errorElement.textContent = message;
        errorElement.classList.add('has-error');
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
        errorElement.classList.remove('has-error');
        inputWrapper?.classList.remove('error');
        inputElement?.setAttribute('aria-invalid', 'false');
    }
}

function validateField(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return true;

    const validator = formValidation[fieldId];
    if (validator) {
        const errorMessage = validator.validate(field.value);
        if (errorMessage) {
            showError(fieldId, errorMessage);
            return false;
        }
        hideError(fieldId);
        return true;
    }

    hideError(fieldId);
    return true;
}

const phoneInput = document.getElementById('phone');
if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
        e.target.value = formatPhoneValue(e.target.value);
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

const nameInput = document.getElementById('name');
if (nameInput) {
    nameInput.addEventListener('blur', () => validateField('name'));
}

function closeMobileMenuState() {
    const burgerBtn = document.getElementById('burgerBtn');
    const navMenu = document.getElementById('nav-menu') || document.getElementById('navMenu');
    const overlay = document.querySelector('.nav-overlay');

    if (burgerBtn && navMenu) {
        burgerBtn.classList.remove('active');
        navMenu.classList.remove('active');
    }
    if (overlay) overlay.classList.remove('active');
    document.body.classList.remove('menu-open');
}

function scrollToBookingSection() {
    const target = document.getElementById('booking-section') || document.getElementById('bookingForm');
    if (!(target && typeof target.scrollIntoView === 'function')) return;

    setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => { window.scrollBy(0, -20); }, 280);
    }, 60);
}

document.addEventListener('DOMContentLoaded', function() {
    const bookingOverlay = document.getElementById('bookingOverlay');
    const closeBookingBtn = document.getElementById('closeBookingPopup');
    const bookingPopupForm = document.getElementById('bookingPopupForm');
    const bookingPopupName = document.getElementById('bookingPopupName');
    const bookingPopupPhone = document.getElementById('bookingPopupPhone');
    const openBookingButtons = document.querySelectorAll('.btn-primary, .btn-cta, .btn-mobile-cta:not(.open-callback), .promo-open-booking, .service-page .service-link-pill[href*="#контакти"]');
    const bookingFocusTrap = bookingOverlay ? createFocusTrap(bookingOverlay) : null;
    let bookingTrigger = null;

    function openBookingFlow(triggerEl) {
        closeMobileMenuState();

        if (!bookingOverlay) {
            scrollToBookingSection();
            return;
        }

        bookingTrigger = triggerEl || document.activeElement;
        bookingOverlay.classList.add('active');
        if (bookingFocusTrap) bookingFocusTrap.activate();
        setTimeout(function() {
            if (bookingPopupName) bookingPopupName.focus();
        }, 100);
    }

    function closeBookingOverlay() {
        bookingOverlay.classList.remove('active');
        if (bookingFocusTrap) bookingFocusTrap.deactivate();
        if (bookingTrigger && typeof bookingTrigger.focus === 'function') {
            bookingTrigger.focus();
            bookingTrigger = null;
        }
    }

    openBookingButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openBookingFlow(btn);
        });

        btn.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openBookingFlow(btn);
            }
        });
    });

    if (!bookingOverlay || !closeBookingBtn || !bookingPopupForm || !bookingPopupPhone || !bookingPopupName) {
        return;
    }

    closeBookingBtn.addEventListener('click', closeBookingOverlay);

    bookingOverlay.addEventListener('click', function(e) {
        if (e.target === bookingOverlay) closeBookingOverlay();
    });

    bookingOverlay.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeBookingOverlay();
    });

    bookingPopupPhone.addEventListener('input', function(e) {
        e.target.value = formatPhoneValue(e.target.value);
    });

    bookingPopupForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const nameValue = bookingPopupName.value.trim();
        const phoneValue = bookingPopupPhone.value.trim();
        const phoneDigits = phoneValue.replace(/\D/g, '');

        const nameError = document.getElementById('bookingPopupNameError');
        const phoneError = document.getElementById('bookingPopupPhoneError');
        const successBox = document.getElementById('bookingPopupSuccess');
        const errorBox = document.getElementById('bookingPopupError');

        if (nameError) nameError.textContent = '';
        if (phoneError) phoneError.textContent = '';
        if (successBox) successBox.style.display = 'none';
        if (errorBox) errorBox.style.display = 'none';

        let valid = true;
        if (nameValue.length < 2) {
            valid = false;
            if (nameError) nameError.textContent = 'Введіть ім\'я (мінімум 2 символи)';
        }
        if (phoneDigits.length !== 12 || !phoneDigits.startsWith('380')) {
            valid = false;
            if (phoneError) phoneError.textContent = 'Введіть коректний номер телефону';
        }
        if (!valid) return;

        const submitBtn = bookingPopupForm.querySelector('.btn-callback-submit');
        if (!submitBtn) return;

        submitBtn.disabled = true;
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');
        if (btnText) btnText.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'inline-flex';

        try {
            await sendFormRequest({
                name: nameValue,
                phone: phoneValue,
                service: 'booking_popup',
                comment: 'Запис через поп-ап форму',
                website: ''
            });

            bookingPopupForm.reset();
            if (successBox) successBox.style.display = 'flex';
            redirectToThankYou();
        } catch (error) {
            console.error('Booking popup error:', error);
            const popupErrorText = errorBox?.querySelector('p');
            if (popupErrorText) {
                popupErrorText.textContent = error?.userMessage || 'Помилка відправки. Спробуйте ще раз або зателефонуйте нам: +38 (066) 182-95-40';
            }
            if (errorBox) errorBox.style.display = 'flex';
        } finally {
            submitBtn.disabled = false;
            if (btnText) btnText.style.display = 'inline';
            if (btnLoader) btnLoader.style.display = 'none';
        }
    });
});

function openBookingForService() {
    const bookingOverlay = document.getElementById('bookingOverlay');
    const bookingPopupName = document.getElementById('bookingPopupName');
    const bookingForm = document.getElementById('bookingForm');

    if (bookingOverlay) {
        closeMobileMenuState();
        bookingOverlay.classList.add('active');
        setTimeout(function() {
            if (bookingPopupName) bookingPopupName.focus();
        }, 100);
        return;
    }

    const target = document.getElementById('контакти') || bookingForm || null;
    if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const phoneInput = document.getElementById('phone');
    setTimeout(function() {
        if (phoneInput) phoneInput.focus();
    }, 700);
}

document.addEventListener('DOMContentLoaded', function() {
    const priceButtons = document.querySelectorAll('.price-book-btn');
    if (!priceButtons.length) return;

    priceButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            openBookingForService(btn.getAttribute('data-service') || btn.textContent.trim());
        });
    });

    const estimateBtn = document.querySelector('.price-estimate-btn');
    if (estimateBtn) {
        estimateBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openBookingForService('Індивідуальний прорахунок');
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const accordionItems = document.querySelectorAll('#priceAccordion .price-group');
    if (!accordionItems.length) return;

    accordionItems.forEach(function(item) {
        item.addEventListener('toggle', function() {
            if (!item.open) return;
            accordionItems.forEach(function(otherItem) {
                if (otherItem !== item) otherItem.open = false;
            });
        });
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const faqItems = document.querySelectorAll('.faq-item');
    initBASliders();
    initAdvantagesCarousel();
    initReviewsCarousel();

    function setFaqHeight(answer) {
        if (!answer) return;
        answer.style.setProperty('--faq-content-height', `${answer.scrollHeight}px`);
    }

    function refreshOpenFaqHeights() {
        faqItems.forEach(item => {
            const answer = item.querySelector('.faq-answer');
            if (answer && answer.getAttribute('aria-hidden') === 'false') setFaqHeight(answer);
        });
    }

    function openFaq(question, answer) {
        question.setAttribute('aria-expanded', 'true');
        answer.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(function() {
            setFaqHeight(answer);
        });
    }

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');

        if (!question || !answer) return;

        question.addEventListener('click', function() {
            const isExpanded = this.getAttribute('aria-expanded') === 'true';

            faqItems.forEach(otherItem => {
                const otherQuestion = otherItem.querySelector('.faq-question');
                const otherAnswer = otherItem.querySelector('.faq-answer');
                if (otherQuestion && otherAnswer && otherItem !== item) {
                    otherQuestion.setAttribute('aria-expanded', 'false');
                    otherAnswer.setAttribute('aria-hidden', 'true');
                }
            });

            if (isExpanded) {
                this.setAttribute('aria-expanded', 'false');
                answer.setAttribute('aria-hidden', 'true');
            } else {
                openFaq(this, answer);
            }
        });

        question.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    });

    window.addEventListener('load', refreshOpenFaqHeights);
    window.addEventListener('resize', refreshOpenFaqHeights);

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(refreshOpenFaqHeights).catch(function() {});
    }
});

// Nav scroll-spy: updates active menu item while scrolling on pages with same-page section anchors.
document.addEventListener('DOMContentLoaded', function() {
    const navMenu = document.getElementById('nav-menu') || document.getElementById('navMenu');
    if (!navMenu) return;

    const navLinks = Array.from(navMenu.querySelectorAll('.nav-link[href]'));
    if (!navLinks.length) return;

    function normalizePathname(pathname) {
        const clean = (pathname || '').replace(/\/+$/, '');
        if (!clean || clean === '/index.html') return '/';
        return clean;
    }

    const currentPath = normalizePathname(window.location.pathname);

    // Keep pre-set active state on pages where menu links lead to another page (e.g. service subpages).
    const trackedLinks = navLinks
        .map((link) => {
            const href = link.getAttribute('href');
            if (!href || !href.includes('#')) return null;

            const url = new URL(href, window.location.href);
            const samePage = normalizePathname(url.pathname) === currentPath;
            if (!samePage || !url.hash || url.hash === '#') return null;

            const targetId = decodeURIComponent(url.hash.slice(1));
            const target = document.getElementById(targetId);
            if (!target) return null;

            return { link, target };
        })
        .filter(Boolean);

    if (!trackedLinks.length) return;

    const headerEl = document.querySelector('.header');
    let ticking = false;

    function clearAllNavActive() {
        navMenu.querySelectorAll('.nav-link').forEach((link) => {
            link.classList.remove('nav-link--active');
            link.removeAttribute('aria-current');
        });
    }

    function setActiveLink(link) {
        clearAllNavActive();
        if (!link) return;
        link.classList.add('nav-link--active');
        link.setAttribute('aria-current', 'page');
    }

    function updateActiveNavByScroll() {
        const headerOffset = headerEl ? headerEl.offsetHeight + 20 : 100;
        const probeY = window.scrollY + headerOffset;

        let active = null;
        for (const item of trackedLinks) {
            if (item.target.offsetTop <= probeY) {
                active = item;
            }
        }

        if (active && active.link) {
            setActiveLink(active.link);
            return;
        }

        setActiveLink(null);
    }

    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            updateActiveNavByScroll();
            ticking = false;
        });
    }

    function scheduleActiveUpdate() {
        requestAnimationFrame(() => {
            updateActiveNavByScroll();
        });
    }

    updateActiveNavByScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateActiveNavByScroll);
    window.addEventListener('hashchange', scheduleActiveUpdate);

    trackedLinks.forEach(({ link }) => {
        link.addEventListener('click', () => {
            // Wait for native anchor jump, then re-evaluate active item.
            setTimeout(scheduleActiveUpdate, 0);
            setTimeout(scheduleActiveUpdate, 140);
        });
    });
});

try {
    const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:';
    if (isDev) {
        window.clearSiteCache = function() {
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                    location.reload(true);
                });
            }
        };
    }
} catch (_) {}

// Floating CTA
document.addEventListener('DOMContentLoaded', function() {
    const floatingCta = document.getElementById('floatingCta');

    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const heroHeight = document.querySelector('.hero').offsetHeight || 600;
        floatingCta.classList.toggle('visible', scrolled > heroHeight / 2);
    });

    floatingCta.addEventListener('click', function(e) {
        e.preventDefault();
        const bookingOverlay = document.getElementById('bookingOverlay');
        if (bookingOverlay) {
            bookingOverlay.classList.add('active');
            setTimeout(function() {
                const nameInput = document.getElementById('bookingPopupName');
                if (nameInput) nameInput.focus();
            }, 100);
            return;
        }
        scrollToBookingSection();
    });
});

// Callback Form Modal
document.addEventListener('DOMContentLoaded', function() {
    const callbackOverlay = document.getElementById('callbackOverlay');
    const closeCallbackBtn = document.getElementById('closeCallbackPopup');
    const callbackForm = document.getElementById('callbackForm');
    const callbackPhone = document.getElementById('callbackPhone');
    const openCallbackButtons = document.querySelectorAll('.open-callback');

    if (!callbackOverlay || !closeCallbackBtn || !callbackForm || !callbackPhone) return;

    const callbackFocusTrap = createFocusTrap(callbackOverlay);
    let callbackTrigger = null;

    function openCallbackOverlay(triggerEl) {
        callbackTrigger = triggerEl || document.activeElement;
        callbackOverlay.classList.add('active');
        callbackFocusTrap.activate();
        setTimeout(function() { callbackPhone.focus(); }, 100);
    }

    function closeCallbackOverlay() {
        callbackOverlay.classList.remove('active');
        callbackFocusTrap.deactivate();
        if (callbackTrigger && typeof callbackTrigger.focus === 'function') {
            callbackTrigger.focus();
            callbackTrigger = null;
        }
    }

    openCallbackButtons.forEach(function(btn) {
        btn.addEventListener('click', function() { openCallbackOverlay(btn); });
    });

    closeCallbackBtn.addEventListener('click', closeCallbackOverlay);

    callbackOverlay.addEventListener('click', function(e) {
        if (e.target === callbackOverlay) closeCallbackOverlay();
    });

    callbackOverlay.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeCallbackOverlay();
    });

    callbackPhone.addEventListener('input', function(e) {
        e.target.value = formatPhoneValue(e.target.value);
    });

    callbackForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const phone = callbackPhone.value;
        const phoneDigits = phone.replace(/\D/g, '');
        const phoneError = document.getElementById('callbackPhoneError');

        if (phoneDigits.length !== 12 || !phoneDigits.startsWith('380')) {
            phoneError.textContent = 'Введіть коректний номер телефону';
            return;
        }
        phoneError.textContent = '';

        const submitBtn = callbackForm.querySelector('.btn-callback-submit');
        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').style.display = 'none';
        submitBtn.querySelector('.btn-loader').style.display = 'inline-flex';

        try {
            await sendFormRequest({
                name: 'Зворотний дзвінок',
                phone: phone,
                service: 'callback',
                comment: 'Запит на зворотний дзвінок',
                website: ''
            });

            callbackForm.reset();
            redirectToThankYou();
        } catch (error) {
            phoneError.textContent = error?.userMessage || 'Помилка відправки. Спробуйте ще раз.';
        } finally {
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-text').style.display = 'inline';
            submitBtn.querySelector('.btn-loader').style.display = 'none';
        }
    });
});

(function setFooterCopyright() {
    const el = document.getElementById('footerCopyright');
    if (el) el.textContent = `© ${new Date().getFullYear()} Dental Lab.`;
})();

// Promo Timer - countdown to end of May
(function initPromoTimer() {
    const timerElement = document.getElementById('promoTimer');
    if (!timerElement) return;

    function updateTimer() {
        const now = new Date();
        const endDate = new Date(2026, 4, 31, 23, 59, 59); // May 31, 2026, 23:59:59
        
        // If timer expired, hide it
        if (now >= endDate) {
            timerElement.style.display = 'none';
            return;
        }

        const diff = endDate - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        const daysEl = timerElement.querySelector('[data-type="days"]');
        const hoursEl = timerElement.querySelector('[data-type="hours"]');
        const minutesEl = timerElement.querySelector('[data-type="minutes"]');

        if (!daysEl || !hoursEl || !minutesEl) return;

        daysEl.textContent = String(days).padStart(2, '0');
        hoursEl.textContent = String(hours).padStart(2, '0');
        minutesEl.textContent = String(minutes).padStart(2, '0');
    }

    // Initial update
    updateTimer();
    // Update every minute
    setInterval(updateTimer, 60000);
})();
