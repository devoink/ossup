const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

function initHeroTypewriter() {
  const el = document.querySelector("[data-hero-typewriter]");
  if (!(el instanceof HTMLElement)) return;

  const text = el.getAttribute("data-hero-typewriter") ?? "";
  const terminal = el.closest("[data-terminal]");
  const speed = 52;
  const startDelay = 420;
  const holdAfterCompleteMs = 3200;

  let cycleId = 0;

  const showAfterLines = (id) => {
    if (!terminal) return 0;
    let maxDelay = 0;
    terminal.querySelectorAll(".terminal__line--after").forEach((line) => {
      const delay = Number(line.getAttribute("data-after-delay") || 0);
      maxDelay = Math.max(maxDelay, delay);
      window.setTimeout(() => {
        if (id === cycleId) line.classList.add("is-visible");
      }, delay);
    });
    return maxDelay;
  };

  const resetAfterLines = () => {
    terminal?.querySelectorAll(".terminal__line--after").forEach((line) => {
      line.classList.remove("is-visible");
    });
  };

  const runCycle = () => {
    const id = ++cycleId;
    el.textContent = "";
    el.classList.remove("is-done");
    resetAfterLines();

    let i = 0;
    const tick = () => {
      if (id !== cycleId) return;
      if (i < text.length) {
        el.textContent += text[i];
        i += 1;
        window.setTimeout(tick, speed);
      } else {
        el.classList.add("is-done");
        const lastAfterDelay = showAfterLines(id);
        window.setTimeout(() => {
          if (id === cycleId) runCycle();
        }, holdAfterCompleteMs + lastAfterDelay);
      }
    };

    tick();
  };

  if (prefersReducedMotion) {
    el.textContent = text;
    el.classList.add("is-done");
    showAfterLines(++cycleId);
    return;
  }

  window.setTimeout(runCycle, startDelay);
}

function initReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  if (prefersReducedMotion) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );

  items.forEach((el) => observer.observe(el));
}

function initHeader() {
  const header = document.getElementById("header");
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function initNavActive() {
  const links = document.querySelectorAll(".header__nav a[href^='#']");
  const sections = [...links]
    .map((a) => {
      const id = a.getAttribute("href")?.slice(1);
      const el = id ? document.getElementById(id) : null;
      return el ? { link: a, el } : null;
    })
    .filter(Boolean);

  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const match = sections.find((s) => s.el === entry.target);
        if (!match) return;
        links.forEach((l) => l.classList.remove("is-active"));
        match.link.classList.add("is-active");
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );

  sections.forEach((s) => observer.observe(s.el));
}

function initInstallTabs() {
  document.querySelectorAll("[data-install-tabs]").forEach((root) => {
    const tabs = root.querySelectorAll('[role="tab"]');
    const panels = root.querySelectorAll("[data-install-panel]");

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const id = tab.getAttribute("data-tab");
        if (!id) return;

        tabs.forEach((t) => {
          const selected = t === tab;
          t.setAttribute("aria-selected", selected ? "true" : "false");
          t.classList.toggle("is-active", selected);
        });

        panels.forEach((panel) => {
          const show = panel.getAttribute("data-install-panel") === id;
          panel.hidden = !show;
          panel.classList.toggle("is-active", show);
        });
      });
    });
  });
}

function initFlowAnimation() {
  const flow = document.querySelector("[data-flow]");
  if (!flow || prefersReducedMotion) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          flow.classList.add("is-animated");
          observer.disconnect();
        }
      });
    },
    { threshold: 0.4 }
  );
  observer.observe(flow);
}

function initCopy() {
  document.querySelectorAll(".copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const from = btn.getAttribute("data-copy-from");
      const text = from
        ? document.querySelector(from)?.textContent?.trim()
        : btn.getAttribute("data-copy");
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const prev = btn.textContent;
        btn.textContent = "已复制";
        btn.classList.add("copied");
        window.setTimeout(() => {
          btn.textContent = prev;
          btn.classList.remove("copied");
        }, 1600);
      } catch {
        btn.textContent = "失败";
      }
    });
  });
}

initCopy();
initReveal();
initHeroTypewriter();
initHeader();
initNavActive();
initInstallTabs();
initFlowAnimation();
