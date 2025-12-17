// Snow-Flow Navigation Component JavaScript

class SnowFlowNavigation {
    constructor(options = {}) {
        this.nav = document.getElementById(options.navId || 'sf-navigation');
        this.menu = document.getElementById(options.menuId || 'sf-nav-menu');
        this.hamburger = document.getElementById(options.hamburgerId || 'sf-nav-hamburger');
        this.progressBar = document.getElementById(options.progressId || 'sf-progress-bar');
        this.brand = document.getElementById(options.brandId || 'sf-nav-brand');
        
        this.isOpen = false;
        this.activeSection = 'home';
        this.scrollThreshold = options.scrollThreshold || 50;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateActiveSection();
        this.updateProgressBar();
    }

    bindEvents() {
        // Mobile menu toggle
        if (this.hamburger) {
            this.hamburger.addEventListener('click', () => this.toggleMobileMenu());
        }

        // Navigation link clicks
        const navLinks = this.nav.querySelectorAll('.sf-nav__link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => this.handleNavClick(e, link));
        });

        // Brand click
        if (this.brand) {
            this.brand.addEventListener('click', (e) => this.handleNavClick(e, this.brand, '#home'));
        }

        // Scroll events
        window.addEventListener('scroll', () => {
            this.handleScroll();
        });

        // Resize events
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768 && this.isOpen) {
                this.closeMobileMenu();
            }
        });

        // Close mobile menu on outside click
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.nav.contains(e.target)) {
                this.closeMobileMenu();
            }
        });

        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeMobileMenu();
            }
        });
    }

    toggleMobileMenu() {
        if (this.isOpen) {
            this.closeMobileMenu();
        } else {
            this.openMobileMenu();
        }
    }

    openMobileMenu() {
        this.isOpen = true;
        this.menu.classList.add('sf-nav__menu--open');
        this.hamburger.classList.add('sf-nav__hamburger--open');
        this.hamburger.setAttribute('aria-expanded', 'true');
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Focus management for accessibility
        setTimeout(() => {
            const firstLink = this.menu.querySelector('.sf-nav__link');
            if (firstLink) firstLink.focus();
        }, 300);
    }

    closeMobileMenu() {
        this.isOpen = false;
        this.menu.classList.remove('sf-nav__menu--open');
        this.hamburger.classList.remove('sf-nav__hamburger--open');
        this.hamburger.setAttribute('aria-expanded', 'false');
        
        // Restore body scroll
        document.body.style.overflow = '';
    }

    handleNavClick(e, element, customHref = null) {
        e.preventDefault();
        
        const href = customHref || element.getAttribute('href');
        this.closeMobileMenu();
        
        if (href && href.startsWith('#')) {
            this.smoothScrollTo(href);
        }
    }

    smoothScrollTo(target) {
        const element = document.querySelector(target);
        if (element) {
            const offset = 80; // Account for fixed navbar
            const targetPosition = element.offsetTop - offset;
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    }

    handleScroll() {
        const scrollTop = window.pageYOffset;
        
        // Update navbar appearance on scroll
        if (scrollTop > this.scrollThreshold) {
            this.nav.classList.add('sf-nav--scrolled');
        } else {
            this.nav.classList.remove('sf-nav--scrolled');
        }
        
        // Update active section
        this.updateActiveSection();
        
        // Update progress bar
        this.updateProgressBar();
    }

    updateActiveSection() {
        const sections = document.querySelectorAll('section[id]');
        const scrollTop = window.pageYOffset;
        let current = 'home';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            
            if (scrollTop >= sectionTop - 100 && scrollTop < sectionTop + sectionHeight - 100) {
                current = section.getAttribute('id');
            }
        });
        
        if (current !== this.activeSection) {
            this.activeSection = current;
            this.updateActiveNavLink();
        }
    }

    updateActiveNavLink() {
        const navLinks = this.nav.querySelectorAll('.sf-nav__link');
        
        navLinks.forEach(link => {
            const linkSection = link.getAttribute('data-section') || 
                               link.getAttribute('href')?.replace('#', '');
            
            if (linkSection === this.activeSection) {
                link.classList.add('sf-nav__link--active');
            } else {
                link.classList.remove('sf-nav__link--active');
            }
        });
    }

    updateProgressBar() {
        if (!this.progressBar) return;
        
        const scrollTop = window.pageYOffset;
        const documentHeight = document.documentElement.scrollHeight;
        const windowHeight = window.innerHeight;
        const progress = Math.min(100, (scrollTop / (documentHeight - windowHeight)) * 100);
        
        this.progressBar.style.width = `${progress}%`;
    }

    // Public API methods
    setActiveSection(sectionId) {
        this.activeSection = sectionId;
        this.updateActiveNavLink();
    }

    scrollToSection(sectionId) {
        this.smoothScrollTo(`#${sectionId}`);
    }

    updateNavItems(newItems) {
        // Method to dynamically update navigation items
        const menuHTML = newItems.map((item, index) => `
            <li class="sf-nav__item">
                <a href="${item.href}" class="sf-nav__link" data-section="${item.href.replace('#', '')}">
                    ${item.label}
                    <span class="sf-nav__link-indicator"></span>
                </a>
            </li>
        `).join('');
        
        // Add CTA button
        const ctaHTML = `
            <li class="sf-nav__item">
                <a href="#get-started" class="sf-nav__cta">Get Started</a>
            </li>
        `;
        
        this.menu.innerHTML = menuHTML + ctaHTML;
        
        // Rebind events for new links
        const navLinks = this.nav.querySelectorAll('.sf-nav__link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => this.handleNavClick(e, link));
        });
    }

    destroy() {
        // Cleanup method
        this.closeMobileMenu();
        // Remove event listeners if needed
    }
}

// Auto-initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if navigation exists before initializing
    const navElement = document.getElementById('sf-navigation');
    if (navElement) {
        window.snowFlowNav = new SnowFlowNavigation();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SnowFlowNavigation;
}

// Global access
window.SnowFlowNavigation = SnowFlowNavigation;