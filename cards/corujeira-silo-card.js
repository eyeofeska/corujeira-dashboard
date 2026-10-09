/* A Corujeira silo card: a drawing of the water tank that fills to the current level, with the percentage inside and litres beside it.
   Options:
     entity:    level sensor in % (required)
     volume:    volume sensor in L (optional; otherwise worked out from capacity)
     capacity:  litres when full (default: volume / level, or 6200)
     distance:  sensor for distance from the level sensor to the water (optional, shown on wide screens)
     name:      title (default "Water Silo")
     color:     water colour (default #4AA8D8)
     low:       % at or below which the figure turns warning red (default 20)
     tap_action: { action: more-info | navigate | none, navigation_path } (default more-info on entity)
   Remove this resource to revert. */
(() => {
const TOP = 268, BOTTOM = 770;  // y of a full and an empty tank in the drawing's viewBox
const fmt = n => Math.round(n).toLocaleString("en-GB");

class CorujeiraSiloCard extends HTMLElement {
  setConfig(c) {
    if (!c || !c.entity) throw new Error("corujeira-silo-card: entity is required");
    this._c = { name: "Water Silo", color: "#4AA8D8", low: 20, ...c };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const col = this._c.color;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card { display:flex; align-items:center; gap:18px; padding:14px 18px 12px 14px; cursor:pointer; font-family:'Lato',sans-serif;
          -webkit-tap-highlight-color:transparent; transition:transform .1s; }
        ha-card:active { transform:scale(.985); }
        svg { flex:none; height:132px; width:auto; overflow:visible; }
        .ink { stroke:var(--primary-text-color); fill:none; stroke-linecap:round; stroke-linejoin:round; }
        .solid { fill:var(--primary-text-color); }
        .water { fill:${col}; }
        .crest { fill:color-mix(in srgb, ${col} 55%, #fff); }
        .pct { font:700 150px 'Lato',sans-serif; text-anchor:middle; letter-spacing:-4px; }
        .pct.dark { fill:var(--primary-text-color); }
        .pct.light { fill:#fff; }
        .pct.low.dark { fill:#C2574A; }
        .wave { animation:drift 6s linear infinite; }
        .wave.b { animation-duration:9s; animation-direction:reverse; }
        @keyframes drift { from { transform:translateX(0); } to { transform:translateX(-200px); } }
        @media (prefers-reduced-motion: reduce) { .wave { animation:none; } }
        .level { transition:transform 1.2s cubic-bezier(.3,.7,.3,1); }
        .info { min-width:0; display:flex; flex-direction:column; gap:2px; }
        .name { font-size:14px; font-weight:700; color:var(--primary-text-color); }
        .litres { font-size:28px; font-weight:700; line-height:1.1; color:var(--primary-text-color); margin-top:6px; }
        .litres span { font-size:16px; font-weight:400; margin-left:2px; }
        .sub { font-size:13px; color:var(--secondary-text-color); }
        .dist { display:none; }
        @media (min-width:1024px) { .dist { display:block; } }
      </style>
      <ha-card role="button" tabindex="0">
        <svg viewBox="140 100 820 730" aria-hidden="true">
          <defs>
            <clipPath id="inside"><path d="M232 274 H875 C875 296 933 306 933 385 V730 Q933 770 895 770 H205 Q167 770 167 730 V385 C167 306 232 296 232 274 Z"/></clipPath>
            <mask id="wet" maskUnits="userSpaceOnUse" x="140" y="100" width="820" height="730"><g class="level"><path class="wave" fill="#fff" d="${this._wave(0)}"/></g></mask>
          </defs>
          <g clip-path="url(#inside)">
            <g class="level">
              <path class="crest wave b" d="${this._wave(10)}"/>
              <path class="water wave" d="${this._wave(0)}"/>
            </g>
          </g>
          <g class="ink" stroke-width="6">
            <path d="M232 268 H875"/>
            <path d="M232 262 Q360 214 505 178"/>
            <path d="M615 180 Q790 196 876 262"/>
            <circle cx="552" cy="226" r="30"/>
            <path d="M167 477 H933 M167 497 H933 M167 652 H933 M167 675 H933"/>
            <path d="M503 773 V722 Q503 688 552 688 Q602 688 602 722 V773"/>
          </g>
          <path class="ink" stroke-width="14" d="M225 268 V166 H508 V175 H725 L882 196 V268 C882 290 940 300 940 385 V730 Q940 777 895 777 H205 Q160 777 160 730 V385 C160 300 225 290 225 268 Z"/>
          <path class="solid" d="M262 118 H452 V135 H472 V159 H258 V135 H262 Z"/>
          <rect class="solid" x="140" y="790" width="820" height="24"/>
          <text class="pct dark" x="552" y="628"></text>
          <g clip-path="url(#inside)"><text class="pct light" x="552" y="628" mask="url(#wet)"></text></g>
        </svg>
        <div class="info">
          <div class="name"></div>
          <div class="litres"></div>
          <div class="sub cap"></div>
          <div class="sub dist"></div>
        </div>
      </ha-card>`;
    const r = this.shadowRoot;
    this._el = { levels: r.querySelectorAll(".level"), pcts: r.querySelectorAll(".pct"), name: r.querySelector(".name"),
      litres: r.querySelector(".litres"), cap: r.querySelector(".cap"), dist: r.querySelector(".dist") };
    this._el.name.textContent = this._c.name;
    const card = r.querySelector("ha-card");
    card.addEventListener("click", () => this._tap());
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._tap(); } });
    this._key = null;
    if (this._hass) this._render();
  }
  // A water body whose top edge is a gentle wave at y=0; translated down to the level. Wide enough to drift 200px.
  _wave(phase) {
    const a = phase ? 18 : -14, y0 = phase ? -3 : 0;
    let d = `M100 ${y0} q50 ${a} 100 0`;
    for (let x = 200; x < 1200; x += 100) d += " t100 0";
    return d + ` V600 H100 Z`;
  }
  _tap() {
    const t = this._c.tap_action || { action: "more-info" };
    if (t.action === "none") return;
    if (t.action === "navigate" && t.navigation_path) {
      history.pushState(null, "", t.navigation_path);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
      return;
    }
    this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: t.entity || this._c.entity } }));
  }
  set hass(h) {
    this._hass = h;
    if (this._el) this._render();
  }
  _num(id) {
    const s = id && this._hass.states[id];
    const v = s ? parseFloat(s.state) : NaN;
    return isFinite(v) ? v : null;
  }
  _render() {
    const c = this._c;
    const lvl = this._num(c.entity);
    const vol = this._num(c.volume);
    const dist = this._num(c.distance);
    const key = [lvl, vol, dist].join("|");
    if (key === this._key) return;
    this._key = key;
    const cap = c.capacity || (vol != null && lvl > 0 ? Math.round(vol / lvl) * 100 : 6200);
    const p = lvl == null ? 0 : Math.max(0, Math.min(100, lvl));
    const y = BOTTOM - (BOTTOM - TOP) * p / 100;
    this._el.levels.forEach(g => g.setAttribute("transform", `translate(0 ${y})`));
    this._el.levels.forEach(g => g.style.transform = `translateY(${y}px)`);
    const low = lvl != null && lvl <= c.low;
    this._el.pcts.forEach(t => {
      t.innerHTML = lvl == null ? "–" : `${Math.round(lvl)}<tspan font-size="90" dx="6">%</tspan>`;
      t.classList.toggle("low", low);
    });
    const litres = vol != null ? vol : lvl != null ? cap * lvl / 100 : null;
    this._el.litres.innerHTML = litres == null ? "–" : `${fmt(litres)}<span>L</span>`;
    this._el.cap.textContent = litres == null ? "unavailable" : `left of ${fmt(cap)} L`;
    const unit = c.distance && this._hass.states[c.distance] && this._hass.states[c.distance].attributes.unit_of_measurement;
    const m = dist == null ? null : unit === "mm" ? dist / 1000 : unit === "cm" ? dist / 100 : dist;
    this._el.dist.textContent = m == null ? "" : `${m.toFixed(2)} m from sensor to water`;
  }
  getCardSize() { return 3; }
  getGridOptions() { return { columns: 12, rows: "auto" }; }
}
if (!customElements.get("corujeira-silo-card")) customElements.define("corujeira-silo-card", CorujeiraSiloCard);
window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === "corujeira-silo-card"))
  window.customCards.push({ type: "corujeira-silo-card", name: "A Corujeira silo", description: "Water tank drawing that fills to the current level, with % and litres." });
})();
