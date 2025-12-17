# Snow-Flow Website 🏔️

Official documentation website for Snow-Flow - Advanced ServiceNow Development Framework.

## Overview

This website provides comprehensive documentation for Snow-Flow, including:
- Complete feature overview
- Installation guides
- API documentation for all 16+ MCP servers
- 200+ tool references
- Real-world examples
- Best practices

## Structure

```
website/
├── index.html           # Main landing page
├── css/
│   ├── style.css       # Main styles
│   └── api-docs.css    # API documentation styles
├── js/
│   └── main.js         # Interactive functionality
├── docs/
│   └── api-full.html   # Complete API reference
├── examples/           # Code examples (to be added)
└── images/            # Images and assets
```

## Features

- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Interactive Navigation**: Smooth scrolling and active section highlighting
- **Code Highlighting**: Syntax highlighting with Prism.js
- **Copy Code**: One-click code copying
- **Search Functionality**: Search through MCP tools
- **Animation**: Smooth animations and transitions
- **Dark Theme Code Blocks**: Easy-to-read code examples

## Local Development

To run the website locally:

```bash
# Using Python (Python 3)
python -m http.server 8000

# Using Python (Python 2)
python -m SimpleHTTPServer 8000

# Using Node.js
npx http-server

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## Deployment

### 🚀 Production (Google Cloud Run)

**Live Website:** https://snow-flow-website-[hash]-ew.a.run.app

**Automated CI/CD Pipeline:**
- **Trigger:** Push to `main` branch on GitHub
- **Build:** Google Cloud Build creates Docker image
- **Deploy:** Automatically deploys to Cloud Run
- **Monitor:** Health checks and logging enabled

### Docker Deployment

```bash
# Build the Docker image
docker build -t snow-flow-website .

# Run locally
docker run -p 8080:80 snow-flow-website

# Test health check
curl http://localhost:8080/health
```

### Cloud Run Manual Deploy

```bash
# Set project
gcloud config set project YOUR_PROJECT_ID

# Deploy directly from source
gcloud run deploy snow-flow-website \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated

# Or use Cloud Build
gcloud builds submit --config cloudbuild.yaml .
```

### Static Hosting Options

### GitHub Pages
1. Push to GitHub repository
2. Enable GitHub Pages in repository settings
3. Select source branch and folder

### Netlify
1. Connect GitHub repository
2. Set build settings (no build command needed)
3. Deploy

### Vercel
```bash
npx vercel
```

### Traditional Hosting
Simply upload all files to your web server's public directory.

## Adding Examples

To add your own ServiceNow examples:

1. Navigate to the "Examples" section
2. Find the "Your Examples" placeholder card
3. Add your code examples in the designated area
4. Examples should demonstrate real ServiceNow implementations

## Customization

### Colors
Edit the CSS variables in `css/style.css`:

```css
:root {
    --primary-color: #0066cc;
    --secondary-color: #00a6ff;
    --accent-color: #00d4ff;
    /* ... */
}
```

### Logo
The logo uses emojis (🏔️). To change it, update all instances in:
- `index.html`
- `docs/api-full.html`

### Content
All content is in HTML files and can be edited directly:
- Main content: `index.html`
- API documentation: `docs/api-full.html`

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Technologies Used

- **HTML5**: Semantic markup
- **CSS3**: Modern styling with CSS Grid and Flexbox
- **JavaScript**: Vanilla JS for maximum performance
- **Prism.js**: Code syntax highlighting
- **Google Fonts**: Inter font family

## Contributing

To contribute to the documentation:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - Same as Snow-Flow

## Contact

- GitHub: [https://github.com/groeimetai/snow-flow](https://github.com/groeimetai/snow-flow)
- NPM: [https://www.npmjs.com/package/snow-flow](https://www.npmjs.com/package/snow-flow)

---

Built with ❤️ for the ServiceNow developer community