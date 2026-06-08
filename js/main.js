/* THE CULINARY ATLAS - GLOBAL JAVASCRIPT */

document.addEventListener('DOMContentLoaded', () => {
  initPreloader();
  initPageTransition();
  injectCuisineSwitcher();
  initMobileMenu();
  initStickyBottomBar();
  optimizeImages();
  initImageFallback();
  initScrollReveal();
  initHeaderScroll();
});

/* 1. Page Transition System */
function initPageTransition() {
  // Create transition overlay element if it doesn't exist
  if (!document.querySelector('.page-transition-overlay')) {
    const overlay = document.createElement('div');
    overlay.className = 'page-transition-overlay';
    overlay.innerHTML = `<div class="transition-logo">THE CULINARY ATLAS</div>`;
    document.body.appendChild(overlay);
  }

  const overlay = document.querySelector('.page-transition-overlay');

  const removeOverlay = () => {
    overlay.classList.add('exit');
    setTimeout(() => {
      overlay.classList.remove('active', 'exit');
      overlay.style.transform = 'translateY(100%)';
    }, 800);
  };

  // Transition out on load
  setTimeout(removeOverlay, 100);

  // Robustly handle browser Back/Forward Cache (bfcache) restore
  window.addEventListener('pageshow', (event) => {
    removeOverlay();
  });

  // Intercept all link clicks for internal pages
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    const target = link.getAttribute('target');

    // Skip if external, empty, or hash link
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || target === '_blank') return;

    // Check if the link is an anchor on the current page (e.g. "italian.html#pasta")
    try {
      const url = new URL(link.href);
      const currentUrl = new URL(window.location.href);
      
      if (url.protocol === currentUrl.protocol && url.host === currentUrl.host) {
        // Normalize pathname (strip trailing slashes, index.html, and lower-case it)
        const normalizePath = (p) => {
          let path = p.toLowerCase().replace(/\/$/, '');
          if (path.endsWith('/index.html')) {
            path = path.slice(0, -11);
          }
          return path || '/';
        };

        const targetPath = normalizePath(url.pathname);
        const currentPath = normalizePath(currentUrl.pathname);

        // If it targets the same page and has a hash/anchor, skip transition overlay
        if (targetPath === currentPath && url.hash) {
          return;
        }
      }
    } catch (err) {
      // Fallback string matching in case URL parsing fails
      const hashIndex = href.indexOf('#');
      if (hashIndex !== -1) {
        const pathBeforeHash = href.substring(0, hashIndex).toLowerCase();
        const currentPath = window.location.pathname.split('/').pop().toLowerCase();
        
        const norm = (p) => (p === '' || p === 'index.html') ? 'index' : p;
        if (norm(pathBeforeHash) === norm(currentPath)) {
          return;
        }
      }
    }
    
    // Check if it's a relative internal link
    if (link.hostname === window.location.hostname) {
      // Double check anchor link to current page to prevent false positive overlays
      try {
        const url = new URL(link.href);
        const currentUrl = new URL(window.location.href);
        const targetPath = url.pathname.toLowerCase().replace(/\/$/, '').replace('/index.html', '');
        const currentPath = currentUrl.pathname.toLowerCase().replace(/\/$/, '').replace('/index.html', '');
        if (targetPath === currentPath && url.hash) {
          return;
        }
      } catch(e) {}

      e.preventDefault();
      
      // Slide up overlay
      overlay.style.transform = 'translateY(100%)';
      overlay.offsetHeight; // force repaint
      overlay.style.transform = 'translateY(0)';
      overlay.classList.add('active');

      setTimeout(() => {
        window.location.href = href;
      }, 800);
    }
  });
}

/* 2. Dynamic Floating Cuisine Switcher Injection */
function injectCuisineSwitcher() {
  const currentPath = window.location.pathname;
  
  // Define switcher links
  const cuisines = [
    { name: 'Atlas', path: 'index.html', key: 'home' },
    { name: 'Italian', path: 'italian.html', key: 'italian' },
    { name: 'Indian', path: 'indian.html', key: 'indian' },
    { name: 'Chinese', path: 'chinese.html', key: 'chinese' },
    { name: 'Japanese', path: 'japanese.html', key: 'japanese' },
    { name: 'Mexican', path: 'mexican.html', key: 'mexican' }
  ];

  // Create switcher elements
  const container = document.createElement('div');
  container.className = 'cuisine-switcher-container';
  
  const switcher = document.createElement('div');
  switcher.className = 'cuisine-switcher';
  
  cuisines.forEach(c => {
    const item = document.createElement('a');
    item.href = c.path;
    item.className = 'switcher-item';
    item.textContent = c.name;
    
    // Check active state
    const isHomeActive = c.key === 'home' && (currentPath.endsWith('/') || currentPath.endsWith('index.html') || currentPath === '');
    const isCuisineActive = currentPath.includes(c.path) && c.path !== 'index.html';
    
    if (isHomeActive || isCuisineActive) {
      item.classList.add('active');
      // Set body class for page-specific switcher overrides
      document.body.classList.add(`cuisine-${c.key}`);
    }
    
    switcher.appendChild(item);
  });
  
  container.appendChild(switcher);
  document.body.appendChild(container);
}

/* 3. Mobile Hamburger Navigation Menu & Luxury Drawer */
function initMobileMenu() {
  const header = document.querySelector('header');
  if (!header) return;

  // 1. Ensure mobile menu toggle hamburger button exists in header
  let toggle = header.querySelector('.mobile-menu-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.className = 'mobile-menu-toggle';
    toggle.setAttribute('aria-label', 'Toggle Menu');
    toggle.innerHTML = '<span></span><span></span><span></span>';
    header.appendChild(toggle);
  }

  // 2. Create the Luxury Mobile Drawer dynamically if not present
  let drawer = document.querySelector('.luxury-mobile-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.className = 'luxury-mobile-drawer';
    drawer.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-title">THE CULINARY ATLAS</div>
        <button class="drawer-close" aria-label="Close Menu">&times;</button>
      </div>
      <div class="drawer-nav"></div>
    `;
    document.body.appendChild(drawer);
  }

  const drawerNav = drawer.querySelector('.drawer-nav');
  const drawerClose = drawer.querySelector('.drawer-close');

  // 3. Populate drawer with nav links from the active page header
  const navLinks = header.querySelectorAll('nav a, .header-left a, .header-right a, .global-nav-links a');
  drawerNav.innerHTML = ''; // reset old items
  
  navLinks.forEach((link, index) => {
    const clonedLink = link.cloneNode(true);
    clonedLink.className = 'drawer-nav-item';
    clonedLink.style.animationDelay = `${0.1 + index * 0.08}s`;
    drawerNav.appendChild(clonedLink);
  });

  // 4. Drawer open/close functions
  const openDrawer = () => {
    drawer.classList.add('active');
    toggle.classList.add('open');
    document.body.classList.add('menu-open-lock');
  };

  const closeDrawer = () => {
    drawer.classList.remove('active');
    toggle.classList.remove('open');
    document.body.classList.remove('menu-open-lock');
  };

  // 5. Event bindings
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (drawer.classList.contains('active')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  drawerClose.addEventListener('click', closeDrawer);

  // Close drawer if user clicks on the outer area
  drawer.addEventListener('click', (e) => {
    if (e.target === drawer) {
      closeDrawer();
    }
  });

  // Close drawer when clicking a navigation link inside
  drawerNav.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      closeDrawer();
    }
  });

  // Close on ESC key press
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
    }
  });

  // Auto-close drawer on page show (caches handling / bfcache)
  window.addEventListener('pageshow', () => {
    closeDrawer();
  });
}

/* 3.1. Dynamic Sticky Bottom Action Bar Injection */
function initStickyBottomBar() {
  // Hide on pages representing target actions themselves (reservations, contact, order page)
  const path = window.location.pathname.toLowerCase();
  if (path.includes('reservations.html') || path.includes('contact.html') || path.includes('order.html')) {
    return;
  }

  // Check if mobile or tablet screen (<= 768px)
  if (window.innerWidth <= 768) {
    injectStickyBar();
  } else {
    // Set up window resize listener as a fail-safe
    const checkResize = () => {
      if (window.innerWidth <= 768 && !document.querySelector('.mobile-sticky-bar')) {
        injectStickyBar();
        window.removeEventListener('resize', checkResize);
      }
    };
    window.addEventListener('resize', checkResize);
  }

  function injectStickyBar() {
    if (document.querySelector('.mobile-sticky-bar')) return;

    const bar = document.createElement('div');
    bar.className = 'mobile-sticky-bar';
    bar.innerHTML = `
      <a href="reservations.html" class="sticky-bar-btn primary">
        <span>Reserve Table</span>
      </a>
      <a href="order.html" class="sticky-bar-btn secondary">
        <span>Order Online</span>
      </a>
    `;
    document.body.appendChild(bar);
    document.body.classList.add('has-sticky-bar');
  }
}

/* 3.2. Native Lazy Loading & Image Optimization Utility */
function optimizeImages() {
  const images = document.querySelectorAll('img');
  images.forEach(img => {
    if (!img.hasAttribute('loading')) {
      img.setAttribute('loading', 'lazy');
    }
  });
}

/* 4. Global Image Fallback Handler */
function initImageFallback() {
  window.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') {
      const img = e.target;
      // Add custom styles to hide alt text and broken icon
      img.style.opacity = '0';
      img.style.width = '0';
      img.style.height = '0';
      img.style.position = 'absolute';
      
      const parent = img.parentNode;
      if (parent) {
        // Make sure parent is relative to frame the absolute fallback
        const computedStyle = window.getComputedStyle(parent);
        if (computedStyle.position === 'static') {
          parent.style.position = 'relative';
        }
        
        // Check if fallback already exists in parent
        if (!parent.querySelector('.img-fallback-placeholder')) {
          const fallback = document.createElement('div');
          fallback.className = 'img-fallback-placeholder';
          fallback.innerHTML = `<span>THE CULINARY ATLAS</span>`;
          parent.appendChild(fallback);
        }
      }
    }
  }, true);
}

/* 5. Luxury Preloader Logic */
function initPreloader() {
  const preloader = document.querySelector('.luxury-preloader');
  if (preloader) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        preloader.classList.add('fade-out');
        setTimeout(() => {
          preloader.remove();
        }, 800);
      }, 500);
    });
    
    // Safety Fallback
    setTimeout(() => {
      if (document.body.contains(preloader)) {
        preloader.classList.add('fade-out');
        setTimeout(() => {
          preloader.remove();
        }, 800);
      }
    }, 3000);
  }
}

/* 6. IntersectionObserver Scroll Reveal System */
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal-on-scroll');
  if (elements.length === 0) return;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });
  
  elements.forEach(el => observer.observe(el));
}

/* 7. Header Dynamic Sticky Class */
function initHeaderScroll() {
  const header = document.querySelector('.global-header');
  if (!header) return;
  
  const checkScroll = () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };
  
  window.addEventListener('scroll', checkScroll);
  checkScroll(); // Initial check
}
