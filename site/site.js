/*
 * The documentation site's behaviour: it draws the Foundations section from site/tokens-data.js (generated from
 * tokens.json), runs the before/after switch and the motion demos, and copies variable names and code.
 */
(() => {
  const data = window.QUEST_UI_TOKENS;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const short = (name) => name.replace(/^--qu-/, "");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const varButton = (name) => `<button class="var" type="button" data-copy="var(${esc(name)})">${esc(name)}</button>`;

  /* ---------- copying ---------- */

  const toast = $(".toast");
  let toastTimer;
  function say(message) {
    toast.textContent = message;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-on"), 1800);
  }
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      area.remove();
      return ok;
    }
  }
  document.addEventListener("click", async (event) => {
    const value = event.target.closest("[data-copy]");
    if (value) {
      const text = value.dataset.copy;
      say((await copy(text)) ? `Copied ${text}` : `Couldn't copy. Select ${text} and copy it yourself.`);
      return;
    }
    const codeButton = event.target.closest("[data-copy-code]");
    if (codeButton) {
      const ok = await copy(codeButton.parentElement.querySelector("code").textContent);
      codeButton.textContent = ok ? "Copied" : "Select to copy";
      say(ok ? "Copied the code" : "Couldn't copy. Select the code and copy it yourself.");
      setTimeout(() => { codeButton.textContent = "Copy"; }, 1600);
      return;
    }
    const toggle = event.target.closest("[data-toggle-group]");
    if (toggle) {
      $$(`[data-toggle-group="${toggle.dataset.toggleGroup}"]`).forEach((b) => b.setAttribute("aria-pressed", String(b === toggle)));
    }
  });

  /* ---------- the before/after switch ---------- */

  const bench = $(".bench");
  $$(".switch input").forEach((input) => input.addEventListener("change", () => { bench.dataset.state = input.value; }));

  /* ---------- progress bar and the current section in the nav ---------- */

  const fill = $(".xp__fill");
  const progress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    fill.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
  };
  window.addEventListener("scroll", progress, { passive: true });
  window.addEventListener("resize", progress);
  progress();

  const links = $$(".nav__links a");
  if ("IntersectionObserver" in window) {
    const watch = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          links.forEach((a) => (a.getAttribute("href") === `#${entry.target.id}` ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    links.forEach((a) => { const s = $(a.getAttribute("href")); if (s) watch.observe(s); });
  }

  if (!data) return;
  const tokens = data.tokens;
  const under = (prefix) => tokens.filter((t) => t.path.startsWith(prefix));
  const render = (key, html) => { const el = $(`[data-render="${key}"]`); if (el) el.innerHTML = html; };

  const textStyles = under("type.");
  const summary = $('[data-fill="summary"]');
  if (summary) summary.textContent = `${tokens.length} tokens, ${textStyles.length} text styles and ${data.contrast.length} contrast checks, all built from one JSON file.`;

  /* ---------- colour ---------- */

  render(
    "colours",
    under("color.")
      .map(
        (t) => `<button class="swatch" type="button" data-copy="var(${t.name})">
          <span class="swatch__chip" style="background: var(${t.name})"></span>
          <span class="swatch__name">${esc(short(t.name))}</span>
          <span class="swatch__hex">${esc(t.value)}</span>
          ${t.description ? `<span class="swatch__desc">${esc(t.description)}</span>` : ""}
        </button>`,
      )
      .join(""),
  );

  const ROLE_GROUPS = [
    ["Text", ["text"]],
    ["Surfaces", ["surface"]],
    ["Borders, actions and focus", ["border", "action", "focus"]],
    ["Rarity badges", ["rarity"]],
  ];
  const roles = under("role.");
  render(
    "roles",
    ROLE_GROUPS.map(([title, groups]) => {
      const items = roles.filter((t) => groups.includes(t.path.split(".")[1]));
      return `<div class="roles__group">
        <h4 class="qu-type-h4">${esc(title)}</h4>
        <ul class="roles__list">
          ${items
            .map((t) => {
              const seeThrough = t.ref === null && /^#[0-9a-f]{8}$/i.test(t.value);
              const chip = seeThrough ? `background: linear-gradient(var(${t.name}), var(${t.name})), var(--qu-sky-200)` : `background: var(${t.name})`;
              const ref = t.ref ? `uses ${esc(short(t.ref))}` : esc(t.description || t.value);
              return `<li class="role"><span class="role__chip" style="${chip}"></span>${varButton(t.name)}<span class="role__ref">${ref}</span></li>`;
            })
            .join("")}
        </ul>
      </div>`;
    }).join(""),
  );

  /* ---------- contrast ---------- */

  const NOTES = { "large text only": "Large text only", "non-text": "Focus ring" };
  render(
    "contrast",
    data.contrast
      .map((c) => {
        const ring = c.note === "non-text";
        const style = `--fg: var(${c.textVar}); --bg: var(${c.onVar});${c.overVar ? ` --over: var(${c.overVar});` : ""}`;
        return `<div class="check">
          <div class="check__sample${c.overVar ? " check__sample--over" : ""}" style="${style}">
            ${ring ? '<span class="check__ring" aria-hidden="true"></span>' : '<span class="check__aa" aria-hidden="true">Aa</span>'}
            <span class="check__ratio">${c.ratio.toFixed(2)}</span>
          </div>
          <p class="check__pair">${esc(short(c.textVar))} on ${esc(short(c.onVar))}${c.overVar ? ` over ${esc(short(c.overVar))}` : ""}</p>
          <p class="check__result"><span class="flag${c.pass ? "" : " flag--fail"}">${c.pass ? "Passes" : "Below minimum"}</span>${c.ratio.toFixed(2)}:1, needs ${c.min}:1${c.note ? `. ${esc(NOTES[c.note] || c.note)}` : ""}</p>
        </div>`;
      })
      .join(""),
  );

  const RARITIES = ["common", "rare", "epic", "legendary"];
  render(
    "badges",
    RARITIES.map((r) => {
      const check = data.contrast.find((c) => c.text === `role.rarity.${r}.text`);
      const cls = r === "common" ? "qu-badge" : `qu-badge qu-badge--${r}`;
      return `<span class="badge-demo"><span class="${cls}">${r}</span>${check ? `<span class="badge-demo__ratio">${check.ratio.toFixed(2)}:1</span>` : ""}</span>`;
    }).join(""),
  );

  /* ---------- type ---------- */

  const SAMPLES = {
    h1: "Side quests",
    h2: "Case studies",
    h3: "Bridgly",
    h4: "What I would test next",
    "body-lg": "Walk around a storybook town and open each case study at its quest totem.",
    body: "Bridgly began as a shared goal tracker. Research showed couples wanted to feel present in each other's day.",
    small: "Solo project, 10 weeks",
    caption: "Toronto Transit Live",
    eyebrow: "Case study",
    label: "Legendary",
    button: "View case study",
  };
  render(
    "type",
    textStyles
      .map((t) => {
        const v = t.value;
        const key = t.path.split(".")[1];
        const tracking = parseFloat(v.letterSpacing) ? `, letter spacing ${v.letterSpacing}` : "";
        const spec = `${v.fontFamily[0]} ${v.fontWeight}, ${v.fontSize}${t.desktop ? ` (${t.desktop.fontSize} from 768px wide)` : ""}, line height ${v.lineHeight}${tracking}${t.textTransform ? ", upper case" : ""}`;
        return `<div class="ramp__row">
          <div class="ramp__meta"><button class="var" type="button" data-copy="${esc(t.name)}">${esc(t.name)}</button><span class="ramp__spec">${esc(spec)}</span></div>
          <p class="ramp__sample ${esc(t.name.slice(1))}">${esc(SAMPLES[key] || key)}</p>
        </div>`;
      })
      .join(""),
  );

  /* ---------- corners, spacing, shadows ---------- */

  render(
    "radius",
    under("radius.")
      .map((t) => `<div class="radius"><span class="radius__box" style="border-radius: var(${t.name})"></span>${varButton(t.name)}<span class="radius__value">${esc(t.value)}${t.description ? `, ${esc(t.description.replace(/\.$/, "").toLowerCase())}` : ""}</span></div>`)
      .join(""),
  );
  render(
    "space",
    under("space.")
      .map((t) => `<div class="space">${varButton(t.name)}<span class="space__value">${esc(t.value)}</span><span class="space__bar" style="width: var(${t.name})"></span></div>`)
      .join(""),
  );
  render(
    "shadow",
    under("shadow.")
      .map((t) => `<div class="shadow"><span class="shadow__tile" style="box-shadow: var(${t.name})"></span>${varButton(t.name)}${t.description ? `<span class="shadow__desc">${esc(t.description)}</span>` : ""}</div>`)
      .join(""),
  );

  /* ---------- motion ---------- */

  const ms = (t) => t.value;
  const durations = under("motion.duration.");
  const eases = under("motion.ease.");
  const springNames = [...new Set(under("motion.spring.").map((t) => t.path.split(".")[2]))];
  const springOf = (n) => ({
    name: n,
    stiffness: tokens.find((t) => t.path === `motion.spring.${n}.stiffness`).value,
    damping: tokens.find((t) => t.path === `motion.spring.${n}.damping`).value,
  });
  const track = (name, spec, style = "", attrs = "") =>
    `<div class="track" ${attrs}><div class="track__label"><span class="track__name">${esc(name)}</span><span class="track__spec">${esc(spec)}</span></div><div class="track__rail"><span class="dot" style="${style}"></span></div></div>`;
  const panel = (title, kind, body) =>
    `<div class="mo mo--${kind}" data-kind="${kind}"><div class="mo__head"><h4 class="qu-type-h4">${esc(title)}</h4><button class="qu-button qu-button--secondary qu-button--sm" type="button" data-play>Play</button></div>${body}</div>`;

  render(
    "motion",
    panel("Duration", "css", durations.map((t) => track(t.path.split(".").pop(), ms(t), `--d: var(${t.name}); --e: var(--qu-ease-out)`)).join("")) +
      panel("Easing", "css", eases.map((t) => track(t.path.split(".").pop(), `cubic-bezier(${t.value.join(", ")})`, `--d: var(--qu-duration-slow); --e: var(${t.name})`)).join("")) +
      panel(
        "Spring",
        "spring",
        springNames
          .map(springOf)
          .map((s) => track(s.name, `stiffness ${s.stiffness}, damping ${s.damping}`, "", `data-stiffness="${s.stiffness}" data-damping="${s.damping}"`))
          .join(""),
      ),
  );

  const reducedNote = $('[data-fill="reduced"]');
  const showReduced = () => { if (reducedNote) reducedNote.hidden = !reduceMotion.matches; };
  showReduced();
  reduceMotion.addEventListener?.("change", showReduced);

  function playCss(p) {
    p.classList.add("no-anim");
    p.classList.remove("is-on");
    void p.offsetWidth; // put the dots back at the start before animating again
    p.classList.remove("no-anim");
    requestAnimationFrame(() => p.classList.add("is-on"));
  }

  // the same spring Motion runs (mass 1), stepped in small slices of time
  function playSpring(p) {
    $$(".track", p).forEach((tr) => {
      const dot = $(".dot", tr);
      const travel = $(".track__rail", tr).clientWidth - dot.offsetWidth;
      const k = Number(tr.dataset.stiffness);
      const c = Number(tr.dataset.damping);
      cancelAnimationFrame(Number(tr.dataset.frame || 0));
      if (reduceMotion.matches) { dot.style.left = `${travel}px`; return; }
      let x = 0;
      let v = 0;
      let last = performance.now();
      let elapsed = 0;
      const step = (now) => {
        let dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        elapsed += dt;
        while (dt > 0) {
          const h = Math.min(dt, 1 / 240);
          const a = -k * (x - 1) - c * v;
          v += a * h;
          x += v * h;
          dt -= h;
        }
        dot.style.left = `${x * travel}px`;
        if ((Math.abs(x - 1) > 0.0005 || Math.abs(v) > 0.0005) && elapsed < 4) tr.dataset.frame = String(requestAnimationFrame(step));
        else dot.style.left = `${travel}px`;
      };
      dot.style.left = "0px";
      tr.dataset.frame = String(requestAnimationFrame(step));
    });
  }

  $$(".mo").forEach((p) => {
    $("[data-play]", p).addEventListener("click", () => (p.dataset.kind === "spring" ? playSpring(p) : playCss(p)));
  });
})();
