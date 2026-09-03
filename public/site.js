document.documentElement.classList.add('js');

(() => {
  const body = document.body;
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#site-nav');

  if (body.classList.contains('home-page') && menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('open', !open);
    });
  }

  const path = location.pathname.replace(/\/+$/, '') || '/';
  document.querySelectorAll('#site-nav a').forEach((link) => {
    const linkPath = new URL(link.href, location.href).pathname.replace(/\/+$/, '') || '/';
    if (linkPath !== '/' && (path === linkPath || path.startsWith(linkPath + '/'))) {
      link.setAttribute('aria-current', 'page');
    }
  });

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  if (!body.classList.contains('home-page')) {
    const ambient = document.createElement('div');
    ambient.className = 'ambient-orbs';
    ambient.setAttribute('aria-hidden', 'true');
    ambient.innerHTML = '<i class="ambient-orb"></i><i class="ambient-orb"></i><i class="ambient-orb"></i>';
    body.append(ambient);
  }

  if (!reduceMotion && 'IntersectionObserver' in window) {
    const targets = document.querySelectorAll('main > section > *:not(.world-nav), .doorway, .world-node, .track-entry');
    targets.forEach((item) => item.classList.add('reveal-ready'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach((item) => observer.observe(item));
  }

  const stage = document.querySelector('.realm-stage');
  if (stage && finePointer && !reduceMotion) {
    const orbs = [...stage.querySelectorAll('.hero-orb')];
    let pointer = null;
    let frame = 0;

    const render = () => {
      frame = 0;
      if (!pointer) return;
      orbs.forEach((orb) => {
        const rect = orb.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - pointer.x;
        const dy = rect.top + rect.height / 2 - pointer.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const strength = Math.max(0, 145 - distance) / 145;
        orb.style.setProperty('--repel-x', (dx / distance * strength * 38).toFixed(2) + 'px');
        orb.style.setProperty('--repel-y', (dy / distance * strength * 38).toFixed(2) + 'px');
      });
    };

    stage.addEventListener('pointermove', (event) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(render);
    });
    stage.addEventListener('pointerleave', () => {
      pointer = null;
      orbs.forEach((orb) => {
        orb.style.setProperty('--repel-x', '0px');
        orb.style.setProperty('--repel-y', '0px');
      });
    });
  }

  const trackEntries = [...document.querySelectorAll('.track-entry')];
  if (trackEntries.length) {
    trackEntries.forEach((entry, index) => {
      const trigger = entry.querySelector(':scope > .track');
      const player = entry.querySelector('.track-player');
      if (!trigger || !player) return;

      trigger.setAttribute('role', 'button');
      trigger.setAttribute('aria-expanded', index === 0 ? 'true' : 'false');
      const outside = document.createElement('a');
      outside.className = 'soundcloud-out';
      outside.href = trigger.href;
      outside.target = '_blank';
      outside.rel = 'noopener noreferrer';
      outside.textContent = 'Open this track on SoundCloud ↗';
      entry.append(outside);

      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        const wasActive = entry.classList.contains('is-active');
        trackEntries.forEach((other) => {
          other.classList.remove('is-active');
          other.querySelector(':scope > .track')?.setAttribute('aria-expanded', 'false');
        });
        if (!wasActive) {
          entry.classList.add('is-active');
          trigger.setAttribute('aria-expanded', 'true');
          player.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
        }
      });
      trigger.addEventListener('keydown', (event) => {
        if (event.key === ' ') {
          event.preventDefault();
          trigger.click();
        }
      });
    });
    trackEntries[0]?.classList.add('is-active');
  }
})();

