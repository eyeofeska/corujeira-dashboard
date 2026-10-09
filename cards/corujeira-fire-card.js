/* A Corujeira fire tile: always-on fire risk strip for the top of the dashboard.
   Reads IPMA's daily fire risk (sensor from the IPMA integration, 1 = low ... 5 = maximum), IPMA's weather
   warning level, and satellite hotspots (geo_location entities from the GeoJSON integration fed by NASA FIRMS).
   Quiet and compact at low risk; tinted with plain advice at high risk; a red line when a hotspot is close,
   saying whether the wind is blowing from it toward the land. Options: risk, warning, wind (entity ids),
   near_km (hotspots counted, default 30), alert_km (close fire, default 5), navigate (e.g. "#fire"). */
(() => {
const LEVELS = [
  null,
  { name: "low", color: "#3DAA5C" },
  { name: "moderate", color: "#D9A400" },
  { name: "high", color: "#F07F1A" },
  { name: "very high", color: "#E0402C" },
  { name: "maximum", color: "#9B1C3F" },
];
const ADVICE = {
  3: "No outdoor fires or burning. Careful with sparks: angle grinders, brush cutters, chainsaws.",
  4: "No outdoor fires or burning. Avoid angle grinders, brush cutters and chainsaws outside. Keep a hose ready.",
  5: "No outdoor fires or burning. No spark-making tools outside. Keep hoses ready and the silo full.",
};
const WARN = { yellow: "#E5B800", orange: "#F07F1A", red: "#E0402C" };
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rad = d => d * Math.PI / 180;
const km = (a, b, c, d) => {
  const h = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const bearing = (a, b, c, d) => {
  const y = Math.sin(rad(d - b)) * Math.cos(rad(c));
  const x = Math.cos(rad(a)) * Math.sin(rad(c)) - Math.sin(rad(a)) * Math.cos(rad(c)) * Math.cos(rad(d - b));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};
const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

class CorujeiraFireCard extends HTMLElement {
  setConfig(c) {
    this._c = { risk: "sensor.ponte_de_lima_fire_risk", warning: "sensor.ponte_de_lima_weather_alert",
      wind: "weather.forecast_home", near_km: 30, alert_km: 5, ...c };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card { display:block; box-sizing:border-box; padding:10px 14px; font-family:'Lato',sans-serif; border-radius:var(--ha-card-border-radius, 18px);
          transition:background .3s; -webkit-tap-highlight-color:transparent; }
        ha-card.tap { cursor:pointer; }
        .row { display:flex; align-items:center; gap:12px; }
        .ico { width:36px; height:36px; flex:none; border-radius:50%; display:flex; align-items:center; justify-content:center; }
        .ico ha-icon { --mdc-icon-size:21px; }
        .main { flex:1 1 auto; min-width:0; }
        .title { font-size:15px; color:var(--primary-text-color); line-height:1.25; }
        .title b { font-weight:800; }
        .sub { font-size:12.5px; color:var(--secondary-text-color); line-height:1.35; margin-top:1px; }
        .meter { display:flex; gap:3px; flex:none; }
        .meter i { display:block; width:14px; height:8px; border-radius:3px; background:color-mix(in srgb, var(--primary-text-color) 10%, transparent); }
        .lines { margin:8px 0 0 48px; display:flex; flex-direction:column; gap:4px; }
        .line { display:flex; gap:6px; align-items:flex-start; font-size:13.5px; line-height:1.4; }
        .line ha-icon { --mdc-icon-size:16px; flex:none; margin-top:2px; }
        .warnpill { display:inline-block; padding:0 7px; border-radius:999px; font-size:11.5px; font-weight:700; color:#fff; margin-left:4px; vertical-align:1px; }
        @media (max-width: 480px) { .meter i { width:9px; } .lines { margin-left:0; } }
      </style>
      <ha-card><div class="row"><div class="ico"><ha-icon icon="mdi:fire"></ha-icon></div>
        <div class="main"><div class="title"></div><div class="sub"></div></div><div class="meter"></div></div>
        <div class="lines"></div></ha-card>`;
    const card = this.shadowRoot.querySelector("ha-card");
    card.classList.toggle("tap", !!this._c.navigate);
    card.addEventListener("click", () => {
      const nav = this._c.navigate;
      if (nav) {
        history.pushState(null, "", nav.startsWith("#") ? location.pathname + location.search + nav : nav);
        window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
      } else if (this._c.risk) {
        this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: this._c.risk } }));
      }
    });
    this._sig = null;
    if (this._hass) this._render();
  }
  getCardSize() { return 1; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }

  set hass(h) {
    this._hass = h;
    // re-render only when something this tile shows has changed
    const fires = Object.keys(h.states).filter(k => k.startsWith("geo_location.") && h.states[k].attributes.source === "geo_json_events");
    const st = k => k && h.states[k] ? h.states[k].state : "";
    const w = this._c && h.states[this._c.wind];
    const sig = [st(this._c.risk), st(this._c.warning), w && w.attributes.wind_bearing, w && w.attributes.wind_speed,
      fires.map(k => k + h.states[k].attributes.latitude + h.states[k].attributes.longitude).join()].join("|");
    if (sig !== this._sig) { this._sig = sig; this._render(); }
  }

  // hotspots: distance and direction from home, and whether the wind is blowing from them toward the land
  _fires() {
    const h = this._hass, home = h.states["zone.home"];
    if (!home) return [];
    const lat = home.attributes.latitude, lon = home.attributes.longitude;
    const w = h.states[this._c.wind], from = w && w.attributes.wind_bearing, speed = w ? +w.attributes.wind_speed || 0 : 0;
    return Object.values(h.states)
      .filter(s => s.entity_id.startsWith("geo_location.") && s.attributes.source === "geo_json_events"
        && s.attributes.latitude != null && s.attributes.longitude != null)
      .map(s => {
        const d = km(lat, lon, s.attributes.latitude, s.attributes.longitude), b = bearing(lat, lon, s.attributes.latitude, s.attributes.longitude);
        // wind_bearing is where the wind comes FROM; it carries a fire toward us when it comes from the fire's side
        const toward = from != null && speed >= 3 && angDiff(+from, b) <= 45;
        return { d, b, dir: COMPASS[Math.round(b / 45) % 8], toward };
      })
      .filter(f => f.d <= this._c.near_km)
      .sort((a, b) => a.d - b.d);
  }

  _render() {
    const h = this._hass;
    if (!h || !this.shadowRoot) return;
    const $ = s => this.shadowRoot.querySelector(s);
    const rs = h.states[this._c.risk], lvl = rs ? parseInt(rs.state, 10) : NaN;
    const L = LEVELS[lvl] || null, color = L ? L.color : "#9AA0A6";
    const fires = this._fires(), close = fires.filter(f => f.d <= this._c.alert_km);
    const alarm = close.length > 0;
    const accent = alarm ? "#E0402C" : color;

    const card = $("ha-card");
    card.style.background = (lvl >= 3 || alarm)
      ? `color-mix(in srgb, ${accent} ${alarm ? 16 : 11}%, var(--ha-card-background, var(--card-background-color, #fff)))` : "";
    card.style.border = (lvl >= 3 || alarm) ? `1.5px solid color-mix(in srgb, ${accent} 45%, transparent)` : "";
    const ico = $(".ico");
    ico.style.background = `color-mix(in srgb, ${accent} 16%, transparent)`;
    ico.querySelector("ha-icon").style.color = accent;
    ico.querySelector("ha-icon").setAttribute("icon", alarm ? "mdi:fire-alert" : "mdi:fire");

    const ws = h.states[this._c.warning], wv = ws && WARN[ws.state];
    $(".title").innerHTML = L ? `fire risk <b style="color:${color}">${L.name}</b>${wv ? `<span class="warnpill" style="background:${wv}">${esc(ws.state)} weather warning</span>` : ""}`
      : `fire risk <b>unavailable</b>`;

    const near = fires.length
      ? `${fires.length} hotspot${fires.length > 1 ? "s" : ""} within ${this._c.near_km} km, nearest ${fires[0].d < 10 ? fires[0].d.toFixed(1) : Math.round(fires[0].d)} km ${fires[0].dir}`
      : `no fires detected within ${this._c.near_km} km`;
    $(".sub").textContent = `IPMA today · ${near}`;

    $(".meter").innerHTML = [1, 2, 3, 4, 5].map(i => `<i style="${L && i <= lvl ? `background:${LEVELS[i].color}` : ""}"></i>`).join("");

    const lines = [];
    if (alarm) {
      const f = close[0];
      lines.push({ icon: "mdi:fire-alert", color: "#C62828", text: `Fire detected ${f.d.toFixed(1)} km ${f.dir}${f.toward ? ", wind blowing from it toward us. Get ready to act and check official news." : ". Wind is not blowing toward us for now."}` });
    }
    if (ADVICE[lvl]) lines.push({ icon: "mdi:alert-outline", color: "var(--primary-text-color)", text: ADVICE[lvl] });
    $(".lines").innerHTML = lines.map(l => `<div class="line" style="color:${l.color}"><ha-icon icon="${l.icon}" style="color:${l.color === "var(--primary-text-color)" ? accent : l.color}"></ha-icon><span>${esc(l.text)}</span></div>`).join("");
    $(".lines").style.display = lines.length ? "" : "none";
  }
}

if (!customElements.get("corujeira-fire-card")) customElements.define("corujeira-fire-card", CorujeiraFireCard);
window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === "corujeira-fire-card"))
  window.customCards.push({ type: "corujeira-fire-card", name: "A Corujeira fire tile", description: "IPMA fire risk, warnings and nearby satellite hotspots." });
})();
