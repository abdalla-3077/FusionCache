// ============================================
// fusion-cache Documentation — Scripts
// ============================================

(() => {
  // --- Sidebar Toggle (Mobile) ---
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('menuToggle');

  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking a link (mobile)
    for (const link of sidebar.querySelectorAll('.nav-link')) {
      link.addEventListener('click', () => {
        sidebar.classList.remove('open');
      });
    }

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
      if (
        sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        !toggle.contains(e.target)
      ) {
        sidebar.classList.remove('open');
      }
    });
  }

  // --- Active Link Tracking ---
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  function updateActiveLink() {
    let current = '';
    const scrollY = window.scrollY + 100;

    for (const section of sections) {
      if (section.offsetTop <= scrollY) {
        current = section.getAttribute('id');
      }
    }

    for (const link of navLinks) {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    }
  }

  window.addEventListener('scroll', updateActiveLink, { passive: true });
  updateActiveLink();

  // --- Copy Buttons ---
  for (const btn of document.querySelectorAll('.copy-btn')) {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-copy');
      if (!text) return;

      navigator.clipboard
        .writeText(text)
        .then(() => {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 2000);
        })
        .catch(() => {
          // Fallback for older browsers
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 2000);
        });
    });
  }

  // --- Smooth scroll offset for fixed sidebar ---
  for (const anchor of document.querySelectorAll('a[href^="#"]')) {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const top = target.offsetTop - 24;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  }
})();
