import React, { useState, useEffect, useRef } from 'react';
import './FeatureCards.css';

const FeatureCard = ({ 
  icon, 
  title, 
  description, 
  link, 
  index = 0,
  animationDelay = 0,
  isVisible = false 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef(null);

  const handleCardClick = () => {
    if (link) {
      if (link.startsWith('#')) {
        const target = document.querySelector(link);
        if (target) {
          const offset = 80;
          const targetPosition = target.offsetTop - offset;
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      } else {
        window.open(link, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div 
      ref={cardRef}
      className={`sf-feature-card ${isVisible ? 'sf-feature-card--visible' : ''} ${link ? 'sf-feature-card--clickable' : ''}`}
      style={{ 
        animationDelay: `${animationDelay}ms`,
        '--index': index 
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
      role={link ? 'button' : 'article'}
      tabIndex={link ? 0 : -1}
      onKeyDown={(e) => {
        if (link && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      {/* 3D Border Effect */}
      <div className="sf-feature-card__border">
        <div className="sf-feature-card__border-top"></div>
        <div className="sf-feature-card__border-right"></div>
        <div className="sf-feature-card__border-bottom"></div>
        <div className="sf-feature-card__border-left"></div>
      </div>

      {/* Background Glow */}
      <div className="sf-feature-card__glow"></div>

      {/* Content */}
      <div className="sf-feature-card__content">
        {/* Icon */}
        <div className="sf-feature-card__icon-wrapper">
          <div className={`sf-feature-card__icon ${isHovered ? 'sf-feature-card__icon--animated' : ''}`}>
            {typeof icon === 'string' ? (
              <span role="img" aria-hidden="true">{icon}</span>
            ) : (
              icon
            )}
          </div>
        </div>

        {/* Text Content */}
        <div className="sf-feature-card__text">
          <h3 className="sf-feature-card__title">{title}</h3>
          <p className="sf-feature-card__description">{description}</p>
        </div>

        {/* Hover Arrow */}
        {link && (
          <div className={`sf-feature-card__arrow ${isHovered ? 'sf-feature-card__arrow--visible' : ''}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M17 7H7M17 7V17"/>
            </svg>
          </div>
        )}
      </div>

      {/* Ripple Effect */}
      <div className="sf-feature-card__ripple"></div>
    </div>
  );
};

const FeatureCards = ({ 
  title = "Features",
  subtitle = "Discover what makes our platform unique",
  features = [
    {
      icon: "⚡",
      title: "Lightning Fast",
      description: "Optimized performance with cutting-edge technology for instant results.",
      link: "#performance"
    },
    {
      icon: "🔒",
      title: "Secure by Design",
      description: "Enterprise-grade security with end-to-end encryption and compliance.",
      link: "#security"
    },
    {
      icon: "🚀",
      title: "Easy Integration",
      description: "Seamless integration with your existing tools and workflows.",
      link: "#integration"
    },
    {
      icon: "📊",
      title: "Real-time Analytics",
      description: "Comprehensive insights and analytics to drive informed decisions.",
      link: "#analytics"
    },
    {
      icon: "🎯",
      title: "Precision Control",
      description: "Granular control over every aspect of your system operations.",
      link: "#control"
    },
    {
      icon: "🔄",
      title: "Auto Updates",
      description: "Stay current with automatic updates and feature enhancements.",
      link: "#updates"
    }
  ],
  columns = "auto-fit",
  minCardWidth = "300px",
  maxCardWidth = "400px",
  className = ""
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [visibleCards, setVisibleCards] = useState(new Set());
  const containerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          
          // Stagger card animations
          features.forEach((_, index) => {
            setTimeout(() => {
              setVisibleCards(prev => new Set([...prev, index]));
            }, index * 150);
          });
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [features]);

  const gridStyle = {
    gridTemplateColumns: columns === 'auto-fit' 
      ? `repeat(auto-fit, minmax(${minCardWidth}, 1fr))`
      : `repeat(${columns}, minmax(${minCardWidth}, ${maxCardWidth}))`
  };

  return (
    <section 
      ref={containerRef}
      className={`sf-feature-cards ${isVisible ? 'sf-feature-cards--visible' : ''} ${className}`}
    >
      <div className="sf-feature-cards__container">
        {/* Header */}
        <div className="sf-feature-cards__header">
          <h2 className="sf-feature-cards__title">{title}</h2>
          {subtitle && (
            <p className="sf-feature-cards__subtitle">{subtitle}</p>
          )}
        </div>

        {/* Feature Grid */}
        <div 
          className="sf-feature-cards__grid"
          style={gridStyle}
        >
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              link={feature.link}
              index={index}
              animationDelay={index * 150}
              isVisible={visibleCards.has(index)}
            />
          ))}
        </div>

        {/* Optional Call-to-Action */}
        {features.length > 6 && (
          <div className={`sf-feature-cards__cta ${isVisible ? 'sf-feature-cards__cta--visible' : ''}`}>
            <button className="sf-feature-cards__cta-button">
              View All Features
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12H19M12 5L19 12L12 19"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Background Elements */}
      <div className="sf-feature-cards__background">
        <div className="sf-feature-cards__bg-grid"></div>
        <div className="sf-feature-cards__bg-gradient"></div>
      </div>
    </section>
  );
};

export default FeatureCards;