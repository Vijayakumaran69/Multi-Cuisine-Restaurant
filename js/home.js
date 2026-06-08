/* HOME PAGE - INTERACTIVE CONTROLS */

document.addEventListener('DOMContentLoaded', () => {
  initMapNavigation();
  initAccordionHover();
  initChefCarousel();
  initStatsCounter();
  initHeroParallax();
  initGalleryFilters();
  initLightbox();
  initTestimonialCarousel();
});

/* 1. Map Interaction & Navigation */
function initMapNavigation() {
  const nodes = document.querySelectorAll('.map-node[data-target]');
  
  // Mapping of targets (cuisines) to line classes (countries)
  const countryMap = {
    mexican: 'mexico',
    italian: 'italy',
    indian: 'india',
    chinese: 'china',
    japanese: 'japan'
  };

  // Safe loading of discovered destinations from localStorage for progression persistence
  let discoveredDestinations = [];
  try {
    discoveredDestinations = JSON.parse(localStorage.getItem('discovered_destinations') || '[]');
  } catch (err) {
    console.warn('LocalStorage is blocked or unavailable:', err);
  }

  // Mark already discovered destinations on page load
  nodes.forEach(node => {
    const target = node.getAttribute('data-target');
    if (discoveredDestinations.includes(target)) {
      node.classList.add('discovered');
      const country = countryMap[target] || target;
      const line = document.querySelector(`.travel-line.line-${country}`);
      if (line) {
        line.classList.add('discovered');
      }
    }
  });

  nodes.forEach(node => {
    node.addEventListener('mouseenter', () => {
      const target = node.getAttribute('data-target');
      const country = countryMap[target] || target;
      const line = document.querySelector(`.travel-line.line-${country}`);

      node.classList.add('active-hover');
      if (line) {
        line.classList.add('active-line');
      }

      // Discover on hover if not already discovered
      if (!node.classList.contains('discovered')) {
        node.classList.add('discovered');
        node._justDiscovered = true;
        
        // Reset this flag after a short delay so click can differentiate between a tap-to-discover vs navigation
        setTimeout(() => {
          node._justDiscovered = false;
        }, 300);

        if (line) {
          line.classList.add('discovered');
        }

        // Save progress to localStorage
        if (!discoveredDestinations.includes(target)) {
          discoveredDestinations.push(target);
          try {
            localStorage.setItem('discovered_destinations', JSON.stringify(discoveredDestinations));
          } catch (err) {
            console.warn('Failed to save discovered destination to LocalStorage:', err);
          }
        }
      }
    });

    node.addEventListener('mouseleave', () => {
      const target = node.getAttribute('data-target');
      const country = countryMap[target] || target;
      const line = document.querySelector(`.travel-line.line-${country}`);

      node.classList.remove('active-hover');
      if (line) {
        line.classList.remove('active-line');
      }
    });

    node.addEventListener('click', (e) => {
      // If the node was just discovered during this touch interaction, prevent immediate navigation
      if (node._justDiscovered) {
        e.preventDefault();
        e.stopPropagation();
        node._justDiscovered = false;
        return;
      }

      const target = node.getAttribute('data-target');
      const country = countryMap[target] || target;
      const line = document.querySelector(`.travel-line.line-${country}`);

      // Fail-safe: if click occurs on an undiscovered node (e.g. bypasses mouseenter on mobile)
      if (!node.classList.contains('discovered')) {
        node.classList.add('discovered');
        if (line) {
          line.classList.add('discovered');
        }

        // Save progress
        if (!discoveredDestinations.includes(target)) {
          discoveredDestinations.push(target);
          try {
            localStorage.setItem('discovered_destinations', JSON.stringify(discoveredDestinations));
          } catch (err) {
            console.warn('Failed to save discovered destination to LocalStorage:', err);
          }
        }

        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Already discovered - navigate to the destination page
      const targetUrl = `${target}.html`;
      const overlay = document.querySelector('.page-transition-overlay');
      if (overlay) {
        overlay.style.transform = 'translateY(100%)';
        overlay.offsetHeight; // force reflow
        overlay.style.transform = 'translateY(0)';
        overlay.classList.add('active');

        setTimeout(() => {
          window.location.href = targetUrl;
        }, 800);
      } else {
        window.location.href = targetUrl;
      }
    });
  });
}

/* 2. Destination Cards Accordion Hover & Touch Toggle */
function initAccordionHover() {
  const cards = document.querySelectorAll('.accordion-card');
  if (cards.length === 0) return;

  cards.forEach(card => {
    // Desktop hover reveal behavior
    card.addEventListener('mouseenter', () => {
      // Only apply hover if device supports hover
      if (window.matchMedia('(hover: hover)').matches) {
        cards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      }
    });

    // Touch friendly: click/tap toggle
    card.addEventListener('click', (e) => {
      // If card is not active, first tap should expand it and prevent navigation
      if (!card.classList.contains('active')) {
        e.preventDefault();
        e.stopPropagation();
        cards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      }
      // If card is active, let click proceed to navigation naturally
    });
  });
}

/* 3. Chef Collective Carousel Controls with Touch Swiping */
function initChefCarousel() {
  const cards = document.querySelectorAll('.chef-card');
  const indicators = document.querySelectorAll('.indicator');
  const section = document.querySelector('.chef-collective-section');
  if (cards.length === 0) return;
  
  let currentIndex = 0;
  let autoplayTimer;

  function showSlide(index) {
    // Bounds wrap
    if (index >= cards.length) index = 0;
    if (index < 0) index = cards.length - 1;

    cards.forEach(c => c.classList.remove('active'));
    indicators.forEach(ind => ind.classList.remove('active'));

    cards[index].classList.add('active');
    indicators[index].classList.add('active');
    currentIndex = index;
  }

  indicators.forEach(indicator => {
    indicator.addEventListener('click', () => {
      clearInterval(autoplayTimer);
      const slideIndex = parseInt(indicator.getAttribute('data-slide'));
      showSlide(slideIndex);
      startAutoplay();
    });
  });

  // Touch Swipe Gesture Support
  if (section) {
    let touchStartX = 0;
    let touchEndX = 0;

    section.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    section.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      if (touchEndX < touchStartX - 50) {
        // Swipe Left: Next slide
        clearInterval(autoplayTimer);
        showSlide(currentIndex + 1);
        startAutoplay();
      } else if (touchEndX > touchStartX + 50) {
        // Swipe Right: Prev slide
        clearInterval(autoplayTimer);
        showSlide(currentIndex - 1);
        startAutoplay();
      }
    }, { passive: true });
  }

  function startAutoplay() {
    autoplayTimer = setInterval(() => {
      showSlide((currentIndex + 1) % cards.length);
    }, 6000); // Swaps every 6 seconds
  }

  startAutoplay();
}

/* 4. Statistics Counter Scroll-to-View Animation */
function initStatsCounter() {
  const statsSection = document.querySelector('.statistics-section') || document.querySelector('.social-proof-section');
  const statNumbers = document.querySelectorAll('.stat-number');
  
  if (!statsSection) return;

  const countUp = (element) => {
    const target = parseInt(element.getAttribute('data-target'));
    const duration = 2000; // 2 seconds
    const startTime = performance.now();

    const updateCount = (currentTime) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      
      // Easing out quadratic function
      const easeProgress = progress * (2 - progress);
      const currentValue = Math.floor(easeProgress * target);

      if (target >= 1000) {
        element.textContent = currentValue.toLocaleString() + '+';
      } else {
        element.textContent = currentValue + (target === 50000 || target === 100 || target === 25 || target === 5 ? '+' : '');
      }

      if (progress < 1) {
        requestAnimationFrame(updateCount);
      } else {
        if (target >= 1000) {
          element.textContent = target.toLocaleString() + '+';
        } else {
          element.textContent = target + '+';
        }
      }
    };

    requestAnimationFrame(updateCount);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        statNumbers.forEach(num => countUp(num));
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  observer.observe(statsSection);
}

/* 5. Hero Parallax and Fade on Scroll */
function initHeroParallax() {
  const heroBg = document.querySelector('.hero-cinematic-bg');
  const heroContent = document.querySelector('.hero-content');
  if (!heroBg && !heroContent) return;
  
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (scrollY > window.innerHeight) return;
    
    if (heroBg) {
      heroBg.style.transform = `translate3d(0, ${scrollY * 0.35}px, 0) scale(1.05)`;
    }
    if (heroContent) {
      heroContent.style.opacity = `${Math.max(1 - scrollY / 600, 0)}`;
      heroContent.style.transform = `translate3d(0, ${scrollY * 0.15}px, 0)`;
    }
  });
}

/* 6. Food Gallery Filter Mechanism */
function initGalleryFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');
  if (filterBtns.length === 0 || galleryItems.length === 0) return;
  
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active button state
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const filterValue = btn.getAttribute('data-filter');
      
      galleryItems.forEach(item => {
        const category = item.getAttribute('data-category');
        
        // Eased scale and fade transition
        if (filterValue === 'all' || category === filterValue) {
          item.style.display = 'block';
          // Force a repaint for layout transition
          item.offsetHeight;
          item.style.opacity = '1';
          item.style.transform = 'scale(1)';
        } else {
          item.style.opacity = '0';
          item.style.transform = 'scale(0.92)';
          setTimeout(() => {
            if (item.style.opacity === '0') {
              item.style.display = 'none';
            }
          }, 400);
        }
      });
    });
  });
}

/* 7. Gallery Custom Lightbox Viewer */
function initLightbox() {
  const galleryItems = document.querySelectorAll('.gallery-item');
  if (galleryItems.length === 0) return;
  
  // Dynamically inject lightbox structure if it isn't in markup
  let lightbox = document.querySelector('.lightbox-overlay');
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.className = 'lightbox-overlay';
    lightbox.innerHTML = `
      <button class="lightbox-close" aria-label="Close Lightbox">&times;</button>
      <div class="lightbox-content">
        <img src="" alt="" class="lightbox-img">
        <div class="lightbox-caption"></div>
        <div class="lightbox-desc"></div>
      </div>
    `;
    document.body.appendChild(lightbox);
  }
  
  const img = lightbox.querySelector('.lightbox-img');
  const caption = lightbox.querySelector('.lightbox-caption');
  const desc = lightbox.querySelector('.lightbox-desc');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  
  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const imgEl = item.querySelector('.gallery-img');
      if (!imgEl) return;
      const imgSrc = imgEl.src;
      const title = item.getAttribute('data-title');
      const itemDesc = item.getAttribute('data-desc');
      
      img.src = imgSrc;
      img.alt = title || '';
      caption.textContent = title || '';
      desc.textContent = itemDesc || '';
      
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden'; // Lock scrolling
    });
  });
  
  const closeLightbox = () => {
    lightbox.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
  };
  
  closeBtn.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightbox();
    }
  });
}

/* 8. Patron Testimonials Auto-scroll & Touch-friendly Swipe Carousel */
function initTestimonialCarousel() {
  const cards = document.querySelectorAll('.testimonial-card');
  const prevBtn = document.querySelector('.prev-arrow');
  const nextBtn = document.querySelector('.next-arrow');
  const carousel = document.querySelector('.testimonials-carousel');
  if (cards.length === 0) return;
  
  let currentIndex = 0;
  let autoplayTimer;
  
  function showSlide(index) {
    cards.forEach(c => c.classList.remove('active'));
    
    // Wrap around bounds
    if (index >= cards.length) index = 0;
    if (index < 0) index = cards.length - 1;
    
    cards[index].classList.add('active');
    currentIndex = index;
  }
  
  const nextSlide = () => {
    showSlide(currentIndex + 1);
  };
  
  const prevSlide = () => {
    showSlide(currentIndex - 1);
  };
  
  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      clearInterval(autoplayTimer);
      prevSlide();
      startAutoplay();
    });
    nextBtn.addEventListener('click', () => {
      clearInterval(autoplayTimer);
      nextSlide();
      startAutoplay();
    });
  }

  // Touch Swipe Gesture Support
  if (carousel) {
    let touchStartX = 0;
    let touchEndX = 0;

    carousel.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    carousel.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      if (touchEndX < touchStartX - 50) {
        // Swipe Left: Next slide
        clearInterval(autoplayTimer);
        nextSlide();
        startAutoplay();
      } else if (touchEndX > touchStartX + 50) {
        // Swipe Right: Prev slide
        clearInterval(autoplayTimer);
        prevSlide();
        startAutoplay();
      }
    }, { passive: true });
  }
  
  function startAutoplay() {
    autoplayTimer = setInterval(nextSlide, 7000);
  }
  
  startAutoplay();
}
