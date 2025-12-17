import React, { useState, useEffect, useRef } from 'react';
import './CodeDisplay.css';

const CodeDisplay = ({
  code = `// Welcome to Snow-Flow
const snowFlow = new SnowFlowFramework({
  mode: 'development',
  verbose: true
});

// Execute background script
await snow_execute_script_with_output({
  script: \`
    var gr = new GlideRecord('incident');
    gr.addActiveQuery();
    gr.query();
    
    var count = 0;
    while(gr.next()) {
      count++;
    }
    
    gs.info('Total incidents: ' + count);
  \`,
  description: 'Count active incidents'
});`,
  language = 'javascript',
  theme = 'black-white',
  title = 'code-example.js',
  showLineNumbers = true,
  showCopyButton = true,
  showHeader = true,
  editable = false,
  maxHeight = '400px',
  className = '',
  onCopy = null,
  onChange = null
}) => {
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const codeRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    // Count lines
    const lines = code.split('\n').length;
    setLineCount(lines);
  }, [code]);

  useEffect(() => {
    // Intersection observer for entrance animation
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Simple syntax highlighting for black/white theme
    if (codeRef.current && isVisible) {
      applySyntaxHighlighting();
    }
  }, [code, isVisible]);

  const applySyntaxHighlighting = () => {
    if (!codeRef.current) return;

    let highlightedCode = code;

    // Define patterns for black/white theme
    const patterns = [
      // Comments
      {
        pattern: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
        replacement: '<span class="sf-code-comment">$1</span>'
      },
      // Strings
      {
        pattern: /(['"`])((?:\\.|(?!\1)[^\\\r\n])*?)\1/g,
        replacement: '<span class="sf-code-string">$1$2$1</span>'
      },
      // Keywords
      {
        pattern: /\b(async|await|const|let|var|function|return|if|else|for|while|try|catch|finally|class|extends|import|export|from|default|typeof|instanceof|new|this|super|static|public|private|protected)\b/g,
        replacement: '<span class="sf-code-keyword">$1</span>'
      },
      // Numbers
      {
        pattern: /\b(\d+\.?\d*)\b/g,
        replacement: '<span class="sf-code-number">$1</span>'
      },
      // Functions
      {
        pattern: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g,
        replacement: '<span class="sf-code-function">$1</span>'
      },
      // Objects and properties
      {
        pattern: /\.([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g,
        replacement: '.<span class="sf-code-property">$1</span>'
      },
      // Operators
      {
        pattern: /(\+|\-|\*|\/|%|=|==|===|!=|!==|<|>|<=|>=|&&|\|\||!|\?|:)/g,
        replacement: '<span class="sf-code-operator">$1</span>'
      }
    ];

    // Apply patterns in sequence
    patterns.forEach(({ pattern, replacement }) => {
      highlightedCode = highlightedCode.replace(pattern, replacement);
    });

    codeRef.current.innerHTML = highlightedCode;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      
      if (onCopy) {
        onCopy(code);
      }

      // Reset copy state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
      
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCodeChange = (e) => {
    if (editable && onChange) {
      onChange(e.target.textContent);
    }
  };

  const generateLineNumbers = () => {
    return Array.from({ length: lineCount }, (_, i) => (
      <span key={i + 1} className="sf-code-line-number">
        {i + 1}
      </span>
    ));
  };

  const getLanguageIcon = () => {
    const icons = {
      javascript: '{}',
      typescript: 'TS',
      html: '<>',
      css: '🎨',
      python: '🐍',
      java: '☕',
      bash: '$',
      json: '{}',
      xml: '</>',
      sql: '📊'
    };
    return icons[language] || '💻';
  };

  return (
    <div 
      ref={containerRef}
      className={`sf-code-display ${isVisible ? 'sf-code-display--visible' : ''} ${className}`}
      style={{ maxHeight }}
    >
      {showHeader && (
        <div className="sf-code-display__header">
          <div className="sf-code-display__window-controls">
            <span className="sf-code-display__control sf-code-display__control--close"></span>
            <span className="sf-code-display__control sf-code-display__control--minimize"></span>
            <span className="sf-code-display__control sf-code-display__control--maximize"></span>
          </div>
          
          <div className="sf-code-display__title">
            <span className="sf-code-display__icon">{getLanguageIcon()}</span>
            <span className="sf-code-display__filename">{title}</span>
          </div>

          {showCopyButton && (
            <button
              className={`sf-code-display__copy ${copied ? 'sf-code-display__copy--copied' : ''}`}
              onClick={handleCopy}
              title="Copy to clipboard"
              aria-label="Copy code to clipboard"
            >
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17L4 12"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              )}
              <span className="sf-code-display__copy-text">
                {copied ? 'Copied!' : 'Copy'}
              </span>
            </button>
          )}
        </div>
      )}

      <div className="sf-code-display__body">
        {showLineNumbers && (
          <div className="sf-code-display__line-numbers">
            {generateLineNumbers()}
          </div>
        )}

        <div className="sf-code-display__content">
          <pre className="sf-code-display__pre">
            <code
              ref={codeRef}
              className={`sf-code-display__code language-${language}`}
              contentEditable={editable}
              suppressContentEditableWarning={true}
              onInput={handleCodeChange}
              spellCheck={false}
            >
              {code}
            </code>
          </pre>
        </div>
      </div>

      {/* Terminal cursor */}
      <div className="sf-code-display__cursor"></div>

      {/* Copy feedback */}
      {copied && (
        <div className="sf-code-display__copy-feedback">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17L4 12"/>
          </svg>
          Copied to clipboard!
        </div>
      )}
    </div>
  );
};

export default CodeDisplay;