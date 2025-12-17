import React, { useState, useEffect, useRef } from 'react';
import './Hero.css';

const Hero = ({
  title = "Snow-Flow",
  subtitle = "Advanced ServiceNow Development Framework",
  description = "Revolutionize your ServiceNow development with AI-powered automation, intelligent orchestration, and cutting-edge tools designed for the modern enterprise.",
  primaryCTA = { text: "Get Started", href: "#get-started" },
  secondaryCTA = { text: "Learn More", href: "#features" },
  stats = [
    { number: "23", label: "Enterprise MCP Servers" },
    { number: "355+", label: "Enterprise Tools" },
    { number: "85%", label: "Memory Optimized" },
    { number: "100%", label: "Real Data" }
  ],
  backgroundAnimation = true,
  typewriterEffect = true,
  className = ""
}) => {
  const [displayedTitle, setDisplayedTitle] = useState('');
  const [titleComplete, setTitleComplete] = useState(false);
  const [displayedSubtitle, setDisplayedSubtitle] = useState('');
  const [subtitleComplete, setSubtitleComplete] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const heroRef = useRef(null);

  // Intersection Observer for entrance animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Typewriter effect for title
  useEffect(() => {
    if (!typewriterEffect || !isVisible) return;

    let index = 0;
    const typeTitle = () => {
      if (index < title.length) {
        setDisplayedTitle(title.slice(0, index + 1));
        index++;
        setTimeout(typeTitle, 100);
      } else {
        setTitleComplete(true);
      }
    };

    const timer = setTimeout(typeTitle, 500);
    return () => clearTimeout(timer);
  }, [title, typewriterEffect, isVisible]);

  // Typewriter effect for subtitle
  useEffect(() => {
    if (!typewriterEffect || !titleComplete) return;

    let index = 0;
    const typeSubtitle = () => {
      if (index < subtitle.length) {
        setDisplayedSubtitle(subtitle.slice(0, index + 1));
        index++;
        setTimeout(typeSubtitle, 50);
      } else {
        setSubtitleComplete(true);
      }
    };

    const timer = setTimeout(typeSubtitle, 300);
    return () => clearTimeout(timer);
  }, [subtitle, typewriterEffect, titleComplete]);

  // Set initial text if typewriter is disabled
  useEffect(() => {
    if (!typewriterEffect) {
      setDisplayedTitle(title);
      setDisplayedSubtitle(subtitle);
      setTitleComplete(true);
      setSubtitleComplete(true);
    }
  }, [title, subtitle, typewriterEffect]);

  const handleCTAClick = (e, href) => {
    e.preventDefault();
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
    } else {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <section 
      ref={heroRef}
      className={`sf-hero ${isVisible ? 'sf-hero--visible' : ''} ${className}`}
    >
      {backgroundAnimation && (
        <>
          {/* Animated Background Mesh */}
          <div className="sf-hero__background">
            <div className="sf-hero__mesh">
              {Array.from({ length: 50 }, (_, i) => (
                <div 
                  key={i} 
                  className="sf-hero__mesh-dot"
                  style={{
                    animationDelay: `${Math.random() * 5}s`,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`
                  }}
                />
              ))}
            </div>
            
            {/* Gradient Orbs */}
            <div className="sf-hero__orb sf-hero__orb--1"></div>
            <div className="sf-hero__orb sf-hero__orb--2"></div>
            <div className="sf-hero__orb sf-hero__orb--3"></div>
          </div>
        </>
      )}

      <div className="sf-hero__container">
        <div className="sf-hero__content">
          {/* Main Title */}
          <h1 className="sf-hero__title">
            {displayedTitle}
            {typewriterEffect && !titleComplete && (
              <span className="sf-hero__cursor">|</span>
            )}
          </h1>

          {/* Subtitle */}
          <h2 className="sf-hero__subtitle">
            {displayedSubtitle}
            {typewriterEffect && titleComplete && !subtitleComplete && (
              <span className="sf-hero__cursor">|</span>
            )}
          </h2>

          {/* Description */}
          <p className={`sf-hero__description ${subtitleComplete ? 'sf-hero__description--visible' : ''}`}>
            {description}
          </p>

          {/* CTA Buttons */}
          <div className={`sf-hero__actions ${subtitleComplete ? 'sf-hero__actions--visible' : ''}`}>
            <button
              className="sf-hero__cta sf-hero__cta--primary"
              onClick={(e) => handleCTAClick(e, primaryCTA.href)}
            >
              {primaryCTA.text}
              <span className="sf-hero__cta-ripple"></span>
            </button>
            
            <button
              className="sf-hero__cta sf-hero__cta--secondary"
              onClick={(e) => handleCTAClick(e, secondaryCTA.href)}
            >
              {secondaryCTA.text}
              <span className="sf-hero__cta-arrow">→</span>
            </button>
          </div>

          {/* Stats */}
          {stats && stats.length > 0 && (
            <div className={`sf-hero__stats ${subtitleComplete ? 'sf-hero__stats--visible' : ''}`}>
              {stats.map((stat, index) => (
                <div 
                  key={index} 
                  className="sf-hero__stat"
                  style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                >
                  <div className="sf-hero__stat-number">{stat.number}</div>
                  <div className="sf-hero__stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scroll Indicator */}
        <div className={`sf-hero__scroll-indicator ${subtitleComplete ? 'sf-hero__scroll-indicator--visible' : ''}`}>
          <div className="sf-hero__scroll-arrow">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className="sf-hero__scroll-text">Scroll to explore</span>
        </div>
      </div>
    </section>
  );
};

export default Hero;