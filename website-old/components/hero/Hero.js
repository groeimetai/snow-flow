// Snow-Flow Hero Component JavaScript

class SnowFlowHero {
    constructor(options = {}) {
        // Configuration
        this.config = {
            heroId: options.heroId || 'sf-hero',
            titleId: options.titleId || 'sf-hero-title',
            subtitleId: options.subtitleId || 'sf-hero-subtitle',
            descriptionId: options.descriptionId || 'sf-hero-description',
            actionsId: options.actionsId || 'sf-hero-actions',
            statsId: options.statsId || 'sf-hero-stats',
            scrollId: options.scrollId || 'sf-hero-scroll',
            meshId: options.meshId || 'sf-hero-mesh',
            
            // Content
            title: options.title || 'Snow-Flow',
            subtitle: options.subtitle || 'Advanced ServiceNow Development Framework',
            
            // Effects
            typewriterEffect: options.typewriterEffect !== false,
            backgroundAnimation: options.backgroundAnimation !== false,
            typewriterSpeed: {
                title: options.titleSpeed || 100,
                subtitle: options.subtitleSpeed || 50
            },
            
            // Animation states
            isVisible: false,
            titleComplete: false,
            subtitleComplete: false,
            descriptionVisible: false,
            actionsVisible: false,
            statsVisible: false,
            scrollVisible: false
        };

        // DOM elements
        this.elements = {
            hero: document.getElementById(this.config.heroId),
            title: document.getElementById(this.config.titleId),
            subtitle: document.getElementById(this.config.subtitleId),
            description: document.getElementById(this.config.descriptionId),
            actions: document.getElementById(this.config.actionsId),
            stats: document.getElementById(this.config.statsId),
            scroll: document.getElementById(this.config.scrollId),
            mesh: document.getElementById(this.config.meshId)
        };

        this.init();
    }

    init() {
        if (!this.elements.hero) {
            console.warn('SnowFlowHero: Hero element not found');
            return;
        }

        this.setupIntersectionObserver();
        this.setupEventListeners();
        this.generateMeshDots();
        this.setupProgressIndicator();
    }

    setupIntersectionObserver() {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !this.config.isVisible) {
                        this.config.isVisible = true;
                        this.startAnimations();
                    }
                });
            },
            { threshold: 0.1 }
        );

        observer.observe(this.elements.hero);
    }

    setupEventListeners() {
        // CTA Button clicks
        const primaryCTA = this.elements.hero.querySelector('#sf-hero-primary-cta');
        const secondaryCTA = this.elements.hero.querySelector('#sf-hero-secondary-cta');

        if (primaryCTA) {
            primaryCTA.addEventListener('click', (e) => {
                this.handleCTAClick(e, primaryCTA.getAttribute('data-href'));
            });
        }

        if (secondaryCTA) {
            secondaryCTA.addEventListener('click', (e) => {
                this.handleCTAClick(e, secondaryCTA.getAttribute('data-href'));
            });
        }

        // Scroll indicator click
        if (this.elements.scroll) {
            this.elements.scroll.addEventListener('click', () => {
                this.scrollToNextSection();
            });
        }

        // Keyboard accessibility
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const focusedElement = document.activeElement;
                if (focusedElement && focusedElement.classList.contains('sf-hero__cta')) {
                    e.preventDefault();
                    focusedElement.click();
                }
            }
        });
    }

    generateMeshDots() {
        if (!this.config.backgroundAnimation || !this.elements.mesh) return;

        // Clear existing dots
        this.elements.mesh.innerHTML = '';

        // Generate animated dots
        for (let i = 0; i < 50; i++) {
            const dot = document.createElement('div');
            dot.className = 'sf-hero__mesh-dot';
            dot.style.cssText = `
                animation-delay: ${Math.random() * 5}s;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
            `;
            this.elements.mesh.appendChild(dot);
        }
    }

    setupProgressIndicator() {
        // Update scroll progress for the scroll indicator
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            const progress = Math.min(scrolled / maxScroll, 1);
            
            // You can use this progress value for additional effects if needed
            this.updateScrollProgress(progress);
        });
    }

    updateScrollProgress(progress) {
        // Optional: Add scroll-based effects here
        // For example, changing the hero opacity as user scrolls
        if (this.elements.hero) {
            const opacity = Math.max(0.3, 1 - progress * 0.7);
            this.elements.hero.style.opacity = opacity;
        }
    }

    startAnimations() {
        // Add visible class to hero
        this.elements.hero.classList.add('sf-hero--visible');

        // Start typewriter effects
        if (this.config.typewriterEffect) {
            setTimeout(() => this.typewriteTitle(), 500);
        } else {
            // Set text immediately if typewriter is disabled
            this.elements.title.textContent = this.config.title;
            this.elements.subtitle.textContent = this.config.subtitle;
            this.config.titleComplete = true;
            this.config.subtitleComplete = true;
            this.showRemainingElements();
        }
    }

    typewriteTitle() {
        if (!this.elements.title) return;

        const title = this.config.title;
        let index = 0;

        const typeChar = () => {
            if (index < title.length) {
                this.elements.title.textContent = title.slice(0, index + 1);
                
                // Add cursor
                const cursor = document.createElement('span');
                cursor.className = 'sf-hero__cursor';
                cursor.textContent = '|';
                this.elements.title.appendChild(cursor);
                
                index++;
                setTimeout(typeChar, this.config.typewriterSpeed.title);
            } else {
                // Remove cursor and mark title complete
                const cursor = this.elements.title.querySelector('.sf-hero__cursor');
                if (cursor) cursor.remove();
                
                this.config.titleComplete = true;
                setTimeout(() => this.typewriteSubtitle(), 300);
            }
        };

        typeChar();
    }

    typewriteSubtitle() {
        if (!this.elements.subtitle) return;

        const subtitle = this.config.subtitle;
        let index = 0;

        const typeChar = () => {
            if (index < subtitle.length) {
                this.elements.subtitle.textContent = subtitle.slice(0, index + 1);
                
                // Add cursor
                const cursor = document.createElement('span');
                cursor.className = 'sf-hero__cursor';
                cursor.textContent = '|';
                this.elements.subtitle.appendChild(cursor);
                
                index++;
                setTimeout(typeChar, this.config.typewriterSpeed.subtitle);
            } else {
                // Remove cursor and mark subtitle complete
                const cursor = this.elements.subtitle.querySelector('.sf-hero__cursor');
                if (cursor) cursor.remove();
                
                this.config.subtitleComplete = true;
                this.showRemainingElements();
            }
        };

        typeChar();
    }

    showRemainingElements() {
        // Show description
        setTimeout(() => {
            if (this.elements.description) {
                this.elements.description.classList.add('sf-hero__description--visible');
                this.config.descriptionVisible = true;
            }
        }, 200);

        // Show actions
        setTimeout(() => {
            if (this.elements.actions) {
                this.elements.actions.classList.add('sf-hero__actions--visible');
                this.config.actionsVisible = true;
            }
        }, 400);

        // Show stats
        setTimeout(() => {
            if (this.elements.stats) {
                this.elements.stats.classList.add('sf-hero__stats--visible');
                this.config.statsVisible = true;
                this.animateStats();
            }
        }, 600);

        // Show scroll indicator
        setTimeout(() => {
            if (this.elements.scroll) {
                this.elements.scroll.classList.add('sf-hero__scroll-indicator--visible');
                this.config.scrollVisible = true;
            }
        }, 800);
    }

    animateStats() {
        const statElements = this.elements.stats.querySelectorAll('.sf-hero__stat');
        statElements.forEach((stat, index) => {
            setTimeout(() => {
                stat.style.animationDelay = `${0.5 + index * 0.1}s`;
                stat.style.opacity = '1';
                stat.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    handleCTAClick(e, href) {
        e.preventDefault();
        
        if (!href) return;

        // Add ripple effect for primary button
        if (e.target.classList.contains('sf-hero__cta--primary')) {
            this.createRippleEffect(e.target, e);
        }

        // Navigate to target
        if (href.startsWith('#')) {
            this.scrollToSection(href);
        } else {
            window.open(href, '_blank', 'noopener,noreferrer');
        }
    }

    createRippleEffect(button, event) {
        const ripple = button.querySelector('.sf-hero__cta-ripple');
        if (!ripple) return;

        // Reset ripple
        ripple.style.width = '0';
        ripple.style.height = '0';
        
        // Trigger ripple animation
        setTimeout(() => {
            ripple.style.width = '300px';
            ripple.style.height = '300px';
        }, 10);

        // Reset after animation
        setTimeout(() => {
            ripple.style.width = '0';
            ripple.style.height = '0';
        }, 500);
    }

    scrollToSection(target) {
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

    scrollToNextSection() {
        // Find the next section after hero
        const nextSection = this.elements.hero.nextElementSibling;
        if (nextSection) {
            nextSection.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Public API methods
    updateContent(newContent) {
        if (newContent.title) {
            this.config.title = newContent.title;
            if (!this.config.typewriterEffect) {
                this.elements.title.textContent = newContent.title;
            }
        }
        
        if (newContent.subtitle) {
            this.config.subtitle = newContent.subtitle;
            if (!this.config.typewriterEffect) {
                this.elements.subtitle.textContent = newContent.subtitle;
            }
        }
        
        if (newContent.description && this.elements.description) {
            this.elements.description.textContent = newContent.description;
        }
    }

    resetAnimations() {
        // Reset all animation states
        this.config.isVisible = false;
        this.config.titleComplete = false;
        this.config.subtitleComplete = false;
        this.config.descriptionVisible = false;
        this.config.actionsVisible = false;
        this.config.statsVisible = false;
        this.config.scrollVisible = false;

        // Remove classes
        this.elements.hero.classList.remove('sf-hero--visible');
        if (this.elements.description) {
            this.elements.description.classList.remove('sf-hero__description--visible');
        }
        if (this.elements.actions) {
            this.elements.actions.classList.remove('sf-hero__actions--visible');
        }
        if (this.elements.stats) {
            this.elements.stats.classList.remove('sf-hero__stats--visible');
        }
        if (this.elements.scroll) {
            this.elements.scroll.classList.remove('sf-hero__scroll-indicator--visible');
        }

        // Clear content
        this.elements.title.textContent = '';
        this.elements.subtitle.textContent = '';
    }

    destroy() {
        // Cleanup method
        this.resetAnimations();
        // Remove event listeners if needed
    }
}

// Auto-initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if hero exists before initializing
    const heroElement = document.getElementById('sf-hero');
    if (heroElement) {
        window.snowFlowHero = new SnowFlowHero();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SnowFlowHero;
}

// Global access
window.SnowFlowHero = SnowFlowHero;