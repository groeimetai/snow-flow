import React, { useState, useEffect } from 'react';
import './Navigation.css';

const Navigation = ({ 
  logo = "⚡", 
  brandName = "Snow-Flow", 
  navItems = [
    { href: "#home", label: "Home" },
    { href: "#features", label: "Features" },
    { href: "#about", label: "About" },
    { href: "#contact", label: "Contact" }
  ],
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset;
      setScrolled(scrollTop > 50);
      
      // Update active section based on scroll position
      const sections = navItems.map(item => item.href.replace('#', ''));
      let current = 'home';
      
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom >= 100) {
            current = section;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [navItems]);

  const handleNavClick = (e, href) => {
    e.preventDefault();
    setIsOpen(false);
    
    if (href.startsWith('#')) {
      const target = document.querySelector(href);
      if (target) {
        const offset = 80;
        const targetPosition = target.offsetTop - offset;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    }
  };

  const toggleMobileMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className={`sf-nav ${scrolled ? 'sf-nav--scrolled' : ''} ${className}`}>
      <div className="sf-nav__container">
        {/* Logo and Brand */}
        <div className="sf-nav__brand" onClick={(e) => handleNavClick(e, '#home')}>
          <span className="sf-nav__logo">{logo}</span>
          <span className="sf-nav__brand-name">{brandName}</span>
        </div>

        {/* Desktop Navigation */}
        <ul className={`sf-nav__menu ${isOpen ? 'sf-nav__menu--open' : ''}`}>
          {navItems.map((item, index) => (
            <li key={index} className="sf-nav__item">
              <a
                href={item.href}
                className={`sf-nav__link ${
                  activeSection === item.href.replace('#', '') ? 'sf-nav__link--active' : ''
                }`}
                onClick={(e) => handleNavClick(e, item.href)}
              >
                {item.label}
                <span className="sf-nav__link-indicator"></span>
              </a>
            </li>
          ))}
          
          {/* CTA Button */}
          <li className="sf-nav__item">
            <a href="#get-started" className="sf-nav__cta" onClick={(e) => handleNavClick(e, '#get-started')}>
              Get Started
            </a>
          </li>
        </ul>

        {/* Mobile Hamburger */}
        <button 
          className={`sf-nav__hamburger ${isOpen ? 'sf-nav__hamburger--open' : ''}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* Scroll Progress Indicator */}
      <div className="sf-nav__progress">
        <div 
          className="sf-nav__progress-bar"
          style={{
            width: `${Math.min(100, (window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight)) * 100)}%`
          }}
        ></div>
      </div>
    </nav>
  );
};

export default Navigation;