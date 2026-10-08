/* توم وجيري في جبلة: مشاهد مثبّتة يدخلها القط والفأر راكضَين حتى وضعيتهما في الصورة */
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wide = window.matchMedia('(min-width: 768px)');

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  /* ===== رسمات الركض: صفّ أفقي من الإطارات، كل إطار بالحجم نفسه وقدمه على خط واحد ===== */
  const SHEETS = {
    cat: { src: 'images/run-cat-strip.png', frames: 8, aspect: 2.1 },
    mouse: { src: 'images/run-mouse-strip.png', frames: 6, aspect: 0.98 },
  };

  /* ===== مسار كل ممثل في كل مكان =====
     u وv موضع القدم في الصورة (نسبة من عرضها وارتفاعها)، وh ارتفاع الممثل نسبةً إلى ارتفاع الصورة.
     t من 0 إلى 1 مع عبور القارئ للمشهد المثبّت. right: يركض نحو اليمين فتنقلب الرسمة.
     land: نافذة الوصول، يذوب فيها الممثل وتظهر الصورة الكاملة بوضعيته الحقيقية. */
  const SCENES = {
    'old-town': {
      tint: [0.42, 0.14], zoom: [1.1, 1], land: [0.6, 0.74],
      mouse: { right: true, h: 0.17, path: [[0.08, -0.12, 0.84], [0.52, 0.62, 0.815]] },
      cat: { right: true, h: 0.24, hop: 0, path: [[0.14, -0.4, 0.86], [0.5, 0.3, 0.82], [0.6, 0.44, 0.72]] },
    },
    theatre: {
      tint: [0.38, 0.1], zoom: [1.12, 1], land: [0.62, 0.76],
      mouse: { right: false, h: 0.09, path: [[0.06, 1.12, 0.67], [0.56, 0.41, 0.67]] },
      cat: { right: false, h: 0.15, hop: 0.07, hops: 4, path: [[0.1, 1.45, 0.47], [0.6, 0.72, 0.42]] },
    },
    harbour: {
      tint: [0.34, 0.06], zoom: [1.1, 1], land: [0.62, 0.76],
      mouse: { right: true, h: 0.15, path: [[0.06, -0.12, 0.66], [0.38, 0.47, 0.6], [0.56, 0.62, 0.42]] },
      cat: { right: true, h: 0.24, hop: 0, path: [[0.12, -0.45, 0.74], [0.6, 0.29, 0.73]] },
    },
    corniche: {
      tint: [0.3, 0.03], zoom: [1.08, 1], land: [0.62, 0.78],
      mouse: { right: true, h: 0.12, path: [[0.08, -0.12, 0.72], [0.35, 0.3, 0.8], [0.58, 0.76, 0.885]] },
      cat: { right: true, h: 0.2, hop: 0, path: [[0.12, -0.4, 0.7], [0.4, 0.2, 0.78], [0.6, 0.66, 0.9]] },
    },
  };

  const stages = [...document.querySelectorAll('.stage')].map((el) => {
    const frame = el.querySelector('.frame');
    if (frame && frame.dataset.pos) frame.style.setProperty('--pos', frame.dataset.pos);
    return {
      el,
      name: el.dataset.scene,
      frame,
      pin: el.querySelector('.pin'),
      plate: el.querySelector('.plate'),
      full: el.querySelector('.full'),
      cat: el.querySelector('.actor-cat'),
      mouse: el.querySelector('.actor-mouse'),
      veil: el.querySelector('.veil'),
      copy: el.querySelector('.copy'),
      conf: SCENES[el.dataset.scene],
      shown: null,
      state: { cat: { phase: 0, x: null, y: null }, mouse: { phase: 0, x: null, y: null } },
    };
  });

  /* ===== صفحات الركض: الرسمات تنظر يميناً، وتُقلب حين يركض الممثل يساراً ===== */
  function loadSheet(key) {
    const s = SHEETS[key];
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { s.aspect = (img.naturalWidth / s.frames) / img.naturalHeight; resolve(); };
      img.onerror = resolve;
      img.src = s.src;
    });
  }

  /* ===== من نسبة في الصورة إلى بكسل داخل الإطار، بمنطق object-fit: cover ===== */
  function mapper(stage) {
    const fw = stage.frame.clientWidth;
    const fh = stage.frame.clientHeight;
    const img = stage.full || stage.plate;
    const iw = img.naturalWidth || Number(img.getAttribute('width'));
    const ih = img.naturalHeight || Number(img.getAttribute('height'));
    const scale = Math.max(fw / iw, fh / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const pos = getComputedStyle(stage.frame).getPropertyValue('--pos').trim().split(/\s+/).map(parseFloat);
    const ox = (fw - dw) * ((Number.isFinite(pos[0]) ? pos[0] : 50) / 100);
    const oy = (fh - dh) * ((Number.isFinite(pos[1]) ? pos[1] : 50) / 100);
    return { x: (u) => ox + u * dw, y: (v) => oy + v * dh, h: (f) => f * dh };
  }

  function pointAt(path, t) {
    if (t <= path[0][0]) return { u: path[0][1], v: path[0][2], k: 0 };
    const last = path[path.length - 1];
    if (t >= last[0]) return { u: last[1], v: last[2], k: 1 };
    for (let i = 0; i < path.length - 1; i += 1) {
      const a = path[i]; const b = path[i + 1];
      if (t >= a[0] && t <= b[0]) {
        const local = easeInOut((t - a[0]) / (b[0] - a[0]));
        return { u: lerp(a[1], b[1], local), v: lerp(a[2], b[2], local), k: (t - path[0][0]) / (last[0] - path[0][0]) };
      }
    }
    return { u: last[1], v: last[2], k: 1 };
  }

  /* إيقاع الرسمات: 12 رسمة في الثانية ما دام الممثل يتحرك، فلا يتسارع ولا يتجمّد مع عجلة الفأرة */
  const FPS = 12;
  function placeActor(stage, key, p, map, dt) {
    const el = stage[key];
    const a = stage.conf && stage.conf[key];
    if (!el || !a) return;
    const sheet = SHEETS[key];
    const hpx = map.h(a.h);
    const wpx = hpx * sheet.aspect;
    const pt = pointAt(a.path, p);
    let x = map.x(pt.u);
    let y = map.y(pt.v);
    if (a.hop) y -= map.h(a.hop) * Math.abs(Math.sin(Math.PI * (a.hops || 3) * pt.k));

    const start = a.path[0];
    const st = stage.state[key];
    const moved = st.x === null ? 0 : Math.hypot(x - st.x, y - st.y);
    st.x = x; st.y = y;
    if (moved > 0.4) st.phase += dt;
    const frame = sheet.frames > 1 ? Math.floor(st.phase / (1000 / FPS)) % sheet.frames : 0;

    const [l0, l1] = stage.conf.land;
    const visible = p > start[0] - 0.01 ? 1 - smooth(l0, l1, p) : 0;
    /* ارتفاع خفيف وهبوط مع كل خطوة */
    const bob = moved > 0.4 ? Math.abs(Math.sin((st.phase / 1000) * FPS * (Math.PI / 2))) * hpx * 0.035 : 0;

    el.style.width = `${wpx}px`;
    el.style.height = `${hpx}px`;
    el.style.setProperty('--ah', `${hpx}px`);
    el.style.backgroundImage = `url('${sheet.src}')`;
    el.style.backgroundSize = `${sheet.frames * 100}% 100%`;
    el.style.backgroundPosition = sheet.frames > 1 ? `${(frame / (sheet.frames - 1)) * 100}% 0` : '0 0';
    el.style.opacity = visible.toFixed(3);
    el.style.filter = visible < 1 && visible > 0 ? `blur(${((1 - visible) * 3).toFixed(2)}px)` : '';
    el.style.transform = `translate3d(${(x - wpx / 2).toFixed(1)}px, ${(y - hpx - bob).toFixed(1)}px, 0) scaleX(${a.right ? 1 : -1})`;
  }

  /* ===== الفيديو: لقطة Veo بين المشهد الفارغ والكامل، تتقدّم مع التمرير وترجع معه ===== */
  const V_START = 0.04;
  const V_END = 0.8;
  function videoAt(stage, p) {
    const v = stage.video;
    const t = clamp((p - V_START) / (V_END - V_START)) * Math.max(0, v.duration - 0.05);
    if (Math.abs(v.currentTime - t) > 1 / 60) v.currentTime = t;
    /* الفيديو يقف على آخر إطار، فلا تبديل يقفز فيه الممثلان */
    if (stage.full) stage.full.style.opacity = '0';
  }
  function attachVideo(stage) {
    if (stage.video || stage.videoTried || !stage.frame) return;
    stage.videoTried = true;
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.className = 'scene-video';
    v.poster = stage.plate ? stage.plate.currentSrc || stage.plate.src : '';
    v.addEventListener('loadeddata', () => {
      stage.video = v;
      stage.el.classList.add('has-video');
      [stage.cat, stage.mouse].forEach((a) => a && (a.style.opacity = '0'));
      if (stage.name === 'hero') playHero();
      else if (wide.matches) onScroll();
      else if (stage.inView) playVideoOnce(stage);
    }, { once: true });
    v.addEventListener('error', () => v.remove(), { once: true });
    v.src = `videos/${stage.name}.mp4`;
    stage.plate.after(v);
  }
  const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const s = stages.find((x) => x.el === e.target);
      if (s && e.isIntersecting && !reduce.matches) attachVideo(s);
    });
  }, { rootMargin: '300% 0px' });
  stages.forEach((s) => videoObserver.observe(s.el));

  function playVideoOnce(stage) {
    const v = stage.video;
    if (!v || stage.videoPlayed) return;
    stage.videoPlayed = true;
    v.currentTime = 0;
    if (stage.full) stage.full.style.opacity = '0';
    v.play().catch(() => { if (stage.full) stage.full.style.opacity = '1'; });
  }
  function playHero() {
    const s = hero;
    if (!s || !s.video) return;
    s.full.style.opacity = '0';
    const go = () => { s.video.play().catch(() => { s.full.style.opacity = '1'; }); };
    if (root.classList.contains('is-ready')) go(); else setTimeout(go, 600);
  }

  function render(stage, p, { zoom = true, dt = 16 } = {}) {
    const c = stage.conf;
    if (!c) return;
    const map = mapper(stage);
    const [l0, l1] = c.land;
    if (stage.video) {
      if (wide.matches) videoAt(stage, p);
    } else {
      placeActor(stage, 'mouse', p, map, dt);
      placeActor(stage, 'cat', p, map, dt);
      if (stage.full) stage.full.style.opacity = smooth(l0 - 0.02, l1, p).toFixed(3);
    }
    if (zoom) stage.frame.style.transform = `scale(${lerp(c.zoom[0], c.zoom[1], easeOut(p)).toFixed(4)})`;
    if (stage.veil) stage.veil.style.setProperty('--tint-a', lerp(c.tint[0], c.tint[1], smooth(0.02, 0.7, p)).toFixed(3));
    if (stage.copy && wide.matches) {
      stage.copy.style.opacity = smooth(0.04, 0.2, p).toFixed(3);
      stage.copy.style.transform = `translate3d(0, ${((1 - easeOut(clamp((p - 0.04) / 0.2))) * 26).toFixed(1)}px, 0)`;
    }
    if (stage.name === 'theatre' && p > 0.5) startCounter();
  }

  /* ===== الافتتاحية ===== */
  const hero = stages.find((s) => s.name === 'hero');
  function renderHero(p) {
    if (!hero) return;
    hero.frame.style.transform = `scale(${lerp(1, 1.14, easeInOut(p)).toFixed(4)})`;
    if (hero.veil) hero.veil.style.setProperty('--tint-a', lerp(0.22, 0.42, p).toFixed(3));
    if (hero.copy) {
      hero.copy.style.opacity = (1 - smooth(0.45, 0.85, p)).toFixed(3);
      hero.copy.style.transform = `translate3d(0, ${(-p * 40).toFixed(1)}px, 0)`;
    }
  }

  /* ===== التقدّم داخل المشهد المثبّت ===== */
  function progress(stage) {
    const r = stage.el.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    return span > 0 ? clamp(-r.top / span) : 0;
  }

  /* التمرير يحدّد الهدف، والمشهد يلحق به بنعومة: عجلة الفأرة لا تُقفز الشخصيتين */
  let running = false;
  let last = 0;
  function frameLoop(now) {
    const dt = Math.min(64, last ? now - last : 16);
    last = now;
    let busy = false;
    const k = 1 - Math.exp(-dt / 140);
    stages.forEach((s) => {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -50 || r.top > window.innerHeight + 50) return;
      const target = progress(s);
      if (s.name === 'hero') { renderHero(target); return; }
      if (s.shown === null) s.shown = target;
      s.shown += (target - s.shown) * k;
      if (Math.abs(target - s.shown) < 0.0004) s.shown = target; else busy = true;
      render(s, s.shown, { dt });
    });
    if (busy) requestAnimationFrame(frameLoop);
    else { running = false; last = 0; }
  }
  const onScroll = () => { if (!running) { running = true; requestAnimationFrame(frameLoop); } };

  /* ===== الهاتف: كل مكان يُعرض مرة بالزمن حين يظهر ===== */
  const played = new WeakSet();
  function play(stage) {
    stage.inView = true;
    if (stage.video) { playVideoOnce(stage); return; }
    if (played.has(stage) || !stage.conf) return;
    played.add(stage);
    const duration = 3600;
    const t0 = performance.now();
    let prev = t0;
    const step = (now) => {
      const p = clamp((now - t0) / duration);
      render(stage, p, { zoom: false, dt: now - prev });
      prev = now;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const mobileObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const s = stages.find((x) => x.frame === e.target);
      if (s) play(s);
    });
  }, { threshold: 0.6 });

  function setup() {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    mobileObserver.disconnect();
    if (reduce.matches) return;
    if (wide.matches) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      onScroll();
    } else {
      stages.forEach((s) => {
        if (s.name === 'hero') return;
        if (!played.has(s)) render(s, 0, { zoom: false });
        mobileObserver.observe(s.frame);
      });
    }
  }

  Promise.all([loadSheet('cat'), loadSheet('mouse')]).then(() => {
    setup();
    wide.addEventListener('change', setup);
    reduce.addEventListener('change', setup);
  });
  stages.forEach((s) => [s.plate, s.full].forEach((img) => img && img.addEventListener('load', onScroll, { once: true })));

  /* الافتتاحية تنكشف بعد تحميل الخط والصورة */
  const ready = () => requestAnimationFrame(() => root.classList.add('is-ready'));
  Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    hero && hero.full && !hero.full.complete ? new Promise((r) => { hero.full.onload = r; hero.full.onerror = r; }) : Promise.resolve(),
  ]).then(ready);
  setTimeout(ready, 2500);

  /* ===== عدّاد مقاعد المدرج ===== */
  const numberFormat = new Intl.NumberFormat('ar-SY');
  const counter = document.querySelector('.count[data-target]');
  let counted = false;
  function startCounter() {
    if (counted || !counter) return;
    counted = true;
    const target = Number(counter.dataset.target);
    if (reduce.matches) { counter.textContent = numberFormat.format(target); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const p = clamp((now - t0) / 1700);
      counter.textContent = numberFormat.format(Math.round(target * easeOut(p)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  if (counter) {
    const countObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && (!wide.matches || reduce.matches)) { countObserver.disconnect(); startCounter(); }
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
