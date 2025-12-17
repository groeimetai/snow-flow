// Snow-Flow Layout Components JavaScript

class SnowFlowLayoutComponents {
    constructor(options = {}) {
        this.config = {
            selector: options.selector || '.sf-layout-demo',
            
            // Feature toggles
            enableDarkMode: options.enableDarkMode || false,
            enableAnimations: options.enableAnimations !== false,
            
            // State
            darkMode: false
        };

        this.elements = {
            container: document.querySelector(this.config.selector)
        };

        this.init();
    }

    init() {
        if (!this.elements.container) {
            console.warn('SnowFlowLayoutComponents: Container not found');
            return;
        }

        this.setupResponsiveObserver();
        this.setupIntersectionObserver();
        this.setupUtilities();
        this.addDemoInteractions();
    }

    /* ============================================================================
       Responsive Observer
       ============================================================================ */

    setupResponsiveObserver() {
        // Add responsive classes based on viewport width
        const updateResponsiveClasses = () => {
            const width = window.innerWidth;
            const body = document.body;

            // Remove existing responsive classes
            body.classList.remove('sf-sm', 'sf-md', 'sf-lg', 'sf-xl');

            // Add appropriate responsive class
            if (width >= 1280) {
                body.classList.add('sf-xl');
            } else if (width >= 1024) {
                body.classList.add('sf-lg');
            } else if (width >= 768) {
                body.classList.add('sf-md');
            } else if (width >= 640) {
                body.classList.add('sf-sm');
            }
        };

        // Initial call
        updateResponsiveClasses();

        // Update on resize with debouncing
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(updateResponsiveClasses, 150);
        });
    }

    /* ============================================================================
       Intersection Observer for Animations
       ============================================================================ */

    setupIntersectionObserver() {
        if (!this.config.enableAnimations) return;

        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.animateElement(entry.target);
                }
            });
        }, observerOptions);

        // Observe all cards and sections
        const elementsToObserve = this.elements.container.querySelectorAll(
            '.sf-card, .sf-section, .sf-demo-title'
        );

        elementsToObserve.forEach(element => {
            // Add initial state
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            
            observer.observe(element);
        });
    }

    animateElement(element) {
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
    }

    /* ============================================================================
       Utility Functions
       ============================================================================ */

    setupUtilities() {
        // Add utility methods for dynamic class management
        this.addUtilityMethods();
        
        // Setup dark mode if enabled
        if (this.config.enableDarkMode) {
            this.setupDarkMode();
        }
    }

    addUtilityMethods() {
        // Method to toggle responsive grid columns
        window.snowFlowUtils = {
            setGridColumns: (element, columns) => {
                if (typeof element === 'string') {
                    element = document.querySelector(element);
                }
                
                if (element && element.classList.contains('sf-grid')) {
                    element.style.gridTemplateColumns = typeof columns === 'number' 
                        ? `repeat(${columns}, 1fr)` 
                        : columns;
                }
            },

            setFlexDirection: (element, direction) => {
                if (typeof element === 'string') {
                    element = document.querySelector(element);
                }
                
                if (element && element.classList.contains('sf-flex')) {
                    element.className = element.className.replace(/sf-flex--\w+/g, '');
                    element.classList.add(`sf-flex--${direction}`);
                }
            },

            toggleCardHover: (element) => {
                if (typeof element === 'string') {
                    element = document.querySelector(element);
                }
                
                if (element && element.classList.contains('sf-card')) {
                    element.classList.toggle('sf-card--hover');
                }
            }
        };
    }

    setupDarkMode() {
        // Create dark mode toggle button
        const toggleButton = document.createElement('button');
        toggleButton.textContent = '🌙';
        toggleButton.className = 'sf-dark-mode-toggle';
        toggleButton.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            background: var(--sf-gradient-primary);
            color: white;
            border: none;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            font-size: 1.2rem;
            cursor: pointer;
            box-shadow: var(--sf-shadow-lg);
            transition: var(--sf-transition-normal);
        `;

        toggleButton.addEventListener('click', () => this.toggleDarkMode());
        document.body.appendChild(toggleButton);
    }

    toggleDarkMode() {
        this.config.darkMode = !this.config.darkMode;
        
        if (this.config.darkMode) {
            this.elements.container.classList.add('sf-dark-mode');
            document.querySelector('.sf-dark-mode-toggle').textContent = '☀️';
        } else {
            this.elements.container.classList.remove('sf-dark-mode');
            document.querySelector('.sf-dark-mode-toggle').textContent = '🌙';
        }
    }

    /* ============================================================================
       Demo Interactions
       ============================================================================ */

    addDemoInteractions() {
        // Add click handlers to demonstrate hover effects
        const hoverCards = this.elements.container.querySelectorAll('.sf-card--hover');
        hoverCards.forEach(card => {
            card.addEventListener('click', () => {
                this.showCardClickFeedback(card);
            });
        });

        // Add grid column adjustment demo
        this.addGridAdjustmentDemo();
        
        // Add responsive demonstration
        this.addResponsiveDemo();
    }

    showCardClickFeedback(card) {
        const originalTransform = card.style.transform;
        
        card.style.transform = 'scale(0.98)';
        card.style.transition = 'transform 0.1s ease';
        
        setTimeout(() => {
            card.style.transform = originalTransform;
            card.style.transition = '';
        }, 100);
    }

    addGridAdjustmentDemo() {
        // Find the first responsive grid and add controls
        const firstGrid = this.elements.container.querySelector('.sf-grid--responsive');
        if (!firstGrid) return;

        // Create control panel
        const controls = document.createElement('div');
        controls.className = 'sf-grid-controls';
        controls.style.cssText = `
            margin-top: 1rem;
            padding: 1rem;
            background: var(--sf-bg-secondary);
            border-radius: var(--sf-radius-md);
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
            align-items: center;
        `;

        controls.innerHTML = `
            <span style="font-weight: 600; margin-right: 0.5rem;">Grid columns:</span>
            <button class="sf-grid-btn" data-columns="1">1</button>
            <button class="sf-grid-btn" data-columns="2">2</button>
            <button class="sf-grid-btn" data-columns="3">3</button>
            <button class="sf-grid-btn" data-columns="4">4</button>
            <button class="sf-grid-btn" data-columns="auto">Auto</button>
        `;

        // Style control buttons
        const buttons = controls.querySelectorAll('.sf-grid-btn');
        buttons.forEach(btn => {
            btn.style.cssText = `
                padding: 0.5rem 1rem;
                border: 1px solid var(--sf-border-light);
                background: white;
                border-radius: var(--sf-radius-sm);
                cursor: pointer;
                transition: var(--sf-transition-fast);
            `;
            
            btn.addEventListener('click', () => {
                const columns = btn.getAttribute('data-columns');
                
                // Remove active class from all buttons
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update grid
                if (columns === 'auto') {
                    firstGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
                } else {
                    firstGrid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
                }
            });
            
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'var(--sf-bg-tertiary)';
            });
            
            btn.addEventListener('mouseleave', () => {
                if (!btn.classList.contains('active')) {
                    btn.style.background = 'white';
                }
            });
        });

        // Add active styling
        const activeStyle = document.createElement('style');
        activeStyle.textContent = `
            .sf-grid-btn.active {
                background: var(--sf-gradient-primary) !important;
                color: white !important;
                border-color: transparent !important;
            }
        `;
        document.head.appendChild(activeStyle);

        // Insert controls after the first grid
        firstGrid.parentNode.insertBefore(controls, firstGrid.nextSibling);
        
        // Set initial active state
        buttons[buttons.length - 1].classList.add('active'); // Auto button
    }

    addResponsiveDemo() {
        // Add a resize indicator
        const indicator = document.createElement('div');
        indicator.className = 'sf-responsive-indicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: var(--sf-gradient-primary);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: var(--sf-radius-md);
            font-size: 0.9rem;
            font-weight: 600;
            z-index: 1000;
            transition: var(--sf-transition-normal);
            opacity: 0;
            transform: translateY(20px);
        `;

        document.body.appendChild(indicator);

        const updateIndicator = () => {
            const width = window.innerWidth;
            let breakpoint = 'XS';
            
            if (width >= 1280) breakpoint = 'XL';
            else if (width >= 1024) breakpoint = 'LG';
            else if (width >= 768) breakpoint = 'MD';
            else if (width >= 640) breakpoint = 'SM';
            
            indicator.textContent = `${breakpoint}: ${width}px`;
            indicator.style.opacity = '1';
            indicator.style.transform = 'translateY(0)';
            
            // Hide after 2 seconds
            clearTimeout(indicator.hideTimeout);
            indicator.hideTimeout = setTimeout(() => {
                indicator.style.opacity = '0';
                indicator.style.transform = 'translateY(20px)';
            }, 2000);
        };

        // Show indicator on resize
        window.addEventListener('resize', updateIndicator);
        
        // Show initially
        setTimeout(updateIndicator, 1000);
    }

    /* ============================================================================
       Public API Methods
       ============================================================================ */

    // Method to programmatically add components
    addComponent(type, config = {}) {
        // Factory method for creating layout components
        const components = {
            card: (config) => {
                const card = document.createElement('div');
                card.className = `sf-card sf-card--elevation-${config.elevation || 'medium'} sf-card--padding-${config.padding || 'medium'}`;
                if (config.content) card.innerHTML = config.content;
                return card;
            },
            
            container: (config) => {
                const container = document.createElement('div');
                container.className = `sf-container sf-container--${config.padding || 'medium'}`;
                if (config.maxWidth) container.style.maxWidth = config.maxWidth;
                if (config.content) container.innerHTML = config.content;
                return container;
            },
            
            grid: (config) => {
                const grid = document.createElement('div');
                grid.className = `sf-grid sf-grid--gap-${config.gap || 'medium'}`;
                if (config.columns) {
                    grid.style.gridTemplateColumns = typeof config.columns === 'number' 
                        ? `repeat(${config.columns}, 1fr)` 
                        : config.columns;
                }
                return grid;
            }
        };

        return components[type] ? components[type](config) : null;
    }

    // Method to update component styles
    updateComponent(element, styles) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        
        Object.assign(element.style, styles);
    }

    // Cleanup method
    destroy() {
        // Remove event listeners and clean up
        const toggleButton = document.querySelector('.sf-dark-mode-toggle');
        if (toggleButton) {
            toggleButton.remove();
        }
        
        const indicator = document.querySelector('.sf-responsive-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
}

// Auto-initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if layout demo exists before initializing
    const layoutDemo = document.querySelector('.sf-layout-demo');
    if (layoutDemo) {
        window.snowFlowLayout = new SnowFlowLayoutComponents({
            enableDarkMode: true,
            enableAnimations: true
        });
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SnowFlowLayoutComponents;
}

// Global access
window.SnowFlowLayoutComponents = SnowFlowLayoutComponents;