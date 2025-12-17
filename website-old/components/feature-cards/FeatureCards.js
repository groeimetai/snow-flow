// Snow-Flow Feature Cards Component JavaScript

class SnowFlowFeatureCards {
    constructor(options = {}) {
        // Configuration
        this.config = {
            containerId: options.containerId || 'sf-feature-cards',
            gridId: options.gridId || 'sf-feature-grid',
            ctaId: options.ctaId || 'sf-feature-cta',
            
            // Animation settings
            staggerDelay: options.staggerDelay || 150,
            intersectionThreshold: options.intersectionThreshold || 0.1,
            
            // State
            isVisible: false,
            visibleCards: new Set(),
            cardElements: []
        };

        // DOM elements
        this.elements = {
            container: document.getElementById(this.config.containerId),
            grid: document.getElementById(this.config.gridId),
            cta: document.getElementById(this.config.ctaId)
        };

        this.init();
    }

    init() {
        if (!this.elements.container) {
            console.warn('SnowFlowFeatureCards: Container element not found');
            return;
        }

        this.setupCards();
        this.setupIntersectionObserver();
        this.setupEventListeners();
    }

    setupCards() {
        // Get all card elements
        this.config.cardElements = Array.from(
            this.elements.container.querySelectorAll('.sf-feature-card')
        );

        // Setup each card
        this.config.cardElements.forEach((card, index) => {
            card.style.animationDelay = `${index * this.config.staggerDelay}ms`;
            card.setAttribute('data-index', index.toString());
        });
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
            { threshold: this.config.intersectionThreshold }
        );

        observer.observe(this.elements.container);
    }

    setupEventListeners() {
        // Card click handlers
        this.config.cardElements.forEach((card, index) => {
            // Mouse events
            card.addEventListener('mouseenter', () => this.handleCardHover(card, true));
            card.addEventListener('mouseleave', () => this.handleCardHover(card, false));
            card.addEventListener('click', (e) => this.handleCardClick(e, card, index));
            
            // Touch events for mobile
            card.addEventListener('touchstart', () => this.handleCardHover(card, true), { passive: true });
            card.addEventListener('touchend', () => {
                setTimeout(() => this.handleCardHover(card, false), 300);
            }, { passive: true });

            // Keyboard events
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleCardClick(e, card, index);
                }
            });

            // Focus events
            card.addEventListener('focus', () => this.handleCardFocus(card, true));
            card.addEventListener('blur', () => this.handleCardFocus(card, false));
        });

        // CTA button
        if (this.elements.cta) {
            const ctaButton = this.elements.cta.querySelector('.sf-feature-cards__cta-button');
            if (ctaButton) {
                ctaButton.addEventListener('click', () => this.handleCTAClick());
            }
        }

        // Resize handler
        window.addEventListener('resize', () => this.handleResize());
    }

    startAnimations() {
        // Add visible class to container
        this.elements.container.classList.add('sf-feature-cards--visible');

        // Stagger card animations
        this.config.cardElements.forEach((card, index) => {
            setTimeout(() => {
                this.config.visibleCards.add(index);
                card.classList.add('sf-feature-card--visible');
                this.animateCardAppearance(card, index);
            }, index * this.config.staggerDelay);
        });

        // Show CTA after all cards are visible
        if (this.elements.cta) {
            const totalDelay = this.config.cardElements.length * this.config.staggerDelay + 500;
            setTimeout(() => {
                this.elements.cta.classList.add('sf-feature-cards__cta--visible');
            }, totalDelay);
        }
    }

    animateCardAppearance(card, index) {
        // Optional: Add additional entrance effects
        const icon = card.querySelector('.sf-feature-card__icon');
        if (icon) {
            setTimeout(() => {
                icon.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    icon.style.transform = '';
                }, 200);
            }, 100);
        }
    }

    handleCardHover(card, isEntering) {
        const icon = card.querySelector('.sf-feature-card__icon');
        const arrow = card.querySelector('.sf-feature-card__arrow');

        if (isEntering) {
            if (icon) {
                icon.classList.add('sf-feature-card__icon--animated');
            }
            if (arrow) {
                arrow.classList.add('sf-feature-card__arrow--visible');
            }
        } else {
            if (icon) {
                icon.classList.remove('sf-feature-card__icon--animated');
            }
            if (arrow) {
                arrow.classList.remove('sf-feature-card__arrow--visible');
            }
        }
    }

    handleCardFocus(card, isFocused) {
        // Handle focus state for accessibility
        if (isFocused) {
            card.style.outline = '2px solid #000000';
            card.style.outlineOffset = '2px';
            this.handleCardHover(card, true);
        } else {
            card.style.outline = '';
            card.style.outlineOffset = '';
            this.handleCardHover(card, false);
        }
    }

    handleCardClick(e, card, index) {
        const link = card.getAttribute('data-link');
        
        if (link) {
            // Add ripple effect
            this.createRippleEffect(card, e);
            
            // Navigate after short delay for ripple effect
            setTimeout(() => {
                if (link.startsWith('#')) {
                    this.scrollToSection(link);
                } else {
                    window.open(link, '_blank', 'noopener,noreferrer');
                }
            }, 150);
        }

        // Optional: Trigger custom event
        const event = new CustomEvent('cardClick', {
            detail: {
                index,
                card,
                link,
                title: card.querySelector('.sf-feature-card__title')?.textContent
            }
        });
        this.elements.container.dispatchEvent(event);
    }

    createRippleEffect(card, clickEvent) {
        const ripple = card.querySelector('.sf-feature-card__ripple');
        if (!ripple) return;

        // Reset ripple
        ripple.style.width = '0';
        ripple.style.height = '0';
        
        // Calculate ripple position for click events
        if (clickEvent && clickEvent.type === 'click') {
            const rect = card.getBoundingClientRect();
            const x = clickEvent.clientX - rect.left;
            const y = clickEvent.clientY - rect.top;
            
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            ripple.style.transform = 'translate(-50%, -50%)';
        }

        // Trigger ripple animation
        setTimeout(() => {
            ripple.style.width = '300px';
            ripple.style.height = '300px';
        }, 10);

        // Reset after animation
        setTimeout(() => {
            ripple.style.width = '0';
            ripple.style.height = '0';
            ripple.style.left = '50%';
            ripple.style.top = '50%';
        }, 600);
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

    handleCTAClick() {
        // Optional: Implement show all features logic
        console.log('View All Features clicked');
        
        // Example: Could expand to show more cards or navigate to features page
        const event = new CustomEvent('ctaClick', {
            detail: {
                action: 'viewAllFeatures'
            }
        });
        this.elements.container.dispatchEvent(event);
    }

    handleResize() {
        // Handle responsive behavior if needed
        // Could recalculate positions or update layout
    }

    // Public API methods
    addFeature(featureData) {
        const { icon, title, description, link } = featureData;
        
        const cardHTML = `
            <div class="sf-feature-card sf-feature-card--clickable" data-link="${link || ''}" data-index="${this.config.cardElements.length}">
                <div class="sf-feature-card__border">
                    <div class="sf-feature-card__border-top"></div>
                    <div class="sf-feature-card__border-right"></div>
                    <div class="sf-feature-card__border-bottom"></div>
                    <div class="sf-feature-card__border-left"></div>
                </div>
                <div class="sf-feature-card__glow"></div>
                <div class="sf-feature-card__content">
                    <div class="sf-feature-card__icon-wrapper">
                        <div class="sf-feature-card__icon">
                            <span role="img" aria-hidden="true">${icon}</span>
                        </div>
                    </div>
                    <div class="sf-feature-card__text">
                        <h3 class="sf-feature-card__title">${title}</h3>
                        <p class="sf-feature-card__description">${description}</p>
                    </div>
                    ${link ? `
                        <div class="sf-feature-card__arrow">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M7 17L17 7M17 7H7M17 7V17"/>
                            </svg>
                        </div>
                    ` : ''}
                </div>
                <div class="sf-feature-card__ripple"></div>
            </div>
        `;

        this.elements.grid.insertAdjacentHTML('beforeend', cardHTML);
        this.setupCards(); // Re-setup cards with new element
    }

    updateFeature(index, featureData) {
        const card = this.config.cardElements[index];
        if (!card) return;

        const { icon, title, description, link } = featureData;

        if (icon) {
            const iconElement = card.querySelector('.sf-feature-card__icon span');
            if (iconElement) iconElement.textContent = icon;
        }

        if (title) {
            const titleElement = card.querySelector('.sf-feature-card__title');
            if (titleElement) titleElement.textContent = title;
        }

        if (description) {
            const descElement = card.querySelector('.sf-feature-card__description');
            if (descElement) descElement.textContent = description;
        }

        if (link !== undefined) {
            card.setAttribute('data-link', link);
        }
    }

    removeFeature(index) {
        const card = this.config.cardElements[index];
        if (card) {
            card.remove();
            this.setupCards(); // Re-setup after removal
        }
    }

    resetAnimations() {
        this.config.isVisible = false;
        this.config.visibleCards.clear();
        
        this.elements.container.classList.remove('sf-feature-cards--visible');
        this.config.cardElements.forEach(card => {
            card.classList.remove('sf-feature-card--visible');
        });
        
        if (this.elements.cta) {
            this.elements.cta.classList.remove('sf-feature-cards__cta--visible');
        }
    }

    destroy() {
        // Cleanup method
        this.resetAnimations();
        // Remove event listeners if needed
    }
}

// Auto-initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if feature cards exist before initializing
    const featureCardsElement = document.getElementById('sf-feature-cards');
    if (featureCardsElement) {
        window.snowFlowFeatureCards = new SnowFlowFeatureCards();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SnowFlowFeatureCards;
}

// Global access
window.SnowFlowFeatureCards = SnowFlowFeatureCards;