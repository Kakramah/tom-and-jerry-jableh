/* توم وجيري في جبلة: المطاردة مع التمرير، والعدّاد، والصور المكبّرة، والمشاركة */
(() => {
  document.documentElement.classList.add('js');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wide = window.matchMedia('(min-width: 768px)');
  const scenes = [...document.querySelectorAll('.scene')];

  /* وصول القارئ إلى المكان: يرتفع التراكب ويظهر النص */
  const hereObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('is-here'); });
  }, { threshold: 0.28 });
  scenes.forEach((s) => hereObserver.observe(s));

  /* ===== المطاردة ===== */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const lanes = scenes.map((scene) => {
    const lane = scene.querySelector('.lane');
    if (!lane) return null;
    return {
      scene, lane,
      mode: scene.dataset.chase,
      mouse: lane.querySelector('.runner-mouse'),
      cat: lane.querySelector('.runner-cat'),
      slipped: false,
    };
  }).filter(Boolean);

  /* كل مكان له حركته: p من 0 إلى 1 مع عبور القارئ للمكان */
  function choreograph(l, p) {
    const W = l.lane.clientWidth;
    const mw = l.mouse.offsetWidth;
    const cw = l.cat.offsetWidth;
    const start = W + 30;
    const end = -cw - 60;
    let mx; let cx;
    l.cat.classList.remove('is-tangled');

    switch (l.mode) {
      case 'hero': {
        /* الفأر في الصورة منذ البداية، والقط يدخل من خلفه */
        mx = lerp(W * 0.58, end, easeInOut(clamp(p * 1.1)));
        cx = lerp(start + cw, end + cw * 2.2, easeInOut(clamp(p * 1.15)));
        cx = Math.max(cx, mx + mw * 1.6);
        break;
      }
      case 'tangle': {
        /* القط يعلق في حبل الغسيل ثم ينفلت */
        const t = easeInOut(clamp((p - 0.05) / 0.9));
        mx = lerp(start, end, t);
        const stuckAt = lerp(start, end, 0.42) + cw * 1.4;
        if (p < 0.38) cx = lerp(start + cw * 1.4, stuckAt, clamp(p / 0.38));
        else if (p < 0.6) { cx = stuckAt; l.cat.classList.add('is-tangled'); }
        else cx = lerp(stuckAt, end, easeOut(clamp((p - 0.6) / 0.4)));
        break;
      }
      case 'close': {
        /* في المدرج يقترب القط ولا يلحق */
        const t = easeInOut(clamp((p - 0.05) / 0.9));
        mx = lerp(start, end, t);
        cx = mx + lerp(cw * 2.6, mw * 1.1, clamp(p * 1.2));
        break;
      }
      case 'slip': {
        /* على الرصيف المبلل ينزلق القط ويتأخر */
        const t = easeInOut(clamp((p - 0.05) / 0.9));
        mx = lerp(start, end, t);
        const lag = p < 0.5 ? cw * 0.9 : lerp(cw * 0.9, cw * 3.2, easeOut(clamp((p - 0.5) / 0.3)));
        cx = mx + lag;
        if (p >= 0.5 && !l.slipped) {
          l.slipped = true;
          l.cat.classList.add('is-slipping');
          l.cat.addEventListener('animationend', () => l.cat.classList.remove('is-slipping'), { once: true });
        }
        if (p < 0.35) l.slipped = false;
        break;
      }
      case 'rest': {
        /* آخر النهار: يتباطآن حتى يجلسا معاً فيذوبان في الصورة */
        const t = easeOut(clamp(p / 0.55));
        const restX = W * 0.4;
        mx = lerp(start, restX, t);
        cx = lerp(start + cw * 2.4, restX + mw * 1.05, t);
        const resting = p > 0.56;
        l.mouse.classList.toggle('is-resting', resting);
        l.cat.classList.toggle('is-resting', resting);
        break;
      }
      default: {
        mx = lerp(start, end, p);
        cx = mx + cw;
      }
    }
    l.mouse.style.setProperty('--x', `${Math.round(mx)}px`);
    l.cat.style.setProperty('--x', `${Math.round(cx)}px`);
  }

  function progressOf(scene) {
    const r = scene.getBoundingClientRect();
    const vh = window.innerHeight;
    if (scene.classList.contains('hero')) return clamp(-r.top / (r.height * 0.85));
    return clamp((vh - r.top) / (vh + r.height));
  }

  /* الشاشة العريضة: الحركة تتبع التمرير، والركض حين يتحرك القارئ */
  let ticking = false;
  let idleTimer = 0;
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        lanes.forEach((l) => {
          const r = l.scene.getBoundingClientRect();
          if (r.bottom < -100 || r.top > window.innerHeight + 100) return;
          choreograph(l, progressOf(l.scene));
          l.lane.classList.add('is-running');
        });
        ticking = false;
      });
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => lanes.forEach((l) => l.lane.classList.remove('is-running')), 180);
  }

  /* الهاتف: عبور واحد بالزمن حين يظهر المكان، بلا ربط بالتمرير */
  const played = new WeakSet();
  function playOnce(l) {
    if (played.has(l)) return;
    played.add(l);
    const duration = l.mode === 'rest' ? 2600 : 3200;
    const t0 = performance.now();
    l.lane.classList.add('is-running');
    const step = (now) => {
      const p = clamp((now - t0) / duration);
      choreograph(l, l.mode === 'hero' ? p : p * 0.98);
      if (p < 1) requestAnimationFrame(step);
      else l.lane.classList.remove('is-running');
    };
    requestAnimationFrame(step);
  }
  const laneObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const l = lanes.find((x) => x.lane === e.target);
      if (l) playOnce(l);
    });
  }, { threshold: 0.9 });

  function setupChase() {
    window.removeEventListener('scroll', onScroll);
    laneObserver.disconnect();
    if (reduce.matches) return;
    if (wide.matches) {
      window.addEventListener('scroll', onScroll, { passive: true });
      lanes.forEach((l) => choreograph(l, progressOf(l.scene)));
    } else {
      lanes.forEach((l) => { choreograph(l, 0); laneObserver.observe(l.lane); });
    }
  }
  setupChase();
  wide.addEventListener('change', setupChase);
  reduce.addEventListener('change', setupChase);
  window.addEventListener('resize', () => { if (wide.matches && !reduce.matches) onScroll(); });

  /* ===== عدّاد مقاعد المدرج ===== */
  const numberFormat = new Intl.NumberFormat('ar-SY');
  const counter = document.querySelector('.count[data-target]');
  if (counter) {
    const target = Number(counter.dataset.target);
    counter.textContent = numberFormat.format(reduce.matches ? target : 0);
    const countObserver = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      countObserver.disconnect();
      if (reduce.matches) { counter.textContent = numberFormat.format(target); return; }
      const t0 = performance.now();
      const tick = (now) => {
        const p = clamp((now - t0) / 1700);
        counter.textContent = numberFormat.format(Math.round(target * easeOut(p)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.8 });
    countObserver.observe(counter);
  }

  /* ===== الصور المكبّرة ===== */
  const views = [...document.querySelectorAll('[data-view]')];
  const imageDialog = document.getElementById('image-dialog');
  const bigImage = document.getElementById('enlarged-image');
  const bigTitle = document.getElementById('image-title');
  const bigDesc = document.getElementById('image-description');
  let current = 0;
  let opener = null;

  function show(i) {
    current = (i + views.length) % views.length;
    const link = views[current];
    const img = link.querySelector('img');
    bigImage.src = link.getAttribute('href');
    bigImage.alt = img ? img.alt : '';
    bigTitle.textContent = link.dataset.title;
    bigDesc.textContent = link.dataset.desc;
  }
  views.forEach((link, i) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      opener = link;
      show(i);
      imageDialog.showModal();
    });
  });
  document.getElementById('previous-image').addEventListener('click', () => show(current - 1));
  document.getElementById('next-image').addEventListener('click', () => show(current + 1));
  imageDialog.addEventListener('keydown', (e) => {
    /* في العربية: اليمين للسابق واليسار للتالي */
    if (e.key === 'ArrowRight') { e.preventDefault(); show(current - 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(current + 1); }
  });
  imageDialog.addEventListener('click', (e) => { if (e.target === imageDialog) imageDialog.close(); });
  imageDialog.addEventListener('close', () => { if (opener) opener.focus(); });

  document.querySelectorAll('dialog .dialog-close').forEach((b) => {
    b.addEventListener('click', () => b.closest('dialog').close());
  });

  /* ===== المشاركة ===== */
  const shareButton = document.getElementById('share-button');
  const shareDialog = document.getElementById('share-dialog');
  const shareUrl = document.getElementById('share-url');
  const shareStatus = shareDialog.querySelector('.share-status');
  const pageUrl = document.querySelector('meta[property="og:url"]').content || location.href;
  const pageTitle = document.title;
  const shareText = `${pageTitle}: مطاردة من الحارة القديمة إلى البحر.`;
  const links = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${pageUrl}`)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(shareText)}`,
    x: `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`,
  };
  shareDialog.querySelectorAll('[data-share]').forEach((a) => { a.href = links[a.dataset.share]; });
  shareUrl.value = pageUrl;

  shareButton.addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share({ title: pageTitle, text: shareText, url: pageUrl }); return; }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    shareStatus.textContent = '';
    shareDialog.showModal();
  });
  shareDialog.addEventListener('close', () => shareButton.focus());

  document.getElementById('copy-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      shareStatus.textContent = 'نُسخ الرابط. الصقه حيث تريد.';
    } catch {
      shareUrl.select();
      shareStatus.textContent = 'حدّدتُ الرابط، انسخه من لوحة المفاتيح.';
    }
  });
})();
