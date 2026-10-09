/* A Corujeira Hoot card: Hoot the land wizard, a little owl in a wizard's hat with a speech bubble of
   what the land needs. Weather advice (frost, rain, wind, heat, power, water, planting, mushrooms) comes
   from the meteogram card, which publishes it on the page and keeps the last set in localStorage; fire
   advice comes from Vigia's sensors. Each line gets a small icon you can recolour.
   Options: title (default "Hoot"), subtitle (default "Land wizard"), max (lines shown, default 6),
   fire (fire lines, default true), burn_window (low-risk burning nudge Oct to May, default true),
   fire_risk / fire_risk_tomorrow / alert_level / fires_nearby (entity ids, default Vigia's),
   colors (per kind: mushroom, plant, fire, frost, rain, wind, heat, power, water),
   navigate (tapping Hoot opens e.g. "#weather"), stale_hours (drop weather advice older than this, default 18).
   Needs a corujeira-meteogram-card somewhere in the dashboard (advice: false hides its own lines). */
(() => {
const KINDS = {
  mushroom: "#A0673A", plant: "#2E7D4F", fire: "#C2574A", frost: "#3D9BC9", rain: "#2A6FB0",
  wind: "#5E665B", heat: "#D9573F", power: "#B98A16", water: "#2F8F9D",
};
// 24px line icons drawn with currentColor, so a colour on the wrapper recolours them
const ICON = {
  mushroom: `<path d="M3.5 12.2C3.5 7 7.3 3.5 12 3.5s8.5 3.5 8.5 8.7z"/><path d="M9.3 12.2v6.3a2.7 2.7 0 0 0 5.4 0v-6.3"/><circle cx="9" cy="8.3" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.6" cy="6.9" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.2" cy="10" r=".9" fill="currentColor" stroke="none"/>`,
  plant: `<path d="M12 21v-9"/><path d="M12 13.5C12 9.2 8.6 7 4.5 7c0 4.2 3.2 6.5 7.5 6.5z"/><path d="M12 11.5c0-4.6 3.4-7 7.5-7 0 4.6-3.2 7-7.5 7z"/><path d="M7.5 21h9"/>`,
  fire: `<path d="M12 21.5c-3.9 0-6.8-2.7-6.8-6.5 0-3.6 2.5-5.6 3.9-8.4.4 2 1.4 3.1 2.5 3.6.2-3.4 1.8-5.9 4.3-7.7-.3 3.3 3.4 6 3.4 11.1 0 4.7-3.2 7.9-7.3 7.9z"/><path d="M12 21.5c-1.8 0-3.1-1.2-3.1-3 0-1.9 1.5-2.9 2.3-4.4.9 1.7 3.8 2.6 3.8 4.6 0 1.6-1.2 2.8-3 2.8z"/>`,
  frost: `<path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5M4.2 10.7l3.4-.9-.9-3.4M19.8 13.3l-3.4.9.9 3.4M4.2 13.3l3.4.9-.9 3.4M19.8 10.7l-3.4-.9.9-3.4"/>`,
  rain: `<path d="M12 3.5c3 4.1 6 7.3 6 11a6 6 0 0 1-12 0c0-3.7 3-6.9 6-11z"/><path d="M9.2 15.2a2.9 2.9 0 0 0 2.6 2.6"/>`,
  wind: `<path d="M3 8.5h10.5a3 3 0 1 0-3-3"/><path d="M3 12.5h15a3 3 0 1 1-3 3"/><path d="M3 16.5h7"/>`,
  heat: `<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>`,
  power: `<path d="M13.2 2.5 5 13.5h6.2l-1.4 8L18.5 10h-6.3z"/>`,
  water: `<path d="M5 8.5h9.5a3.5 3.5 0 0 1 0 7H13"/><path d="M5 5.5v6"/><path d="M13 15.5c1.2 1.6 2 2.7 2 3.6a2 2 0 0 1-4 0c0-.9.8-2 2-3.6z"/>`,
};
const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ICON.plant}</svg>`;
// Hoot: round owl, cream face and belly, a green wizard's hat with a gold star
const OWL = `<svg class="owl" viewBox="0 0 64 74" aria-hidden="true">
  <ellipse cx="32" cy="71" rx="15" ry="2.2" fill="rgba(52,58,64,.14)"/>
  <ellipse cx="32" cy="47" rx="22" ry="23" fill="#8A6A4F"/>
  <path d="M10.6 46c-2.6 6 .4 13.6 6 16.4-1.6-6-1.4-11 1-15.6z" fill="#6F533D"/>
  <path d="M53.4 46c2.6 6-.4 13.6-6 16.4 1.6-6 1.4-11-1-15.6z" fill="#6F533D"/>
  <ellipse cx="32" cy="56" rx="13" ry="12.5" fill="#EADCC3"/>
  <path d="M26.5 52.5l2 1.8 2-1.8M33.5 52.5l2 1.8 2-1.8M30 57.5l2 1.8 2-1.8M26.5 62l2 1.6 2-1.6M33.5 62l2 1.6 2-1.6" fill="none" stroke="#C9B48F" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="23.5" cy="40" r="9.2" fill="#F5EDDE"/><circle cx="40.5" cy="40" r="9.2" fill="#F5EDDE"/>
  <g class="eyes"><circle cx="24.3" cy="40.6" r="4.6" fill="#2B2B2B"/><circle cx="39.7" cy="40.6" r="4.6" fill="#2B2B2B"/>
  <circle cx="25.8" cy="39" r="1.5" fill="#fff"/><circle cx="41.2" cy="39" r="1.5" fill="#fff"/></g>
  <g class="lids"><circle cx="24.3" cy="40.6" r="5.2" fill="#F5EDDE"/><circle cx="39.7" cy="40.6" r="5.2" fill="#F5EDDE"/></g>
  <path d="M29.2 46.4h5.6L32 51.2z" fill="#E8913A"/>
  <path d="M26 69.5l1.4-2.4 1.4 2.4M35.2 69.5l1.4-2.4 1.4 2.4" fill="none" stroke="#E8913A" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M15.5 27.5 33.5 1.5c1.2 4 4.6 7.4 8.4 9.2L48.5 27.5z" fill="#2E5E44"/>
  <path d="M21.4 21.3c6 1.5 15.5 1.5 22.4-.6" fill="none" stroke="#D4A72C" stroke-width="1.8" stroke-linecap="round"/>
  <ellipse cx="32" cy="27.5" rx="20" ry="3.6" fill="#244D37"/>
  <path d="M30 12.2l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.2 1.2.4-2.5-1.8-1.7 2.5-.3z" fill="#D4A72C"/>
</svg>`;
const RISK = { 1: "low", 2: "moderate", 3: "high", 4: "very high", 5: "maximum" };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// the lead phrase (up to the first colon, or the first sentence) in bold so the lines scan
const lead = t => { const m = String(t).match(/^(.{4,70}?[:.])(\s.*)$/s); return m ? `<b>${esc(m[1])}</b>${esc(m[2])}` : esc(t); };
const load = () => { try { return JSON.parse(localStorage.getItem("corujeira-land:advice")); } catch (e) { return null; } };

class CorujeiraHootCard extends HTMLElement {
  setConfig(c) {
    this._c = {
      title: "Hoot", subtitle: "Land wizard", max: 6, fire: true, burn_window: true, stale_hours: 18,
      fire_risk: "sensor.vigia_fire_risk", fire_risk_tomorrow: "sensor.vigia_fire_risk_tomorrow",
      alert_level: "sensor.vigia_alert_level", fires_nearby: "sensor.vigia_fires_nearby", ...c,
    };
    this._colors = { ...KINDS, ...(c.colors || {}) };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._build();
    this._render();
  }
  getCardSize() { return 3; }
  getGridOptions() { return { columns: 12, rows: "auto" }; }

  set hass(h) {
    const prev = this._hass;
    this._hass = h;
    const ids = ["fire_risk", "fire_risk_tomorrow", "alert_level", "fires_nearby"].map(k => this._c[k]);
    if (!prev || ids.some(id => prev.states[id] !== h.states[id])) this._render();
  }
  connectedCallback() {
    this._onLand = this._onLand || (e => { this._land = e.detail; this._render(); });
    window.addEventListener("corujeira-land-advice", this._onLand);
    this._land = window.__corujeiraLand || this._land || load();
    this._render();
    // the day names in the advice ("today") go stale overnight, so look again every 30 minutes
    if (!this._timer) this._timer = setInterval(() => this._render(), 30 * 60e3);
  }
  disconnectedCallback() {
    window.removeEventListener("corujeira-land-advice", this._onLand);
    clearInterval(this._timer); this._timer = null;
  }

  _build() {
    this.shadowRoot.innerHTML = `
      <style>
        ha-card { padding:14px 16px 14px 12px; }
        .wrap { display:flex; align-items:flex-start; gap:10px; }
        .who { flex:none; width:64px; display:flex; flex-direction:column; align-items:center; gap:2px; }
        .who.link { cursor:pointer; -webkit-tap-highlight-color:transparent; }
        .owl { width:58px; height:67px; display:block; }
        .owl .lids circle { transform-box:fill-box; transform-origin:50% 0; transform:scaleY(0); animation:blink 7s infinite; }
        .owl .lids circle + circle { animation-delay:.02s; }
        @keyframes blink { 0%, 95% { transform:scaleY(0); } 96.5%, 97.5% { transform:scaleY(1); } 99%, 100% { transform:scaleY(0); } }
        @media (prefers-reduced-motion: reduce) { .owl .lids circle { animation:none; } }
        .name { font-size:13px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--primary-text-color); line-height:1.1; }
        .sub { font-size:10.5px; color:var(--secondary-text-color); text-align:center; line-height:1.15; }
        .bubble { position:relative; flex:1; min-width:0; margin-top:6px; padding:10px 12px 11px; border-radius:16px;
          --hb:var(--hoot-bubble-color, color-mix(in srgb, var(--card-background-color, #fff) 45%, #fff));
          background:var(--hb); border:1px solid rgba(52,58,64,.16); }
        .bubble::before { content:""; position:absolute; left:-7px; top:22px; width:12px; height:12px; background:var(--hb);
          border-left:1px solid rgba(52,58,64,.16); border-bottom:1px solid rgba(52,58,64,.16); transform:rotate(45deg); }
        .hello { font-size:13.5px; line-height:1.4; color:var(--primary-text-color); margin-bottom:6px; }
        .hello:last-child { margin-bottom:0; }
        ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:7px; }
        li { display:flex; align-items:flex-start; gap:8px; font-size:13px; line-height:1.4; color:var(--primary-text-color); }
        li .ic { flex:none; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-top:-1px; }
        li .ic svg { width:15px; height:15px; }
        li b { font-weight:700; }
        .more { margin-top:6px; background:none; border:none; padding:0; font:inherit; font-size:12px; color:var(--secondary-text-color); cursor:pointer; }
      </style>
      <ha-card>
        <div class="wrap">
          <div class="who">${OWL}<div class="name">${esc(this._c.title)}</div><div class="sub">${esc(this._c.subtitle)}</div></div>
          <div class="bubble"><div class="hello"></div><ul></ul><button class="more" hidden></button></div>
        </div>
      </ha-card>`;
    const nav = this._c.navigate;
    if (nav) {
      const w = this.shadowRoot.querySelector(".who");
      w.classList.add("link");
      w.addEventListener("click", () => {
        history.pushState(null, "", nav.startsWith("#") ? location.pathname + location.search + nav : nav);
        window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
      });
    }
    this.shadowRoot.querySelector(".more").addEventListener("click", () => { this._open = !this._open; this._render(); });
  }

  // Fire lines from Vigia: an active alert first, then today's or tomorrow's risk, then a quiet burning window.
  _fire() {
    const h = this._hass, c = this._c, out = [];
    if (!h || !c.fire) return out;
    const st = id => h.states[id], num = id => { const s = st(id); const v = s ? parseFloat(s.state) : NaN; return isNaN(v) ? null : v; };
    const al = st(c.alert_level);
    if (al && ["watch", "upwind", "close"].includes(al.state)) {
      const a = al.attributes, km = a.distance_km != null ? `${Math.round(a.distance_km)} km` : "nearby";
      const where = `${km}${a.direction ? " " + a.direction : ""}${a.upwind ? ", upwind" : ""}`;
      const what = al.state === "close" ? "Fill the buckets, keep the hoses ready, and have the go-bag by the car."
        : al.state === "upwind" ? "Smoke may reach us. Close the yurt, keep an eye on the sky and the Vigia map." : "Vigia is watching it.";
      out.push({ pri: 0, kind: "fire", text: `Fire ${where}. ${what}` });
    } else {
      const n = num(c.fires_nearby);
      if (n) out.push({ pri: 2, kind: "fire", text: `${n === 1 ? "A fire" : n + " fires"} within ${Math.round((st(c.fires_nearby).attributes.radius_km) || 30)} km. Vigia is watching.` });
    }
    const r0 = num(c.fire_risk), r1 = num(c.fire_risk_tomorrow), top = Math.max(r0 || 0, r1 || 0);
    if (top >= 3) {
      const day = (r0 || 0) >= top ? "today" : "tomorrow";
      out.push({ pri: top >= 4 ? 1 : 2, kind: "fire", text: top >= 4
        ? `Fire risk ${RISK[top]} ${day}: no burning and no sparks outdoors (grinders, chainsaws, mowing dry grass). Keep the hose ready.`
        : `Fire risk ${RISK[top]} ${day}: no burning, and keep spark-making tools away from dry grass.` });
    } else if (c.burn_window && r0 != null && r0 <= 2 && (r1 == null || r1 <= 2)) {
      const m = new Date().getMonth() + 1;
      if (m >= 10 || m <= 5) out.push({ pri: 3, kind: "fire", text: "Fire risk low: a fair window to burn pruning piles, once the burn is registered with ICNF or the câmara." });
    }
    return out;
  }

  _render() {
    if (!this.shadowRoot || !this._c) return;
    const land = this._land, fresh = land && land.ts && Date.now() - land.ts < this._c.stale_hours * 3600e3;
    const weather = fresh ? land.items || [] : [];
    const all = [...this._fire(), ...weather].sort((a, b) => a.pri - b.pri);
    const max = this._c.max, shown = this._open ? all : all.slice(0, max);
    const hr = new Date().getHours(), hi = hr < 5 ? "Hoo, up late." : hr < 12 ? "Hoo! Good morning." : hr < 18 ? "Hoo! Good afternoon." : "Hoo! Good evening.";
    const hello = this.shadowRoot.querySelector(".hello");
    hello.textContent = !land && !all.length ? "Hoo… listening to the forecast."
      : all.length ? `${hi} Here's what the land wants:` : `${hi} All quiet on the land. Enjoy it.`;
    this.shadowRoot.querySelector("ul").innerHTML = shown.map(x => {
      const col = this._colors[x.kind] || this._colors.plant;
      return `<li><span class="ic" style="color:${esc(col)};background:color-mix(in srgb, ${esc(col)} 13%, transparent)">${icon(x.kind)}</span><span>${lead(x.text)}</span></li>`;
    }).join("");
    const more = this.shadowRoot.querySelector(".more");
    more.hidden = all.length <= max;
    more.textContent = this._open ? "Show less" : `${all.length - max} more`;
  }
}
if (!customElements.get("corujeira-hoot-card")) customElements.define("corujeira-hoot-card", CorujeiraHootCard);
window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === "corujeira-hoot-card"))
  window.customCards.push({ type: "corujeira-hoot-card", name: "A Corujeira Hoot", description: "Hoot the land wizard: land advice from the forecast and fire watch in a speech bubble." });
})();
