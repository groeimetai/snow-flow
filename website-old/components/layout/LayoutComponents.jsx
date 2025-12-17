import React from 'react';
import './LayoutComponents.css';

// Container Component
const Container = ({ 
  children, 
  maxWidth = '1200px',
  padding = 'medium',
  fluid = false,
  className = '',
  ...props 
}) => (
  <div 
    className={`sf-container sf-container--${padding} ${fluid ? 'sf-container--fluid' : ''} ${className}`}
    style={{ maxWidth: fluid ? '100%' : maxWidth }}
    {...props}
  >
    {children}
  </div>
);

// Grid Component
const Grid = ({ 
  children,
  columns = 'auto',
  gap = 'medium',
  alignItems = 'stretch',
  justifyContent = 'start',
  responsive = true,
  className = '',
  ...props 
}) => {
  const gridColumns = typeof columns === 'number' 
    ? `repeat(${columns}, 1fr)`
    : columns === 'auto' 
    ? 'repeat(auto-fit, minmax(250px, 1fr))'
    : columns;

  const style = {
    gridTemplateColumns: gridColumns,
    alignItems,
    justifyContent,
    ...props.style
  };

  return (
    <div 
      className={`sf-grid sf-grid--gap-${gap} ${responsive ? 'sf-grid--responsive' : ''} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
};

// Flex Component
const Flex = ({ 
  children,
  direction = 'row',
  align = 'stretch',
  justify = 'start',
  wrap = false,
  gap = 'medium',
  className = '',
  ...props 
}) => (
  <div 
    className={`sf-flex sf-flex--${direction} sf-flex--align-${align} sf-flex--justify-${justify} ${wrap ? 'sf-flex--wrap' : ''} sf-flex--gap-${gap} ${className}`}
    {...props}
  >
    {children}
  </div>
);

// Section Component
const Section = ({ 
  children,
  background = 'default',
  padding = 'large',
  className = '',
  ...props 
}) => (
  <section 
    className={`sf-section sf-section--bg-${background} sf-section--padding-${padding} ${className}`}
    {...props}
  >
    {children}
  </section>
);

// Divider Component
const Divider = ({ 
  type = 'line',
  orientation = 'horizontal',
  gradient = false,
  animated = false,
  thickness = 'thin',
  className = ''
}) => {
  if (type === 'space') {
    return <div className={`sf-divider sf-divider--space sf-divider--${thickness} ${className}`} />;
  }

  return (
    <div 
      className={`sf-divider sf-divider--${type} sf-divider--${orientation} sf-divider--${thickness} ${gradient ? 'sf-divider--gradient' : ''} ${animated ? 'sf-divider--animated' : ''} ${className}`}
    >
      {type === 'dots' && (
        <div className="sf-divider__dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}
      {type === 'wave' && (
        <svg className="sf-divider__wave" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M985.66,92.83C906.67,72,823.78,31,743.84,14.19c-82.26-17.34-168.06-16.33-250.45.39-57.84,11.73-114,31.07-172,41.86A600.21,600.21,0,0,1,0,27.35V120H1200V95.8C1132.19,118.92,1055.71,111.31,985.66,92.83Z"/>
        </svg>
      )}
    </div>
  );
};

// Card Component
const Card = ({ 
  children,
  elevation = 'medium',
  padding = 'medium',
  radius = 'medium',
  border = false,
  hover = false,
  className = '',
  ...props 
}) => (
  <div 
    className={`sf-card sf-card--elevation-${elevation} sf-card--padding-${padding} sf-card--radius-${radius} ${border ? 'sf-card--border' : ''} ${hover ? 'sf-card--hover' : ''} ${className}`}
    {...props}
  >
    {children}
  </div>
);

// Stack Component
const Stack = ({ 
  children,
  spacing = 'medium',
  direction = 'vertical',
  align = 'start',
  className = '',
  ...props 
}) => (
  <div 
    className={`sf-stack sf-stack--${direction} sf-stack--spacing-${spacing} sf-stack--align-${align} ${className}`}
    {...props}
  >
    {children}
  </div>
);

// Spacer Component
const Spacer = ({ 
  size = 'medium',
  responsive = true,
  className = ''
}) => (
  <div className={`sf-spacer sf-spacer--${size} ${responsive ? 'sf-spacer--responsive' : ''} ${className}`} />
);

// Center Component
const Center = ({ 
  children,
  height = 'auto',
  className = '',
  ...props 
}) => (
  <div 
    className={`sf-center ${className}`}
    style={{ height }}
    {...props}
  >
    {children}
  </div>
);

// Demo Component showcasing all layout components
const LayoutComponents = () => (
  <div className="sf-layout-demo">
    <Container>
      <Stack spacing="large">
        <div className="sf-layout-demo__header">
          <h1 className="sf-layout-demo__title">Layout Components</h1>
          <p className="sf-layout-demo__subtitle">
            Essential building blocks for creating structured, responsive layouts
          </p>
        </div>

        {/* Container Demo */}
        <Section background="light" padding="large">
          <Stack spacing="medium">
            <h2 className="sf-demo-title">Container</h2>
            <p>Responsive containers with configurable max-widths and padding</p>
            
            <Card padding="small" border>
              <Container maxWidth="800px" padding="medium">
                <p>This content is inside a container with max-width: 800px</p>
              </Container>
            </Card>
            
            <Card padding="small" border>
              <Container fluid padding="small">
                <p>This is a fluid container that takes full width</p>
              </Container>
            </Card>
          </Stack>
        </Section>

        {/* Grid Demo */}
        <Section>
          <Stack spacing="medium">
            <h2 className="sf-demo-title">Grid System</h2>
            <p>Flexible CSS Grid layouts with responsive behavior</p>
            
            <div className="sf-demo-grid-container">
              <h3>Auto-fit Grid (default)</h3>
              <Grid gap="medium">
                <Card>Item 1</Card>
                <Card>Item 2</Card>
                <Card>Item 3</Card>
                <Card>Item 4</Card>
              </Grid>
            </div>
            
            <div className="sf-demo-grid-container">
              <h3>3-Column Fixed Grid</h3>
              <Grid columns={3} gap="small">
                <Card>Column 1</Card>
                <Card>Column 2</Card>
                <Card>Column 3</Card>
              </Grid>
            </div>
          </Stack>
        </Section>

        {/* Flex Demo */}
        <Section background="light">
          <Stack spacing="medium">
            <h2 className="sf-demo-title">Flex Layouts</h2>
            <p>Flexbox utilities for common layout patterns</p>
            
            <div className="sf-demo-flex-container">
              <h3>Horizontal Flex (space-between)</h3>
              <Flex justify="space-between" align="center">
                <Card padding="small">Left</Card>
                <Card padding="small">Center</Card>
                <Card padding="small">Right</Card>
              </Flex>
            </div>
            
            <div className="sf-demo-flex-container">
              <h3>Vertical Flex with Gap</h3>
              <Flex direction="column" gap="small" style={{height: '200px'}}>
                <Card padding="small">Top</Card>
                <Card padding="small">Middle</Card>
                <Card padding="small">Bottom</Card>
              </Flex>
            </div>
          </Stack>
        </Section>

        {/* Dividers Demo */}
        <Section>
          <Stack spacing="medium">
            <h2 className="sf-demo-title">Dividers</h2>
            <p>Various divider styles to separate content</p>
            
            <div className="sf-divider-demo">
              <Card padding="small">Content above</Card>
              <Divider />
              <Card padding="small">Content below (line divider)</Card>
              
              <Divider type="dots" />
              <Card padding="small">Content below (dots divider)</Card>
              
              <Divider gradient animated />
              <Card padding="small">Content below (gradient animated divider)</Card>
              
              <Divider type="wave" />
              <Card padding="small">Content below (wave divider)</Card>
            </div>
          </Stack>
        </Section>

        {/* Cards Demo */}
        <Section background="light">
          <Stack spacing="medium">
            <h2 className="sf-demo-title">Cards</h2>
            <p>Card components with various elevations and styles</p>
            
            <Grid columns={3} gap="medium">
              <Card elevation="low" padding="medium">
                <h3>Low Elevation</h3>
                <p>Subtle shadow for minimal depth</p>
              </Card>
              
              <Card elevation="medium" padding="medium" hover>
                <h3>Medium Elevation + Hover</h3>
                <p>Standard elevation with hover effect</p>
              </Card>
              
              <Card elevation="high" padding="medium" border>
                <h3>High Elevation + Border</h3>
                <p>Strong shadow with border accent</p>
              </Card>
            </Grid>
          </Stack>
        </Section>

        {/* Stack and Spacing Demo */}
        <Section>
          <Stack spacing="medium">
            <h2 className="sf-demo-title">Stack & Spacing</h2>
            <p>Consistent spacing utilities and stacking layouts</p>
            
            <div className="sf-stack-demo">
              <h3>Vertical Stack with Medium Spacing</h3>
              <Stack spacing="medium">
                <Card padding="small">Item 1</Card>
                <Card padding="small">Item 2</Card>
                <Card padding="small">Item 3</Card>
              </Stack>
              
              <Spacer size="large" />
              
              <h3>Horizontal Stack</h3>
              <Stack direction="horizontal" spacing="small">
                <Card padding="small">A</Card>
                <Card padding="small">B</Card>
                <Card padding="small">C</Card>
              </Stack>
            </div>
          </Stack>
        </Section>

        {/* Center Demo */}
        <Section background="light">
          <Stack spacing="medium">
            <h2 className="sf-demo-title">Centering</h2>
            <p>Perfect centering for content</p>
            
            <Card border style={{height: '200px'}}>
              <Center height="100%">
                <Card padding="medium">
                  <h3>Perfectly Centered</h3>
                  <p>Both horizontally and vertically</p>
                </Card>
              </Center>
            </Card>
          </Stack>
        </Section>
      </Stack>
    </Container>
  </div>
);

// Export all components
export {
  Container,
  Grid,
  Flex,
  Section,
  Divider,
  Card,
  Stack,
  Spacer,
  Center
};

export default LayoutComponents;