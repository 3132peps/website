/* ============================================
   31-32 Peptides — Main JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // --- Mobile Navigation ---
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  const mobileOverlay = document.getElementById('mobileOverlay');

  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      mobileOverlay.classList.toggle('active');
      document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
    });
  }

  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', () => {
      navLinks.classList.remove('open');
      mobileOverlay.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

  document.querySelectorAll('.navbar-links a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      mobileOverlay.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  // --- Navbar Scroll Effect ---
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
    });
  }

  // --- Scroll Animations (Intersection Observer) ---
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger animation for sibling elements
        const siblings = entry.target.parentElement.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right');
        const index = Array.from(siblings).indexOf(entry.target);
        const delay = index * 100;

        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);

        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right').forEach(el => {
    observer.observe(el);
  });

  // --- Hero Floating Molecules ---
  const heroMolecules = document.getElementById('heroMolecules');
  if (heroMolecules) {
    for (let i = 0; i < 40; i++) {
      const dot = document.createElement('div');
      dot.classList.add('dot');
      dot.style.left = Math.random() * 100 + '%';
      dot.style.top = Math.random() * 100 + '%';
      dot.style.animationDelay = Math.random() * 8 + 's';
      dot.style.animationDuration = (6 + Math.random() * 6) + 's';
      const size = (3 + Math.random() * 8) + 'px';
      dot.style.width = size;
      dot.style.height = size;
      // Some dots are brighter
      if (Math.random() > 0.7) {
        dot.style.background = 'rgba(0,180,216,0.6)';
        dot.style.boxShadow = '0 0 10px rgba(0,180,216,0.4)';
      }
      heroMolecules.appendChild(dot);
    }
  }

  // --- Hero Rotating Text ---
  const heroRotating = document.querySelector('.hero-rotating-line');
  if (heroRotating) {
    const words = heroRotating.querySelectorAll('.hero-rotating-word');
    let currentIndex = 0;

    setInterval(() => {
      const current = words[currentIndex];
      current.classList.remove('active');
      current.classList.add('exit');

      currentIndex = (currentIndex + 1) % words.length;

      const next = words[currentIndex];
      next.classList.remove('exit');
      next.classList.add('active');

      // Clean up exit class after animation
      setTimeout(() => {
        current.classList.remove('exit');
      }, 600);
    }, 3000);
  }

  // --- Animated Number Counters ---
  const counters = document.querySelectorAll('.counter');
  if (counters.length) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const counter = entry.target;
          const target = parseInt(counter.dataset.target);
          const suffix = counter.dataset.suffix || '';
          const duration = 2000;
          const startTime = performance.now();

          const updateCounter = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(eased * target);
            counter.textContent = current + suffix;

            if (progress < 1) {
              requestAnimationFrame(updateCounter);
            }
          };

          requestAnimationFrame(updateCounter);
          counterObserver.unobserve(counter);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(c => counterObserver.observe(c));
  }

  // --- Contact Form Handling ---
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const firstName = document.getElementById('firstName').value.trim();
      const lastName = document.getElementById('lastName').value.trim();
      const email = document.getElementById('email').value.trim();
      const organisation = document.getElementById('organisation').value.trim();
      const product = document.getElementById('product').value;
      const message = document.getElementById('message').value.trim();

      const subject = encodeURIComponent(`Research Enquiry from ${firstName} ${lastName}`);
      const body = encodeURIComponent(
        `Name: ${firstName} ${lastName}\n` +
        `Email: ${email}\n` +
        `Organisation: ${organisation || 'N/A'}\n` +
        `Product Interest: ${product || 'N/A'}\n\n` +
        `Message:\n${message}\n\n` +
        `---\n` +
        `This enquiry was submitted via the 31-32 Peptides website.\n` +
        `The sender confirms all products are for research purposes only.`
      );

      window.location.href = `mailto:info@3132peptides.com?subject=${subject}&body=${body}`;

      const btn = contactForm.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.textContent = 'Opening Email Client...';
      btn.style.background = 'var(--accent)';

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 3000);
    });
  }

  // --- Smooth Scroll for Anchor Links ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // --- Parallax effect on hero image ---
  const heroImage = document.querySelector('.hero-image img');
  if (heroImage) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      if (scrolled < 800) {
        heroImage.style.transform = `translateY(${scrolled * 0.08}px)`;
      }
    });
  }

});
