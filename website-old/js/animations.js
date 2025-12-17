/**
 * SNOW-FLOW ADVANCED ANIMATION SYSTEM
 * Sophisticated animations and interactions using modern APIs
 * Optimized for performance with IntersectionObserver
 */

class SnowFlowAnimations {
    constructor() {
        this.init();
        this.observers = [];
        this.animationQueue = [];
        this.isAnimating = false;
        this.scrollProgress = 0;
        this.lastScrollPosition = 0;
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupAnimations());
        } else {
            this.setupAnimations();
        }
    }

    setupAnimations() {
        this.createScrollProgress();
        this.setupScrollAnimations();
        this.setupParallaxEffects();
        this.setupHoverAnimations();
        this.setupLoadingAnimations();
        this.setupMicroInteractions();
        this.setupBackgroundAnimations();
        this.setupPerformanceOptimizations();
        this.handleReducedMotion();
        
        // Initialize on load
        window.addEventListener('load', () => {
            this.triggerEntranceAnimations();
            this.optimizeAnimations();
        });

        console.log('🎭 Snow-Flow Animation System Initialized');
    }

    /**
     * SCROLL PROGRESS INDICATOR
     */
    createScrollProgress() {
        // Create progress bar element
        const progressBar = document.createElement('div');
        progressBar.className = 'scroll-progress';
        progressBar.innerHTML = '<div class="scroll-progress-fill"></div>';
        document.body.appendChild(progressBar);

        const progressFill = progressBar.querySelector('.scroll-progress-fill');

        // Update progress on scroll
        const updateProgress = () => {
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (winScroll / height) * 100;
            
            progressFill.style.width = `${scrolled}%`;
            this.scrollProgress = scrolled;
        };

        // Throttled scroll listener
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    updateProgress();
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    /**
     * SCROLL ANIMATIONS WITH INTERSECTION OBSERVER
     */
    setupScrollAnimations() {
        // Enhanced intersection observer options
        const observerOptions = {
            root: null,
            rootMargin: '-50px 0px -100px 0px',
            threshold: [0.1, 0.3, 0.5, 0.7, 1.0]
        };

        // Main scroll animation observer
        const scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const element = entry.target;
                const intersectionRatio = entry.intersectionRatio;

                if (entry.isIntersecting) {
                    // Add reveal class with stagger timing
                    const delay = this.calculateStaggerDelay(element);
                    setTimeout(() => {
                        element.classList.add('revealed');
                        this.triggerCustomAnimation(element);
                    }, delay);
                    
                    // Progressive reveal based on intersection ratio
                    element.style.opacity = Math.min(intersectionRatio * 2, 1);
                }
            });
        }, observerOptions);

        // Observe scroll reveal elements
        const scrollElements = document.querySelectorAll([
            '.scroll-reveal',
            '.scroll-reveal-left',
            '.scroll-reveal-right',
            '.feature',
            '.mcp-card',
            '.what-is-card',
            '.workflow-step',
            '.example-card',
            '.practice'
        ].join(','));

        scrollElements.forEach(el => {
            el.classList.add('gpu-accelerated');
            scrollObserver.observe(el);
        });

        this.observers.push(scrollObserver);
    }

    /**
     * PARALLAX EFFECTS
     */
    setupParallaxEffects() {
        // PARALLAX COMPLETELY DISABLED to prevent section overlap
        const parallaxElements = document.querySelectorAll('.hero-parallax, .gradient-mesh, .particles');
        
        // DISABLED: All parallax transforms that cause section overlap
        // const updateParallax = () => {
        //     const scrolled = window.pageYOffset;
        //     const rate = scrolled * -0.5;
        //     parallaxElements.forEach(element => {
        //         if (this.isInViewport(element)) {
        //             const speed = element.dataset.speed || 0.5;
        //             const yPos = -(scrolled * speed);
        //             element.style.transform = `translate3d(0, ${yPos}px, 0)`;
        //         }
        //     });
        // };

        // Keep all parallax elements static - no translateY
        parallaxElements.forEach(element => {
            element.style.transform = 'translate3d(0, 0px, 0)'; // Static positioning
        });
        
        // NO scroll listener for parallax to prevent transforms
        console.log('🚫 All parallax effects disabled - no translateY transforms');
    }

    /**
     * ENTRANCE ANIMATIONS
     */
    triggerEntranceAnimations() {
        // Hero section animation
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            heroContent.classList.add('animate-fade-in-up');
        }

        // Stagger navigation items
        const navItems = document.querySelectorAll('.nav-link');
        navItems.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('animate-fade-in-down');
            }, index * 100);
        });

        // Stats counter animation
        this.animateCounters();
    }

    /**
     * HOVER ANIMATIONS AND EFFECTS
     */
    setupHoverAnimations() {
        // Enhanced button animations
        const buttons = document.querySelectorAll('.btn, button, .nav-link');
        buttons.forEach(btn => {
            btn.classList.add('btn-animated', 'ripple-effect');
            
            // Add magnetic effect for larger screens
            if (window.innerWidth > 768) {
                this.addMagneticEffect(btn);
            }
        });

        // Card hover effects
        const cards = document.querySelectorAll('.feature, .mcp-card, .what-is-card, .example-card, .practice');
        cards.forEach(card => {
            card.classList.add('card-hover', 'gpu-accelerated');
            
            // Add tilt effect
            this.addTiltEffect(card);
        });

        // Text gradient animations
        const gradientTexts = document.querySelectorAll('.hero-title, .section-title, .brand-name');
        gradientTexts.forEach(text => {
            text.classList.add('text-gradient-animated');
        });

        // Icon animations
        const icons = document.querySelectorAll('.feature-icon, .card-icon');
        icons.forEach(icon => {
            icon.classList.add('icon-scale');
        });
    }

    /**
     * LOADING STATES AND SKELETON SCREENS
     */
    setupLoadingAnimations() {
        // Create skeleton loading for dynamic content
        this.createSkeletonLoaders();
        
        // Progress bar animations
        const progressBars = document.querySelectorAll('.progress-bar');
        progressBars.forEach(bar => {
            const fill = bar.querySelector('.progress-fill');
            if (fill) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            fill.style.width = fill.dataset.width || '100%';
                        }
                    });
                });
                observer.observe(bar);
            }
        });

        // Spinner variations for async operations
        this.createSpinners();
    }

    /**
     * MICRO-INTERACTIONS
     */
    setupMicroInteractions() {
        // Form field animations
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.classList.add('input-animated');
            
            // Focus animations
            input.addEventListener('focus', () => {
                input.parentElement?.classList.add('focused');
            });
            
            input.addEventListener('blur', () => {
                input.parentElement?.classList.remove('focused');
            });
        });

        // Toggle switches
        this.setupToggleSwitches();

        // Tooltip interactions
        this.setupTooltips();

        // Copy code interactions
        this.enhanceCopyButtons();
    }

    /**
     * BACKGROUND ANIMATIONS
     */
    setupBackgroundAnimations() {
        // Add gradient mesh to hero
        const hero = document.querySelector('.hero');
        if (hero && !hero.querySelector('.gradient-mesh')) {
            const mesh = document.createElement('div');
            mesh.className = 'gradient-mesh';
            hero.appendChild(mesh);
        }

        // Add particles to sections
        this.addParticleEffects();

        // Wave patterns for section breaks
        this.addWavePatterns();

        // Noise overlay for texture
        this.addNoiseOverlay();
    }

    /**
     * PERFORMANCE OPTIMIZATIONS
     */
    setupPerformanceOptimizations() {
        // Use Intersection Observer for expensive animations
        const expensiveAnimations = document.querySelectorAll('.morphing, .text-glow, .particles');
        
        const performanceObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate');
                } else {
                    entry.target.classList.remove('animate');
                }
            });
        }, { rootMargin: '50px' });

        expensiveAnimations.forEach(el => {
            performanceObserver.observe(el);
        });

        // Throttle resize events
        this.setupResponsiveAnimations();
        
        // Preload critical animations
        this.preloadAnimations();
    }

    /**
     * UTILITY METHODS
     */
    
    calculateStaggerDelay(element) {
        const parent = element.parentElement;
        if (!parent) return 0;
        
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(element);
        return Math.min(index * 100, 800); // Max 800ms delay
    }

    triggerCustomAnimation(element) {
        const animationType = element.dataset.animation;
        if (!animationType) return;

        const animations = {
            'bounce': () => element.classList.add('animate-bounce'),
            'scale': () => element.classList.add('animate-scale-in'),
            'slide-up': () => element.classList.add('animate-slide-in-bottom'),
            'slide-down': () => element.classList.add('animate-slide-in-top'),
            'fade-left': () => element.classList.add('animate-fade-in-left'),
            'fade-right': () => element.classList.add('animate-fade-in-right')
        };

        if (animations[animationType]) {
            animations[animationType]();
        }
    }

    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top < window.innerHeight &&
            rect.bottom > 0
        );
    }

    addMagneticEffect(element) {
        element.addEventListener('mousemove', (e) => {
            const rect = element.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            element.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
        });

        element.addEventListener('mouseleave', () => {
            element.style.transform = '';
        });
    }

    addTiltEffect(card) {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    }

    animateCounters() {
        const counters = document.querySelectorAll('.stat-number');
        
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                    this.animateCounter(entry.target);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(counter => {
            counterObserver.observe(counter);
        });
    }

    animateCounter(counter) {
        counter.classList.add('counted');
        const target = parseInt(counter.textContent.replace(/\D/g, ''));
        const suffix = counter.textContent.replace(/\d/g, '');
        const duration = 2000;
        const increment = target / (duration / 16);
        let current = 0;

        const updateCounter = () => {
            current += increment;
            if (current >= target) {
                counter.textContent = target + suffix;
            } else {
                counter.textContent = Math.floor(current) + suffix;
                requestAnimationFrame(updateCounter);
            }
        };

        updateCounter();
    }

    createSkeletonLoaders() {
        const skeletonContainer = document.createElement('div');
        skeletonContainer.className = 'skeleton-container';
        skeletonContainer.innerHTML = `
            <div class="skeleton skeleton-card"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 60%;"></div>
        `;
        
        // Add to body but keep hidden initially
        skeletonContainer.style.display = 'none';
        document.body.appendChild(skeletonContainer);
    }

    createSpinners() {
        // Dots spinner
        const dotsSpinner = document.createElement('div');
        dotsSpinner.className = 'spinner-dots';
        dotsSpinner.innerHTML = '<div></div><div></div><div></div>';
        
        // Rotate spinner
        const rotateSpinner = document.createElement('div');
        rotateSpinner.className = 'spinner-rotate';
        
        // Store references for later use
        this.spinners = { dots: dotsSpinner, rotate: rotateSpinner };
    }

    setupToggleSwitches() {
        const toggles = document.querySelectorAll('.toggle-switch, [data-toggle]');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('active');
                
                // Trigger custom event
                toggle.dispatchEvent(new CustomEvent('toggle', {
                    detail: { active: toggle.classList.contains('active') }
                }));
            });
        });
    }

    setupTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            element.classList.add('tooltip');
        });
    }

    enhanceCopyButtons() {
        const copyButtons = document.querySelectorAll('.copy-btn');
        copyButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Add success animation
                btn.classList.add('success-animation');
                setTimeout(() => {
                    btn.classList.remove('success-animation');
                }, 2000);
            });
        });
    }

    addParticleEffects() {
        const sections = document.querySelectorAll('.hero, .features');
        sections.forEach(section => {
            if (!section.querySelector('.particles')) {
                const particles = document.createElement('div');
                particles.className = 'particles';
                particles.innerHTML = `
                    <div class="particle particle-1"></div>
                    <div class="particle particle-2"></div>
                    <div class="particle particle-3"></div>
                `;
                section.appendChild(particles);
            }
        });
    }

    addWavePatterns() {
        const sections = document.querySelectorAll('section');
        sections.forEach((section, index) => {
            if (index % 2 === 1 && !section.querySelector('.wave-bg')) {
                const wave = document.createElement('div');
                wave.className = 'wave-bg';
                section.appendChild(wave);
            }
        });
    }

    addNoiseOverlay() {
        const hero = document.querySelector('.hero');
        if (hero && !hero.querySelector('.noise-overlay')) {
            const noise = document.createElement('div');
            noise.className = 'noise-overlay';
            hero.appendChild(noise);
        }
    }

    setupResponsiveAnimations() {
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.handleResponsiveAnimations();
            }, 250);
        });
    }

    handleResponsiveAnimations() {
        const isMobile = window.innerWidth < 768;
        const animations = document.querySelectorAll('[class*="animate"]');
        
        animations.forEach(element => {
            if (isMobile) {
                element.style.animationDuration = '0.4s';
            } else {
                element.style.animationDuration = '';
            }
        });
    }

    preloadAnimations() {
        // Preload critical CSS animations
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = 'css/animations.css';
        link.as = 'style';
        document.head.appendChild(link);
    }

    optimizeAnimations() {
        // Enable GPU acceleration for animated elements
        const animatedElements = document.querySelectorAll([
            '[class*="animate"]',
            '.card-hover',
            '.btn-animated',
            '.scroll-reveal'
        ].join(','));

        animatedElements.forEach(element => {
            element.classList.add('gpu-accelerated');
        });
    }

    handleReducedMotion() {
        // Respect user's motion preferences
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        
        if (prefersReducedMotion.matches) {
            document.documentElement.style.setProperty('--animation-duration', '0.01ms');
            document.documentElement.style.setProperty('--transition-duration', '0.01ms');
        }

        // Listen for changes
        prefersReducedMotion.addEventListener('change', () => {
            if (prefersReducedMotion.matches) {
                document.documentElement.style.setProperty('--animation-duration', '0.01ms');
            } else {
                document.documentElement.style.removeProperty('--animation-duration');
            }
        });
    }

    /**
     * PUBLIC API METHODS
     */

    // Show loading spinner
    showSpinner(type = 'rotate', container = document.body) {
        const spinner = this.spinners[type].cloneNode(true);
        spinner.classList.add('active-spinner');
        container.appendChild(spinner);
        return spinner;
    }

    // Hide spinner
    hideSpinner(spinner) {
        if (spinner && spinner.parentNode) {
            spinner.remove();
        }
    }

    // Trigger custom animation on element
    animate(element, animation, options = {}) {
        const { delay = 0, duration = 600, easing = 'ease' } = options;
        
        element.style.animationDelay = `${delay}ms`;
        element.style.animationDuration = `${duration}ms`;
        element.style.animationTimingFunction = easing;
        
        element.classList.add(`animate-${animation}`);
        
        // Return promise that resolves when animation ends
        return new Promise(resolve => {
            element.addEventListener('animationend', resolve, { once: true });
        });
    }

    // Batch animate multiple elements
    animateBatch(elements, animation, stagger = 100) {
        const promises = [];
        elements.forEach((element, index) => {
            const promise = this.animate(element, animation, { delay: index * stagger });
            promises.push(promise);
        });
        return Promise.all(promises);
    }

    // Destroy animations and observers
    destroy() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
        
        // Remove event listeners
        window.removeEventListener('scroll', this.updateProgress);
        window.removeEventListener('resize', this.handleResponsiveAnimations);
        
        console.log('🎭 Snow-Flow Animation System Destroyed');
    }
}

// Initialize the animation system
const snowFlowAnimations = new SnowFlowAnimations();

// Export for global access
window.SnowFlowAnimations = snowFlowAnimations;

// Add some additional CSS styles dynamically for the scroll progress
const additionalStyles = `
    .scroll-progress {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 4px;
        background: rgba(0, 102, 204, 0.1);
        z-index: 9999;
        pointer-events: none;
    }
    
    .scroll-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #0066cc, #00d4ff);
        width: 0%;
        transition: width 0.1s ease;
        box-shadow: 0 0 10px rgba(0, 102, 204, 0.3);
    }
    
    .success-animation {
        animation: pulse 0.3s ease-in-out;
        background: #48bb78 !important;
        border-color: #48bb78 !important;
    }
    
    .active-spinner {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10000;
    }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);