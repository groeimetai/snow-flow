import React, { useState, useEffect, useRef } from 'react';
import './InteractiveElements.css';

// Button Component
const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'medium',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  ...props 
}) => {
  const [ripples, setRipples] = useState([]);
  
  const createRipple = (event) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    const newRipple = {
      x,
      y,
      size,
      id: Date.now()
    };
    
    setRipples(prev => [...prev, newRipple]);
    
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
    }, 600);
  };

  const handleClick = (event) => {
    if (!disabled && !loading) {
      createRipple(event);
      onClick?.(event);
    }
  };

  return (
    <button
      className={`sf-button sf-button--${variant} sf-button--${size} ${disabled ? 'sf-button--disabled' : ''} ${loading ? 'sf-button--loading' : ''} ${className}`}
      disabled={disabled || loading}
      onClick={handleClick}
      {...props}
    >
      <span className="sf-button__content">
        {loading && <span className="sf-button__spinner"></span>}
        {children}
      </span>
      
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="sf-button__ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size
          }}
        />
      ))}
    </button>
  );
};

// Input Component
const Input = ({ 
  label, 
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
  required = false,
  className = '',
  ...props 
}) => {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  return (
    <div className={`sf-input ${focused ? 'sf-input--focused' : ''} ${error ? 'sf-input--error' : ''} ${disabled ? 'sf-input--disabled' : ''} ${className}`}>
      {label && (
        <label className="sf-input__label">
          {label}
          {required && <span className="sf-input__required">*</span>}
        </label>
      )}
      
      <div className="sf-input__wrapper">
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="sf-input__field"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        <div className="sf-input__border"></div>
      </div>
      
      {error && <span className="sf-input__error">{error}</span>}
    </div>
  );
};

// Toggle Switch Component
const Toggle = ({ 
  checked = false,
  onChange,
  label,
  disabled = false,
  size = 'medium',
  className = ''
}) => {
  const handleChange = (event) => {
    if (!disabled) {
      onChange?.(event.target.checked);
    }
  };

  return (
    <label className={`sf-toggle sf-toggle--${size} ${disabled ? 'sf-toggle--disabled' : ''} ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        className="sf-toggle__input"
      />
      <span className="sf-toggle__slider">
        <span className="sf-toggle__thumb"></span>
      </span>
      {label && <span className="sf-toggle__label">{label}</span>}
    </label>
  );
};

// Progress Bar Component
const ProgressBar = ({ 
  value = 0,
  max = 100,
  label,
  showPercent = true,
  animated = true,
  size = 'medium',
  className = ''
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`sf-progress sf-progress--${size} ${animated ? 'sf-progress--animated' : ''} ${className}`}>
      {label && (
        <div className="sf-progress__header">
          <span className="sf-progress__label">{label}</span>
          {showPercent && <span className="sf-progress__percent">{Math.round(percentage)}%</span>}
        </div>
      )}
      
      <div className="sf-progress__track">
        <div 
          className="sf-progress__fill"
          style={{ width: `${percentage}%` }}
        >
          <div className="sf-progress__shimmer"></div>
        </div>
      </div>
    </div>
  );
};

// Tooltip Component
const Tooltip = ({ 
  children,
  content,
  position = 'top',
  trigger = 'hover',
  disabled = false,
  className = ''
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);

  const showTooltip = (event) => {
    if (disabled) return;
    
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({
        x: rect.left + rect.width / 2,
        y: rect.top
      });
    }
    setVisible(true);
  };

  const hideTooltip = () => {
    setVisible(false);
  };

  const triggerProps = trigger === 'hover' 
    ? { onMouseEnter: showTooltip, onMouseLeave: hideTooltip }
    : { onClick: () => setVisible(!visible) };

  useEffect(() => {
    if (trigger === 'click' && visible) {
      const handleClickOutside = (event) => {
        if (tooltipRef.current && !tooltipRef.current.contains(event.target) && 
            triggerRef.current && !triggerRef.current.contains(event.target)) {
          setVisible(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [visible, trigger]);

  return (
    <>
      <div
        ref={triggerRef}
        className={`sf-tooltip-trigger ${className}`}
        {...triggerProps}
      >
        {children}
      </div>
      
      {visible && (
        <div
          ref={tooltipRef}
          className={`sf-tooltip sf-tooltip--${position} sf-tooltip--visible`}
          style={{
            left: coords.x,
            top: position === 'top' ? coords.y - 10 : coords.y + 30
          }}
        >
          <div className="sf-tooltip__content">{content}</div>
          <div className="sf-tooltip__arrow"></div>
        </div>
      )}
    </>
  );
};

// Loading Spinner Component
const Spinner = ({ 
  size = 'medium',
  color = 'primary',
  className = ''
}) => (
  <div className={`sf-spinner sf-spinner--${size} sf-spinner--${color} ${className}`}>
    <div className="sf-spinner__circle"></div>
  </div>
);

// Demo Component
const InteractiveElements = () => {
  const [toggleValue, setToggleValue] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [progress, setProgress] = useState(65);
  const [loading, setLoading] = useState(false);

  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 3000);
  };

  const incrementProgress = () => {
    setProgress(prev => Math.min(100, prev + 10));
  };

  const decrementProgress = () => {
    setProgress(prev => Math.max(0, prev - 10));
  };

  return (
    <section className="sf-interactive-demo">
      <div className="sf-interactive-demo__container">
        <h2 className="sf-interactive-demo__title">Interactive Elements</h2>
        <p className="sf-interactive-demo__subtitle">
          A comprehensive collection of interactive UI components with modern black/white design
        </p>

        {/* Buttons Section */}
        <div className="sf-demo-section">
          <h3 className="sf-demo-section__title">Buttons</h3>
          <div className="sf-demo-grid">
            <Button variant="primary">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="danger">Danger Button</Button>
            <Button disabled>Disabled Button</Button>
            <Button loading={loading} onClick={handleLoadingDemo}>
              {loading ? 'Loading...' : 'Click to Load'}
            </Button>
          </div>
        </div>

        {/* Form Inputs Section */}
        <div className="sf-demo-section">
          <h3 className="sf-demo-section__title">Form Inputs</h3>
          <div className="sf-demo-grid sf-demo-grid--vertical">
            <Input
              label="Username"
              placeholder="Enter your username"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
            />
            <Input
              label="Error Example"
              placeholder="This field has an error"
              error="This field is required"
            />
            <Input
              label="Disabled Input"
              placeholder="This is disabled"
              disabled
            />
          </div>
        </div>

        {/* Toggle Switches Section */}
        <div className="sf-demo-section">
          <h3 className="sf-demo-section__title">Toggle Switches</h3>
          <div className="sf-demo-grid">
            <Toggle
              label="Enable notifications"
              checked={toggleValue}
              onChange={setToggleValue}
            />
            <Toggle
              label="Dark mode"
              checked={false}
              size="small"
            />
            <Toggle
              label="Auto-save"
              checked={true}
              size="large"
            />
            <Toggle
              label="Disabled toggle"
              checked={false}
              disabled
            />
          </div>
        </div>

        {/* Progress Bars Section */}
        <div className="sf-demo-section">
          <h3 className="sf-demo-section__title">Progress Indicators</h3>
          <div className="sf-demo-grid sf-demo-grid--vertical">
            <ProgressBar
              label="Upload Progress"
              value={progress}
              max={100}
            />
            <ProgressBar
              label="Loading"
              value={35}
              max={100}
              size="small"
            />
            <ProgressBar
              value={80}
              max={100}
              showPercent={false}
            />
            <div className="sf-demo-controls">
              <Button onClick={decrementProgress} size="small">-10%</Button>
              <Button onClick={incrementProgress} size="small">+10%</Button>
            </div>
          </div>
        </div>

        {/* Tooltips Section */}
        <div className="sf-demo-section">
          <h3 className="sf-demo-section__title">Tooltips</h3>
          <div className="sf-demo-grid">
            <Tooltip content="This is a top tooltip" position="top">
              <Button variant="ghost">Hover me (Top)</Button>
            </Tooltip>
            <Tooltip content="This is a bottom tooltip" position="bottom">
              <Button variant="ghost">Hover me (Bottom)</Button>
            </Tooltip>
            <Tooltip content="Click tooltip that stays open" trigger="click">
              <Button variant="ghost">Click me</Button>
            </Tooltip>
          </div>
        </div>

        {/* Loading Spinners Section */}
        <div className="sf-demo-section">
          <h3 className="sf-demo-section__title">Loading Spinners</h3>
          <div className="sf-demo-grid">
            <Spinner size="small" />
            <Spinner size="medium" />
            <Spinner size="large" />
            <Spinner color="secondary" />
          </div>
        </div>
      </div>
    </section>
  );
};

// Export individual components and demo
export {
  Button,
  Input,
  Toggle,
  ProgressBar,
  Tooltip,
  Spinner
};

export default InteractiveElements;