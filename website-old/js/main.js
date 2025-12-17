/* =========================================
   SNOW-FLOW MODERN BLACK/WHITE JAVASCRIPT
   =========================================
   Version: 3.0.0
   Theme: Minimalist Black/White with Animations
   ========================================= */

document.addEventListener('DOMContentLoaded', function() {
    
    /* =========================================
       1. GLASS MORPHISM NAVBAR
       ========================================= */
    const navbar = document.querySelector('.navbar');
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.navbar-menu');
    let lastScroll = 0;

    // Mobile Navigation Toggle
    if (hamburger) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
            
            // Animate hamburger lines
            const spans = hamburger.querySelectorAll('span');
            if (navMenu.classList.contains('active')) {
                spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
            } else {
                spans[0].style.transform = 'none';
                spans[1].style.opacity = '1';
                spans[2].style.transform = 'none';
            }
        });
    }

    // Glass Morphism on Scroll
    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Hide/Show navbar on scroll
        if (currentScroll > lastScroll && currentScroll > 500) {
            navbar.style.transform = 'translateY(-100%)';
        } else {
            navbar.style.transform = 'translateY(0)';
        }
        
        lastScroll = currentScroll;
    });

    /* =========================================
       2. SMOOTH SCROLLING
       ========================================= */
    const navLinks = document.querySelectorAll('.navbar-link, .nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    const offset = 80; // Height of navbar
                    const targetPosition = target.offsetTop - offset;
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                    
                    // Close mobile menu if open
                    navMenu.classList.remove('active');
                    hamburger?.classList.remove('active');
                }
            }
        });
    });

    /* =========================================
       3. HERO SECTION ANIMATIONS
       ========================================= */
    const hero = document.querySelector('.hero');
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    
    // Parallax effect DISABLED - was causing section overlap
    if (hero) {
        // DISABLED: This was the source of translateY(290.5px) during scroll
        // window.addEventListener('scroll', function() {
        //     const scrolled = window.pageYOffset;
        //     const parallaxSpeed = 0.5;
        //     hero.style.transform = `translateY(${scrolled * parallaxSpeed}px)`;
        // });
        
        // Keep hero static - no transform during scroll
        hero.style.transform = 'translateY(0px)';
    }

    // Typewriter effect for hero subtitle
    if (heroSubtitle) {
        const text = heroSubtitle.textContent;
        heroSubtitle.textContent = '';
        let i = 0;
        
        function typeWriter() {
            if (i < text.length) {
                heroSubtitle.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, 50);
            }
        }
        
        setTimeout(typeWriter, 1000);
    }

    /* =========================================
       4. INTERSECTION OBSERVER ANIMATIONS
       ========================================= */
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                
                // Add stagger effect for children
                const children = entry.target.querySelectorAll('.stagger-item');
                children.forEach((child, index) => {
                    setTimeout(() => {
                        child.classList.add('visible');
                    }, index * 100);
                });
            }
        });
    }, observerOptions);

    // Observe all animated elements
    const animatedElements = document.querySelectorAll('.animate-fade-in-up, .animate-fade-in-down, .animate-scale-in, .animate-slide-in-left, .animate-slide-in-right, .card, .feature, .section');
    animatedElements.forEach(el => {
        observer.observe(el);
    });

    /* =========================================
       5. CARD HOVER EFFECTS
       ========================================= */
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.style.setProperty('--mouse-x', `${x}px`);
            this.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    /* =========================================
       6. BUTTON CLICK HANDLERS & SMOOTH SCROLL
       ========================================= */
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
        // Only add click handler for buttons with href starting with #
        const href = btn.getAttribute('href');
        if (href && href.startsWith('#')) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    const offset = 80; // Navbar height
                    const targetPosition = targetElement.offsetTop - offset;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
                
                // Add subtle click feedback
                this.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
            });
        }
        
        // Prevent the shimmer effect from getting too big
        btn.addEventListener('mouseenter', function() {
            this.style.transition = 'all 200ms ease';
        });
        
        btn.addEventListener('mouseleave', function() {
            this.style.transition = '';
        });
    });

    /* =========================================
       7. COPY TO CLIPBOARD
       ========================================= */
    const copyButtons = document.querySelectorAll('.copy-btn');
    copyButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const codeBlock = this.parentElement.querySelector('code');
            const text = codeBlock.textContent;
            
            navigator.clipboard.writeText(text).then(() => {
                const originalText = this.textContent;
                this.textContent = '✓ Copied!';
                this.style.color = 'var(--white)';
                
                setTimeout(() => {
                    this.textContent = originalText;
                    this.style.color = '';
                }, 2000);
            });
        });
    });

    /* =========================================
       8. DOCUMENTATION TAB FUNCTIONALITY
       ========================================= */
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Remove active class from all tabs and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            this.classList.add('active');
            const activeContent = document.getElementById(tabName);
            if (activeContent) {
                activeContent.classList.add('active');
                activeContent.classList.add('animate-fade-in-up');
            }
            
            // Smooth scroll to docs section if not visible
            const docsSection = document.getElementById('docs');
            if (docsSection) {
                const rect = docsSection.getBoundingClientRect();
                if (rect.top < 0 || rect.bottom > window.innerHeight) {
                    docsSection.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });
                }
            }
        });
    });

    // Initialize first tab as active
    if (tabBtns.length > 0 && tabContents.length > 0) {
        const firstTab = tabBtns[0];
        const firstContent = document.getElementById(firstTab.getAttribute('data-tab'));
        
        if (!firstTab.classList.contains('active')) {
            firstTab.classList.add('active');
        }
        if (firstContent && !firstContent.classList.contains('active')) {
            firstContent.classList.add('active');
        }
    }

    /* =========================================
       9. SEARCH FUNCTIONALITY
       ========================================= */
    const searchInput = document.querySelector('.search-input');
    const searchResults = document.querySelector('.search-results');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const query = this.value.toLowerCase();
            
            if (query.length > 2) {
                // Simulate search results
                searchResults.classList.add('active');
                searchResults.innerHTML = `
                    <div class="search-result">
                        <span class="search-result-title">Getting Started with Snow-Flow</span>
                        <span class="search-result-description">Learn how to install and configure Snow-Flow</span>
                    </div>
                    <div class="search-result">
                        <span class="search-result-title">MCP Server Integration</span>
                        <span class="search-result-description">Complete guide to MCP server setup</span>
                    </div>
                `;
            } else {
                searchResults.classList.remove('active');
            }
        });
        
        // Close search results when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.remove('active');
            }
        });
    }

    /* =========================================
       10. LOADING ANIMATIONS
       ========================================= */
    // Simulate loading for demo
    const loadingElements = document.querySelectorAll('[data-loading]');
    loadingElements.forEach(el => {
        setTimeout(() => {
            el.classList.remove('skeleton');
            el.classList.add('animate-fade-in-up');
        }, Math.random() * 2000 + 500);
    });

    /* =========================================
       11. PARTICLE BACKGROUND (SUBTLE)
       ========================================= */
    function createParticle() {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = Math.random() * 20 + 10 + 's';
        particle.style.opacity = Math.random() * 0.5;
        particle.style.animationDelay = Math.random() * 5 + 's';
        
        document.querySelector('.hero')?.appendChild(particle);
        
        setTimeout(() => {
            particle.remove();
        }, 30000);
    }
    
    // Create particles periodically
    if (document.querySelector('.hero')) {
        setInterval(createParticle, 3000);
        
        // Create initial particles
        for (let i = 0; i < 5; i++) {
            setTimeout(createParticle, i * 500);
        }
    }

    /* =========================================
       12. CONSOLE EASTER EGG
       ========================================= */
    console.log('%c🏔️ Snow-Flow', 'font-size: 50px; font-weight: bold; background: linear-gradient(135deg, #000 0%, #fff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;');
    console.log('%cWelcome to Snow-Flow - The ServiceNow Development Revolution', 'font-size: 14px; color: #666;');
    console.log('%c23 Enterprise MCP Servers | 355+ Tools | Unlimited Possibilities', 'font-size: 12px; color: #999;');

    /* =========================================
       COUNTER ANIMATION (MISSING!)
       ========================================= */
    function animateCounter(element, target, duration = 2000) {
        const start = 0;
        let numericTarget;
        
        // Parse target value (handle numbers, percentages, plus signs)
        if (typeof target === 'string') {
            if (target.includes('%')) {
                numericTarget = parseInt(target.replace('%', ''));
            } else if (target.includes('+')) {
                numericTarget = parseInt(target.replace('+', ''));
            } else {
                numericTarget = parseInt(target);
            }
        } else {
            numericTarget = parseInt(target);
        }
        
        const increment = numericTarget / (duration / 16); // 60fps
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= numericTarget) {
                element.textContent = target; // Use original target with symbols
                clearInterval(timer);
            } else {
                // Display current value with appropriate symbols
                if (typeof target === 'string' && target.includes('+')) {
                    element.textContent = Math.floor(current) + '+';
                } else if (typeof target === 'string' && target.includes('%')) {
                    element.textContent = Math.floor(current) + '%';
                } else {
                    element.textContent = Math.floor(current);
                }
            }
        }, 16);
    }
    
    // Initialize counters when they come into view
    const counters = document.querySelectorAll('.counter');
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = counter.getAttribute('data-target');
                
                // Start animation
                animateCounter(counter, target, 2000);
                
                // Only animate once
                counterObserver.unobserve(counter);
            }
        });
    }, { threshold: 0.5 });
    
    counters.forEach(counter => {
        counterObserver.observe(counter);
    });
    console.log('%cJoin us: https://github.com/groeimetai/snow-flow', 'font-size: 12px; color: #666; text-decoration: underline;');

    /* =========================================
       13. PERFORMANCE OPTIMIZATION
       ========================================= */
    // Throttle scroll events
    let scrollTimeout;
    window.addEventListener('scroll', function() {
        if (scrollTimeout) {
            window.cancelAnimationFrame(scrollTimeout);
        }
        scrollTimeout = window.requestAnimationFrame(function() {
            // Handle scroll events
        });
    }, { passive: true });

    /* =========================================
       14. ACCESSIBILITY ENHANCEMENTS
       ========================================= */
    // Add keyboard navigation for interactive elements
    const interactiveElements = document.querySelectorAll('.btn, .card, .tab-btn, .navbar-link');
    interactiveElements.forEach(el => {
        el.setAttribute('tabindex', '0');
        el.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    });

    // Skip to content link
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.className = 'skip-to-content';
    skipLink.textContent = 'Skip to content';
    document.body.insertBefore(skipLink, document.body.firstChild);

    /* =========================================
       15. INITIALIZATION COMPLETE
       ========================================= */
    document.body.classList.add('loaded');
    console.log('✨ Snow-Flow initialized successfully');
});

/* =========================================
   16. UTILITY FUNCTIONS
   ========================================= */
// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Check if element is in viewport
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

/* =========================================
   END OF SNOW-FLOW JAVASCRIPT
   ========================================= */