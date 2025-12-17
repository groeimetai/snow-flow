// Snow-Flow Interactive Elements JavaScript

class SnowFlowInteractiveElements {
    constructor(options = {}) {
        this.config = {
            selector: options.selector || '#sf-interactive-demo',
            
            // State management
            progress: 65,
            tooltips: new Map(),
            
            // Configuration
            rippleDuration: 600,
            tooltipDelay: 300
        };

        this.elements = {
            container: document.querySelector(this.config.selector),
            buttons: [],
            inputs: [],
            toggles: [],
            progressBars: [],
            tooltips: [],
            spinners: []
        };

        this.init();
    }

    init() {
        if (!this.elements.container) {
            console.warn('SnowFlowInteractiveElements: Container not found');
            return;
        }

        this.initializeButtons();
        this.initializeInputs();
        this.initializeToggles();
        this.initializeProgressBars();
        this.initializeTooltips();
        this.initializeSpecialFeatures();
    }

    /* ============================================================================
       Button Functionality
       ============================================================================ */

    initializeButtons() {
        const buttons = this.elements.container.querySelectorAll('.sf-button:not(.sf-button--disabled)');
        
        buttons.forEach(button => {
            button.addEventListener('click', (e) => this.handleButtonClick(e, button));
            button.addEventListener('mousedown', (e) => this.createRipple(e, button));
        });

        this.elements.buttons = Array.from(buttons);

        // Special loading button
        const loadingBtn = document.getElementById('loading-demo-btn');
        if (loadingBtn) {
            loadingBtn.addEventListener('click', () => this.handleLoadingDemo(loadingBtn));
        }
    }

    handleButtonClick(event, button) {
        // Prevent disabled button clicks
        if (button.classList.contains('sf-button--disabled') || 
            button.classList.contains('sf-button--loading')) {
            event.preventDefault();
            return;
        }

        // Custom button actions based on data attributes or IDs
        const variant = button.getAttribute('data-variant');
        
        // Optional: Add custom behavior for different button variants
        console.log(`Button clicked: ${variant || 'unknown'}`);
    }

    createRipple(event, button) {
        if (button.classList.contains('sf-button--disabled')) return;

        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        const ripple = document.createElement('span');
        ripple.className = 'sf-button__ripple';
        ripple.style.cssText = `
            left: ${x}px;
            top: ${y}px;
            width: ${size}px;
            height: ${size}px;
        `;

        button.appendChild(ripple);

        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, this.config.rippleDuration);
    }

    handleLoadingDemo(button) {
        if (button.classList.contains('sf-button--loading')) return;

        // Add loading state
        button.classList.add('sf-button--loading');
        const content = button.querySelector('.sf-button__content');
        const originalText = content.textContent;
        
        // Add spinner
        const spinner = document.createElement('span');
        spinner.className = 'sf-button__spinner';
        content.insertBefore(spinner, content.firstChild);
        content.lastChild.textContent = ' Loading...';

        // Remove loading state after 3 seconds
        setTimeout(() => {
            button.classList.remove('sf-button--loading');
            content.innerHTML = originalText;
        }, 3000);
    }

    /* ============================================================================
       Input Functionality
       ============================================================================ */

    initializeInputs() {
        const inputs = this.elements.container.querySelectorAll('.sf-input');
        
        inputs.forEach(inputWrapper => {
            const input = inputWrapper.querySelector('.sf-input__field');
            if (!input) return;

            input.addEventListener('focus', () => this.handleInputFocus(inputWrapper));
            input.addEventListener('blur', () => this.handleInputBlur(inputWrapper));
            input.addEventListener('input', (e) => this.handleInputChange(e, inputWrapper));
        });

        this.elements.inputs = Array.from(inputs);
    }

    handleInputFocus(inputWrapper) {
        inputWrapper.classList.add('sf-input--focused');
    }

    handleInputBlur(inputWrapper) {
        inputWrapper.classList.remove('sf-input--focused');
    }

    handleInputChange(event, inputWrapper) {
        const input = event.target;
        const value = input.value;

        // Optional: Add real-time validation
        if (input.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const isValid = emailRegex.test(value);
            
            if (isValid) {
                inputWrapper.classList.remove('sf-input--error');
                const errorElement = inputWrapper.querySelector('.sf-input__error');
                if (errorElement) errorElement.remove();
            } else {
                inputWrapper.classList.add('sf-input--error');
                if (!inputWrapper.querySelector('.sf-input__error')) {
                    const error = document.createElement('span');
                    error.className = 'sf-input__error';
                    error.textContent = 'Please enter a valid email address';
                    inputWrapper.appendChild(error);
                }
            }
        }
    }

    /* ============================================================================
       Toggle Functionality
       ============================================================================ */

    initializeToggles() {
        const toggles = this.elements.container.querySelectorAll('.sf-toggle:not(.sf-toggle--disabled)');
        
        toggles.forEach(toggle => {
            const input = toggle.querySelector('.sf-toggle__input');
            if (!input) return;

            input.addEventListener('change', (e) => this.handleToggleChange(e, toggle));
            
            // Keyboard support
            input.addEventListener('keydown', (e) => {
                if (e.key === ' ') {
                    e.preventDefault();
                    input.click();
                }
            });
        });

        this.elements.toggles = Array.from(toggles);
    }

    handleToggleChange(event, toggle) {
        const input = event.target;
        const toggleType = toggle.getAttribute('data-toggle');
        
        console.log(`Toggle ${toggleType}: ${input.checked}`);

        // Special handling for specific toggles
        if (toggleType === 'darkmode') {
            this.handleDarkModeToggle(input.checked);
        }
    }

    handleDarkModeToggle(enabled) {
        // Optional: Implement dark mode toggle functionality
        console.log(`Dark mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /* ============================================================================
       Progress Bar Functionality
       ============================================================================ */

    initializeProgressBars() {
        const progressBars = this.elements.container.querySelectorAll('.sf-progress');
        this.elements.progressBars = Array.from(progressBars);

        // Initialize progress controls
        const increaseBtn = document.getElementById('progress-increase');
        const decreaseBtn = document.getElementById('progress-decrease');

        if (increaseBtn) {
            increaseBtn.addEventListener('click', () => this.changeProgress(10));
        }

        if (decreaseBtn) {
            decreaseBtn.addEventListener('click', () => this.changeProgress(-10));
        }
    }

    changeProgress(delta) {
        this.config.progress = Math.min(100, Math.max(0, this.config.progress + delta));
        
        const mainProgressBar = this.elements.container.querySelector('[data-progress="main"]');
        if (mainProgressBar) {
            const fill = mainProgressBar.querySelector('.sf-progress__fill');
            const percent = mainProgressBar.querySelector('.sf-progress__percent');
            
            if (fill) {
                fill.style.width = `${this.config.progress}%`;
            }
            if (percent) {
                percent.textContent = `${this.config.progress}%`;
            }
        }
    }

    /* ============================================================================
       Tooltip Functionality
       ============================================================================ */

    initializeTooltips() {
        const tooltipTriggers = this.elements.container.querySelectorAll('.sf-tooltip-trigger');
        
        tooltipTriggers.forEach(trigger => {
            const content = trigger.getAttribute('data-tooltip');
            const position = trigger.getAttribute('data-position') || 'top';
            const triggerType = trigger.getAttribute('data-trigger') || 'hover';
            
            if (!content) return;

            const tooltip = this.createTooltip(content, position);
            this.config.tooltips.set(trigger, { tooltip, position, triggerType });

            if (triggerType === 'hover') {
                trigger.addEventListener('mouseenter', (e) => this.showTooltip(e, trigger));
                trigger.addEventListener('mouseleave', () => this.hideTooltip(trigger));
            } else if (triggerType === 'click') {
                trigger.addEventListener('click', (e) => this.toggleTooltip(e, trigger));
            }
        });
    }

    createTooltip(content, position) {
        const tooltip = document.createElement('div');
        tooltip.className = `sf-tooltip sf-tooltip--${position}`;
        
        const tooltipContent = document.createElement('div');
        tooltipContent.className = 'sf-tooltip__content';
        tooltipContent.textContent = content;
        
        const tooltipArrow = document.createElement('div');
        tooltipArrow.className = 'sf-tooltip__arrow';
        
        tooltip.appendChild(tooltipContent);
        tooltip.appendChild(tooltipArrow);
        
        document.body.appendChild(tooltip);
        return tooltip;
    }

    showTooltip(event, trigger) {
        const tooltipData = this.config.tooltips.get(trigger);
        if (!tooltipData) return;

        const { tooltip, position } = tooltipData;
        const rect = trigger.getBoundingClientRect();
        
        // Calculate position
        let x = rect.left + rect.width / 2;
        let y = position === 'top' ? rect.top - 10 : rect.bottom + 10;
        
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        tooltip.classList.add('sf-tooltip--visible');
    }

    hideTooltip(trigger) {
        const tooltipData = this.config.tooltips.get(trigger);
        if (!tooltipData) return;

        tooltipData.tooltip.classList.remove('sf-tooltip--visible');
    }

    toggleTooltip(event, trigger) {
        event.stopPropagation();
        const tooltipData = this.config.tooltips.get(trigger);
        if (!tooltipData) return;

        const { tooltip } = tooltipData;
        const isVisible = tooltip.classList.contains('sf-tooltip--visible');
        
        // Hide all other click tooltips
        this.config.tooltips.forEach((data, otherTrigger) => {
            if (otherTrigger !== trigger && data.triggerType === 'click') {
                data.tooltip.classList.remove('sf-tooltip--visible');
            }
        });
        
        if (isVisible) {
            this.hideTooltip(trigger);
        } else {
            this.showTooltip(event, trigger);
        }
    }

    /* ============================================================================
       Special Features
       ============================================================================ */

    initializeSpecialFeatures() {
        // Handle clicks outside tooltips to close them
        document.addEventListener('click', (e) => {
            this.config.tooltips.forEach((data, trigger) => {
                if (data.triggerType === 'click' && 
                    !trigger.contains(e.target) && 
                    !data.tooltip.contains(e.target)) {
                    data.tooltip.classList.remove('sf-tooltip--visible');
                }
            });
        });

        // Handle keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close all tooltips on Escape
                this.config.tooltips.forEach((data) => {
                    data.tooltip.classList.remove('sf-tooltip--visible');
                });
            }
        });

        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // Hide all tooltips on resize
                this.config.tooltips.forEach((data) => {
                    data.tooltip.classList.remove('sf-tooltip--visible');
                });
            }, 250);
        });
    }

    /* ============================================================================
       Public API Methods
       ============================================================================ */

    // Button methods
    setButtonLoading(button, loading = true) {
        if (typeof button === 'string') {
            button = document.querySelector(button);
        }
        
        if (loading) {
            button.classList.add('sf-button--loading');
        } else {
            button.classList.remove('sf-button--loading');
        }
    }

    // Input methods
    setInputError(input, error) {
        if (typeof input === 'string') {
            input = document.querySelector(input);
        }
        
        const wrapper = input.closest('.sf-input');
        if (!wrapper) return;

        if (error) {
            wrapper.classList.add('sf-input--error');
            let errorElement = wrapper.querySelector('.sf-input__error');
            
            if (!errorElement) {
                errorElement = document.createElement('span');
                errorElement.className = 'sf-input__error';
                wrapper.appendChild(errorElement);
            }
            
            errorElement.textContent = error;
        } else {
            wrapper.classList.remove('sf-input--error');
            const errorElement = wrapper.querySelector('.sf-input__error');
            if (errorElement) {
                errorElement.remove();
            }
        }
    }

    // Toggle methods
    setToggleValue(toggle, checked) {
        if (typeof toggle === 'string') {
            toggle = document.querySelector(toggle);
        }
        
        const input = toggle.querySelector('.sf-toggle__input');
        if (input) {
            input.checked = checked;
        }
    }

    // Progress methods
    setProgress(progressBar, value) {
        if (typeof progressBar === 'string') {
            progressBar = document.querySelector(progressBar);
        }
        
        const fill = progressBar.querySelector('.sf-progress__fill');
        const percent = progressBar.querySelector('.sf-progress__percent');
        
        if (fill) {
            fill.style.width = `${value}%`;
        }
        if (percent) {
            percent.textContent = `${Math.round(value)}%`;
        }
    }

    // Cleanup method
    destroy() {
        // Remove all tooltips from DOM
        this.config.tooltips.forEach((data) => {
            if (data.tooltip.parentNode) {
                data.tooltip.parentNode.removeChild(data.tooltip);
            }
        });
        
        this.config.tooltips.clear();
    }
}

// Auto-initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    const interactiveDemo = document.getElementById('sf-interactive-demo');
    if (interactiveDemo) {
        window.snowFlowInteractive = new SnowFlowInteractiveElements();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SnowFlowInteractiveElements;
}

// Global access
window.SnowFlowInteractiveElements = SnowFlowInteractiveElements;