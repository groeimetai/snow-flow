// Snow-Flow Code Display Component JavaScript

class SnowFlowCodeDisplay {
    constructor(options = {}) {
        // Configuration
        this.config = {
            selector: options.selector || '.sf-code-display',
            theme: options.theme || 'dark',
            showLineNumbers: options.showLineNumbers !== false,
            enableCopy: options.enableCopy !== false,
            enableSyntaxHighlighting: options.enableSyntaxHighlighting !== false,
            
            // Animation settings
            intersectionThreshold: options.intersectionThreshold || 0.1,
            
            // State
            instances: new Map()
        };

        this.init();
    }

    init() {
        this.findAndInitializeCodeDisplays();
        this.setupIntersectionObserver();
    }

    findAndInitializeCodeDisplays() {
        const codeDisplays = document.querySelectorAll(this.config.selector);
        
        codeDisplays.forEach((element, index) => {
            const instance = this.initializeInstance(element, index);
            this.config.instances.set(element, instance);
        });
    }

    initializeInstance(element, index) {
        const instance = {
            element,
            id: `sf-code-${index}`,
            codeElement: element.querySelector('.sf-code-display__code'),
            lineNumbersElement: element.querySelector('.sf-code-display__line-numbers'),
            copyButtons: element.querySelectorAll('.sf-code-display__copy'),
            isVisible: false
        };

        // Setup line numbers
        if (this.config.showLineNumbers && instance.codeElement && instance.lineNumbersElement) {
            this.generateLineNumbers(instance);
        }

        // Setup copy functionality
        if (this.config.enableCopy) {
            this.setupCopyButtons(instance);
        }

        // Apply syntax highlighting
        if (this.config.enableSyntaxHighlighting && instance.codeElement) {
            this.applySyntaxHighlighting(instance);
        }

        return instance;
    }

    generateLineNumbers(instance) {
        const code = instance.codeElement.textContent || instance.codeElement.innerText;
        const lines = code.split('\n');
        const lineCount = lines.length;

        // Clear existing line numbers
        instance.lineNumbersElement.innerHTML = '';

        // Generate line numbers
        for (let i = 1; i <= lineCount; i++) {
            const lineNumber = document.createElement('span');
            lineNumber.className = 'sf-code-display__line-number';
            lineNumber.textContent = i;
            instance.lineNumbersElement.appendChild(lineNumber);
        }
    }

    setupCopyButtons(instance) {
        instance.copyButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.handleCopyClick(e, instance);
            });
        });
    }

    async handleCopyClick(e, instance) {
        e.preventDefault();
        
        const button = e.currentTarget;
        const targetId = button.getAttribute('data-target');
        
        let codeElement = instance.codeElement;
        if (targetId) {
            codeElement = document.getElementById(targetId);
        }

        if (!codeElement) return;

        const code = codeElement.textContent || codeElement.innerText;

        try {
            await this.copyToClipboard(code);
            this.showCopySuccess(button, instance);
        } catch (err) {
            console.error('Failed to copy code:', err);
            this.showCopyError(button);
        }
    }

    async copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.cssText = 'position:fixed;top:-999px;left:-999px;';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    showCopySuccess(button, instance) {
        // Update button state
        const originalContent = button.innerHTML;
        button.classList.add('sf-code-display__copy--copied');
        
        // Update icon and text
        const icon = button.querySelector('svg');
        const text = button.querySelector('.sf-code-display__copy-text');
        
        if (icon) {
            icon.innerHTML = '<path d="M20 6L9 17L4 12"/>';
        }
        
        if (text) {
            text.textContent = 'Copied!';
        }

        // Show feedback overlay
        this.showCopyFeedback(instance);

        // Reset button after 2 seconds
        setTimeout(() => {
            button.classList.remove('sf-code-display__copy--copied');
            button.innerHTML = originalContent;
        }, 2000);
    }

    showCopyError(button) {
        // Simple error indication
        button.style.background = 'rgba(255, 59, 48, 0.2)';
        button.style.borderColor = '#ff3b30';
        button.style.color = '#ff3b30';

        setTimeout(() => {
            button.style.background = '';
            button.style.borderColor = '';
            button.style.color = '';
        }, 2000);
    }

    showCopyFeedback(instance) {
        // Create feedback element
        const feedback = document.createElement('div');
        feedback.className = 'sf-code-display__copy-feedback';
        feedback.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17L4 12"/>
            </svg>
            Copied to clipboard!
        `;

        instance.element.appendChild(feedback);

        // Remove after animation
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 2000);
    }

    applySyntaxHighlighting(instance) {
        const codeElement = instance.codeElement;
        let code = codeElement.textContent || codeElement.innerText;

        // Get language from class
        const classList = Array.from(codeElement.classList);
        const languageClass = classList.find(cls => cls.startsWith('language-'));
        const language = languageClass ? languageClass.replace('language-', '') : 'javascript';

        // Apply highlighting based on language
        const highlightedCode = this.highlightCode(code, language);
        codeElement.innerHTML = highlightedCode;
    }

    highlightCode(code, language) {
        // Define patterns for different languages
        const patterns = this.getLanguagePatterns(language);
        
        let highlightedCode = code;

        // Apply patterns in sequence
        patterns.forEach(({ pattern, replacement, className }) => {
            highlightedCode = highlightedCode.replace(pattern, replacement);
        });

        return highlightedCode;
    }

    getLanguagePatterns(language) {
        const basePatterns = [
            // Comments
            {
                pattern: /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)/gm,
                replacement: '<span class="sf-code-comment">$1</span>'
            },
            // Strings
            {
                pattern: /(['"`])((?:\\.|(?!\1)[^\\\r\n])*?)\1/g,
                replacement: '<span class="sf-code-string">$1$2$1</span>'
            },
            // Numbers
            {
                pattern: /\b(\d+\.?\d*)\b/g,
                replacement: '<span class="sf-code-number">$1</span>'
            }
        ];

        const languageSpecificPatterns = {
            javascript: [
                {
                    pattern: /\b(async|await|const|let|var|function|return|if|else|for|while|try|catch|finally|class|extends|import|export|from|default|typeof|instanceof|new|this|super|static|public|private|protected)\b/g,
                    replacement: '<span class="sf-code-keyword">$1</span>'
                },
                {
                    pattern: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g,
                    replacement: '<span class="sf-code-function">$1</span>'
                },
                {
                    pattern: /\.([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g,
                    replacement: '.<span class="sf-code-property">$1</span>'
                }
            ],
            bash: [
                {
                    pattern: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|local|export|alias|source|echo|cd|ls|cp|mv|rm|mkdir|chmod|chown|grep|awk|sed|sort|uniq|head|tail|cat|more|less)\b/g,
                    replacement: '<span class="sf-code-keyword">$1</span>'
                },
                {
                    pattern: /(\$[a-zA-Z_][a-zA-Z0-9_]*|\$\{[^}]*\})/g,
                    replacement: '<span class="sf-code-property">$1</span>'
                }
            ],
            python: [
                {
                    pattern: /\b(and|as|assert|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|async|await)\b/g,
                    replacement: '<span class="sf-code-keyword">$1</span>'
                },
                {
                    pattern: /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g,
                    replacement: '<span class="sf-code-function">$1</span>'
                }
            ]
        };

        // Operators (common to all languages)
        const operatorPattern = {
            pattern: /(\+|\-|\*|\/|%|=|==|===|!=|!==|<|>|<=|>=|&&|\|\||!|\?|:|&|\||\^|~|<<|>>)/g,
            replacement: '<span class="sf-code-operator">$1</span>'
        };

        return [
            ...basePatterns,
            ...(languageSpecificPatterns[language] || languageSpecificPatterns.javascript),
            operatorPattern
        ];
    }

    setupIntersectionObserver() {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    const instance = this.config.instances.get(entry.target);
                    if (instance && entry.isIntersecting && !instance.isVisible) {
                        instance.isVisible = true;
                        entry.target.classList.add('sf-code-display--visible');
                    }
                });
            },
            { threshold: this.config.intersectionThreshold }
        );

        this.config.instances.forEach((instance) => {
            observer.observe(instance.element);
        });
    }

    // Public API methods
    addCodeDisplay(element) {
        const index = this.config.instances.size;
        const instance = this.initializeInstance(element, index);
        this.config.instances.set(element, instance);
        
        // Setup intersection observer for the new element
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !instance.isVisible) {
                    instance.isVisible = true;
                    entry.target.classList.add('sf-code-display--visible');
                }
            },
            { threshold: this.config.intersectionThreshold }
        );
        
        observer.observe(element);
    }

    updateCode(element, newCode) {
        const instance = this.config.instances.get(element);
        if (!instance || !instance.codeElement) return;

        instance.codeElement.textContent = newCode;
        
        // Re-apply highlighting and line numbers
        if (this.config.enableSyntaxHighlighting) {
            this.applySyntaxHighlighting(instance);
        }
        
        if (this.config.showLineNumbers) {
            this.generateLineNumbers(instance);
        }
    }

    setTheme(theme) {
        this.config.theme = theme;
        
        this.config.instances.forEach((instance) => {
            if (theme === 'light') {
                instance.element.classList.add('sf-code-display--light');
            } else {
                instance.element.classList.remove('sf-code-display--light');
            }
        });
    }

    destroy() {
        // Cleanup method
        this.config.instances.clear();
    }
}

// Auto-initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if code displays exist before initializing
    const codeDisplays = document.querySelectorAll('.sf-code-display');
    if (codeDisplays.length > 0) {
        window.snowFlowCodeDisplay = new SnowFlowCodeDisplay();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SnowFlowCodeDisplay;
}

// Global access
window.SnowFlowCodeDisplay = SnowFlowCodeDisplay;