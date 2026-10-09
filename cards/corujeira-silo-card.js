/* A Corujeira silo card: a drawing of the water tank that fills to the current level, with the percentage inside,
   litres beside it, and optionally the pump that fills it (on/off switch, run-time pills, countdown).
   Options:
     entity:     level sensor in %, where 100% = full storage (required)
     volume:     volume sensor in L (optional; otherwise worked out from capacity)
     capacity:   litres at 100% (default 5000)
     headroom:   how far above 100% the tank drawing goes, in % (default 24: the dome above the stored water)
     distance:   sensor for distance from the level sensor to the water (optional, shown on wide screens)
     name:       title (default "Water Silo")
     color:      water colour (default #4AA8D8)
     low:        % at or below which the figure turns warning red (default 20)
     pump:       switch entity for the pump (optional; adds the pump row)
     pump_name:  default "Creek Pump"
     pump_timer: timer entity that counts the run down (optional)
     pump_run_time: input_select of run times such as "30 min" (optional, shown as pills)
     pump_power: power sensor of the pump (optional, shown while running)
     pump_icon:  default corujeira:creek-pump
     tap_action: { action: more-info | navigate | none, navigation_path } (default more-info on entity); applies to the tank and figures
   Remove this resource to revert. */
(() => {
const FULL_LINE = 268, BOTTOM = 770;  // y of the collar line and the tank floor in the drawing's viewBox
const fmt = n => Math.round(n).toLocaleString("en-GB");
const mmss = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };

class CorujeiraSiloCard extends HTMLElement {
  setConfig(c) {
    if (!c || !c.entity) throw new Error("corujeira-silo-card: entity is required");
    this._c = { name: "Water Silo", color: "#4AA8D8", low: 20, capacity: 5000, headroom: 24,
      pump_name: "Creek Pump", pump_icon: "corujeira:creek-pump", ...c };
    // 100% sits below the collar line so the dome above it reads as headroom, not storage.
    this._top = BOTTOM - (BOTTOM - FULL_LINE) * 100 / (100 + this._c.headroom);
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const col = this._c.color, pump = !!this._c.pump;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card { padding:14px 16px 14px 12px; font-family:'Lato',sans-serif; }
        .row { display:flex; align-items:center; gap:16px; }
        .hit { cursor:pointer; -webkit-tap-highlight-color:transparent; }
        svg { flex:none; height:136px; width:auto; overflow:visible; }
        .ink { stroke:var(--primary-text-color); fill:none; stroke-linecap:round; stroke-linejoin:round; }
        .solid { fill:var(--primary-text-color); }
        .water { fill:${col}; }
        .crest { fill:color-mix(in srgb, ${col} 55%, #fff); }
        .max { stroke:color-mix(in srgb, var(--primary-text-color) 45%, transparent); stroke-width:5; stroke-dasharray:18 14; fill:none; }
        .stream { stroke:${col}; stroke-width:16; stroke-linecap:round; stroke-dasharray:26 22; fill:none; opacity:0; transition:opacity .4s; animation:pour .7s linear infinite; }
        .on .stream { opacity:.9; }
        @keyframes pour { to { stroke-dashoffset:-48; } }
        .pct { font:700 150px 'Lato',sans-serif; text-anchor:middle; letter-spacing:-4px; }
        .pct.dark { fill:var(--primary-text-color); }
        .pct.light { fill:#fff; }
        .pct.low.dark { fill:#C2574A; }
        .wave { animation:drift 6s linear infinite; }
        .wave.b { animation-duration:9s; animation-direction:reverse; }
        @keyframes drift { from { transform:translateX(0); } to { transform:translateX(-200px); } }
        @media (prefers-reduced-motion: reduce) { .wave, .stream { animation:none; } }
        .level { transition:transform 1.2s cubic-bezier(.3,.7,.3,1); }
        .right { flex:1; min-width:0; display:flex; flex-direction:column; gap:10px; }
        .info { display:flex; flex-direction:column; gap:2px; }
        .name { font-size:14px; font-weight:700; color:var(--primary-text-color); }
        .litres { font-size:28px; font-weight:700; line-height:1.1; color:var(--primary-text-color); margin-top:4px; }
        .litres span { font-size:16px; font-weight:400; margin-left:2px; }
        .sub { font-size:13px; color:var(--secondary-text-color); }
        .dist { display:none; }
        @media (min-width:1024px) { .dist { display:block; } }
        .pump { border-top:1px solid var(--divider-color, rgba(84,98,108,.2)); padding-top:10px; display:flex; flex-direction:column; gap:8px; }
        .ptop { display:flex; align-items:center; gap:8px; }
        .ptop ha-icon { --mdc-icon-size:22px; color:var(--primary-text-color); flex:none; }
        .pname { font-size:14px; font-weight:700; color:var(--primary-text-color); line-height:1.15; cursor:pointer; }
        .pstate { font-size:12.5px; color:var(--secondary-text-color); font-variant-numeric:tabular-nums; }
        .pstate.run { color:color-mix(in srgb, ${col} 80%, #000); font-weight:700; }
        .ptext { flex:1; min-width:0; }
        .sw { all:unset; flex:none; position:relative; width:58px; height:32px; border-radius:999px; cursor:pointer; box-sizing:border-box;
          background:color-mix(in srgb, var(--primary-text-color) 18%, transparent); transition:background .2s; -webkit-tap-highlight-color:transparent; }
        .sw::after { content:""; position:absolute; top:3px; left:3px; width:26px; height:26px; border-radius:50%; background:#fff;
          box-shadow:0 1px 3px rgba(0,0,0,.3); transition:transform .2s cubic-bezier(.3,.7,.3,1); }
        .sw[aria-checked="true"] { background:${col}; }
        .sw[aria-checked="true"]::after { transform:translateX(26px); }
        .sw:focus-visible { outline:2px solid ${col}; outline-offset:2px; }
        .sw:disabled { cursor:not-allowed; opacity:.45; }
        .pills { display:flex; gap:4px; flex-wrap:wrap; }
        .pills button { all:unset; box-sizing:border-box; cursor:pointer; font-size:12.5px; font-weight:700; line-height:1; padding:7px 10px; border-radius:999px;
          color:var(--secondary-text-color); background:color-mix(in srgb, var(--primary-text-color) 7%, transparent); transition:background .15s, color .15s, transform .1s;
          -webkit-tap-highlight-color:transparent; }
        .pills button:active { transform:scale(.94); }
        .pills button:focus-visible { outline:2px solid ${col}; outline-offset:1px; }
        .pills button.on { background:color-mix(in srgb, ${col} 85%, #000); color:#fff; cursor:default; }
      </style>
      <ha-card>
        <div class="row">
          <svg class="hit tank" viewBox="140 100 820 730" role="img" aria-label="Silo level">
            <defs>
              <clipPath id="inside"><path d="M232 274 H875 C875 296 933 306 933 385 V730 Q933 770 895 770 H205 Q167 770 167 730 V385 C167 306 232 296 232 274 Z"/></clipPath>
              <mask id="wet" maskUnits="userSpaceOnUse" x="140" y="100" width="820" height="730"><g class="level"><path class="wave" fill="#fff" d="${this._wave(0)}"/></g></mask>
            </defs>
            <g clip-path="url(#inside)">
              <g class="level">
                <path class="crest wave b" d="${this._wave(1)}"/>
                <path class="water wave" d="${this._wave(0)}"/>
              </g>
              ${pump ? `<path class="stream" d="M552 262 V780"/>` : ""}
              <path class="max" d="M175 ${this._top.toFixed(0)} H925"/>
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
          <div class="right">
            <div class="info hit">
              <div class="name"></div>
              <div class="litres"></div>
              <div class="sub cap"></div>
              <div class="sub dist"></div>
            </div>
            ${pump ? `
            <div class="pump">
              <div class="ptop">
                <ha-icon></ha-icon>
                <div class="ptext"><div class="pname"></div><div class="pstate"></div></div>
                <button class="sw" role="switch" aria-checked="false"></button>
              </div>
              <div class="pills"></div>
            </div>` : ""}
          </div>
        </div>
      </ha-card>`;
    const r = this.shadowRoot, q = s => r.querySelector(s);
    this._el = { svg: q("svg"), levels: r.querySelectorAll(".level"), pcts: r.querySelectorAll(".pct"), name: q(".name"),
      litres: q(".litres"), cap: q(".cap"), dist: q(".dist"), sw: q(".sw"), stream: q(".stream"), pstate: q(".pstate"), pills: q(".pills") };
    this._el.name.textContent = this._c.name;
    const open = () => this._tap();
    [q(".tank"), q(".info")].forEach(el => el.addEventListener("click", open));
    if (pump) {
      q(".ptop ha-icon").setAttribute("icon", this._c.pump_icon);
      q(".pname").textContent = this._c.pump_name;
      q(".pname").addEventListener("click", () => this._more(this._c.pump));
      this._el.sw.setAttribute("aria-label", this._c.pump_name);
      this._el.sw.addEventListener("click", e => {
        e.stopPropagation();
        const on = this._el.sw.getAttribute("aria-checked") === "true";
        this._hass.callService("switch", on ? "turn_off" : "turn_on", { entity_id: this._c.pump });
      });
    }
    this._key = null;
    this._opts = null;
    if (this._hass) this._render();
  }
  // A water body whose top edge is a gentle alternating wave at y=0; translated down to the level. Wide enough to drift 200px.
  _wave(alt) {
    const a = alt ? 18 : -14, y0 = alt ? -3 : 0;
    let d = `M100 ${y0} q50 ${a} 100 0`;
    for (let x = 200; x < 1200; x += 100) d += " t100 0";
    return d + " V600 H100 Z";
  }
  _more(id) {
    this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: id } }));
  }
  _tap() {
    const t = this._c.tap_action || { action: "more-info" };
    if (t.action === "none") return;
    if (t.action === "navigate" && t.navigation_path) {
      history.pushState(null, "", t.navigation_path);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
      return;
    }
    this._more(t.entity || this._c.entity);
  }
  set hass(h) {
    this._hass = h;
    if (this._el) this._render();
  }
  _st(id) { return id ? this._hass.states[id] : undefined; }
  _num(id) {
    const s = this._st(id);
    const v = s ? parseFloat(s.state) : NaN;
    return isFinite(v) ? v : null;
  }
  disconnectedCallback() { clearInterval(this._tick); this._tick = null; }
  connectedCallback() { if (this._hass && this._el) { this._key = null; this._render(); } }
  _render() {
    const c = this._c;
    const lvl = this._num(c.entity), vol = this._num(c.volume), dist = this._num(c.distance);
    const ps = this._st(c.pump), ts = this._st(c.pump_timer), rs = this._st(c.pump_run_time), pw = this._num(c.pump_power);
    const key = [lvl, vol, dist, ps && ps.state, ts && ts.state, ts && ts.attributes.finishes_at, ts && ts.attributes.remaining, rs && rs.state, pw].join("|");
    if (key === this._key) return;
    this._key = key;

    const cap = c.capacity;
    const p = lvl == null ? 0 : Math.max(0, Math.min(100 + c.headroom, lvl));
    const y = BOTTOM - (BOTTOM - this._top) * p / 100;
    this._el.levels.forEach(g => { g.setAttribute("transform", `translate(0 ${y})`); g.style.transform = `translateY(${y}px)`; });
    if (this._el.stream) this._el.stream.setAttribute("d", `M552 262 V${Math.max(262, y + 6).toFixed(0)}`);
    const low = lvl != null && lvl <= c.low;
    this._el.pcts.forEach(t => {
      t.innerHTML = lvl == null ? "–" : `${Math.round(lvl)}<tspan font-size="90" dx="6">%</tspan>`;
      t.classList.toggle("low", low);
    });
    const litres = vol != null ? vol : lvl != null ? cap * lvl / 100 : null;
    this._el.litres.innerHTML = litres == null ? "–" : `${fmt(litres)}<span>L</span>`;
    this._el.cap.textContent = litres == null ? "unavailable" : litres >= cap ? `full (${fmt(cap)} L)` : `left of ${fmt(cap)} L`;
    const unit = this._st(c.distance) && this._st(c.distance).attributes.unit_of_measurement;
    const m = dist == null ? null : unit === "mm" ? dist / 1000 : unit === "cm" ? dist / 100 : dist;
    this._el.dist.textContent = m == null ? "" : `${m.toFixed(2)} m from sensor to water`;

    if (!c.pump) return;
    const on = !!ps && ps.state === "on";
    const avail = !!ps && !["unavailable", "unknown"].includes(ps.state);
    const full = lvl != null && lvl >= 100;
    this._el.svg.classList.toggle("on", on);
    this._el.sw.setAttribute("aria-checked", on);
    this._el.sw.disabled = !avail || (full && !on);
    this._el.sw.title = full && !on ? "Silo is full" : "";

    const opts = (rs && rs.attributes.options) || [];
    if (JSON.stringify(opts) !== this._opts) {
      this._opts = JSON.stringify(opts);
      this._el.pills.innerHTML = "";
      opts.forEach(o => {
        const b = document.createElement("button");
        b.textContent = o;
        b.dataset.o = o;
        b.addEventListener("click", e => {
          e.stopPropagation();
          if (this._st(c.pump_run_time).state === o) return;
          this._hass.callService("input_select", "select_option", { entity_id: c.pump_run_time, option: o });
        });
        this._el.pills.appendChild(b);
      });
    }
    this._el.pills.querySelectorAll("button").forEach(b => {
      const sel = rs && b.dataset.o === rs.state;
      b.classList.toggle("on", !!sel);
      b.setAttribute("aria-pressed", !!sel);
    });

    clearInterval(this._tick);
    this._tick = null;
    const st = this._el.pstate;
    st.classList.toggle("run", on);
    if (!avail) { st.textContent = "Unavailable"; return; }
    if (!on) { st.textContent = full ? "Off · silo full" : "Off"; return; }
    const watts = pw != null ? ` · ${Math.round(pw)} W` : "";
    const ends = ts && ts.state === "active" && ts.attributes.finishes_at ? Date.parse(ts.attributes.finishes_at) : null;
    if (ends) {
      const show = () => { st.textContent = `${mmss((ends - Date.now()) / 1000)} left${watts}`; };
      show();
      this._tick = setInterval(show, 1000);
    } else {
      st.textContent = `Running${watts}`;
    }
  }
  getCardSize() { return this._c && this._c.pump ? 4 : 3; }
  getGridOptions() { return { columns: 12, rows: "auto" }; }
}
if (!customElements.get("corujeira-silo-card")) customElements.define("corujeira-silo-card", CorujeiraSiloCard);
window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === "corujeira-silo-card"))
  window.customCards.push({ type: "corujeira-silo-card", name: "A Corujeira silo", description: "Water tank drawing that fills to the current level, with % and litres, plus an optional pump switch." });
})();
