/**
 * AuroraWrite Home Page
 * Static landing page for GitHub Pages
 */

// Version is fetched from package.json via fetch or hardcoded
const VERSION = '1.0.0';

// Update version displays
function updateVersionDisplays() {
  const navVersion = document.getElementById('nav-version');
  const footerVersion = document.getElementById('footer-version');

  const versionText = `v${VERSION}`;

  if (navVersion) {
    navVersion.textContent = versionText;
  }

  if (footerVersion) {
    footerVersion.textContent = `AuroraWrite ${versionText}`;
  }
}

// Try to fetch version from package.json
async function fetchVersion() {
  try {
    const response = await fetch('../package.json');
    if (response.ok) {
      const pkg = await response.json();
      return pkg.version || VERSION;
    }
  } catch (e) {
    // Fallback to hardcoded version
  }
  return VERSION;
}

// Smooth scroll for anchor links
function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (href && href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });
}

// Intersection Observer for scroll animations
function setupScrollAnimations() {
  const animatedElements = document.querySelectorAll('.animate-on-scroll');

  // Check if user prefers reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    animatedElements.forEach(el => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    }
  );

  animatedElements.forEach((el) => observer.observe(el));
}

// Handle install button clicks
function setupInstallButtons() {
  const installButtons = document.querySelectorAll('#install-btn, #cta-install-btn');

  installButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Redirect to GitHub releases
      window.open('https://github.com/hanif-mianjee/AuroraWrite/releases', '_blank');
    });
  });
}

// Add navbar background on scroll
function setupNavbarScroll() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  const handleScroll = () => {
    if (window.scrollY > 50) {
      nav.style.background = 'rgba(255, 255, 255, 0.95)';
      nav.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    } else {
      nav.style.background = 'rgba(255, 255, 255, 0.85)';
      nav.style.boxShadow = 'none';
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // Initial check
}

// Add tooltips to issue elements
function setupIssueTooltips() {
  const issues = document.querySelectorAll('.issue[data-tooltip]');

  issues.forEach(issue => {
    const tooltip = document.createElement('div');
    tooltip.className = 'issue-tooltip';
    tooltip.textContent = issue.getAttribute('data-tooltip') || '';
    tooltip.style.cssText = `
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 12px;
      background: #0f172a;
      color: white;
      font-size: 12px;
      border-radius: 6px;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
      pointer-events: none;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

    issue.style.position = 'relative';
    issue.appendChild(tooltip);

    issue.addEventListener('mouseenter', () => {
      tooltip.style.opacity = '1';
      tooltip.style.visibility = 'visible';
    });

    issue.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
      tooltip.style.visibility = 'hidden';
    });
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Try to fetch actual version
  const version = await fetchVersion();
  window.AURORA_VERSION = version;

  updateVersionDisplays();
  setupSmoothScroll();
  setupScrollAnimations();
  setupInstallButtons();
  setupNavbarScroll();
  setupIssueTooltips();
});
