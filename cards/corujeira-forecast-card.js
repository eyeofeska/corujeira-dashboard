/* A Corujeira forecast card: the next 12 hours (2-hourly) above a 5-day forecast, in one compact tile.
   Fills whatever height the grid gives it. Tap opens `navigate` (e.g. "#weather") if set, else the weather entity.
   Remove this resource to revert. */
(() => {
const ICON = { "clear-night": "mdi:weather-night", cloudy: "mdi:weather-cloudy", exceptional: "mdi:alert-circle-outline", fog: "mdi:weather-fog",
  hail: "mdi:weather-hail", lightning: "mdi:weather-lightning", "lightning-rainy": "mdi:weather-lightning-rainy", partlycloudy: "mdi:weather-partly-cloudy",
  pouring: "mdi:weather-pouring", rainy: "mdi:weather-rainy", snowy: "mdi:weather-snowy", "snowy-rainy": "mdi:weather-snowy-rainy",
  sunny: "mdi:weather-sunny", windy: "mdi:weather-windy", "windy-variant": "mdi:weather-windy-variant" };
const COLOR = { sunny: "#E9A92C", "clear-night": "#7C88A6", partlycloudy: "#C9A24D", cloudy: "#9AA5B1", fog: "#A0A7AE", hail: "#8FB8D6",
  rainy: "#4A9FD0", pouring: "#3F86B8", lightning: "#8E6BBF", "lightning-rainy": "#8E6BBF", snowy: "#8FB8D6", "snowy-rainy": "#8FB8D6",
  windy: "#7F8C99", "windy-variant": "#7F8C99", exceptional: "#D9573F" };
const NIGHT_COLOR = "#7C88A6";
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

class CorujeiraForecastCard extends HTMLElement {
  setConfig(c) {
    if (!c || !c.entity) throw new Error("corujeira-forecast-card: entity is required");
    this._c = { hours: 12, step: 2, days: 5, ...c };
    this._fc = {};
    this._key = null;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._built = false;
    this._unsubscribe();
  }
  getCardSize() { return 3; }
  getGridOptions() { return { columns: 12, rows: 3, min_rows: 2 }; }

  set hass(h) {
    this._hass = h;
    if (!this._built) this._build();
    if (!this._subs && this.isConnected) this._subscribe();
    const s = h.states[this._c.entity];
    const key = (s ? s.last_updated : "") + "|" + Math.floor(Date.now() / 600000);
    if (key !== this._key) { this._key = key; this._render(); }
  }
  connectedCallback() { if (this._hass && !this._subs) this._subscribe(); }
  disconnectedCallback() { this._unsubscribe(); }

  _subscribe() {
    const conn = this._hass && this._hass.connection;
    if (!conn) return;
    this._subs = ["hourly", "daily"].map(t => conn.subscribeMessage(m => {
      this._fc[t] = (m && m.forecast) || [];
      this._render();
    }, { type: "weather/subscribe_forecast", forecast_type: t, entity_id: this._c.entity }).catch(() => {}));
  }
  _unsubscribe() {
    (this._subs || []).forEach(p => Promise.resolve(p).then(u => typeof u === "function" && u()).catch(() => {}));
    this._subs = null;
  }

  _build() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; height:100%; }
        ha-card { height:100%; box-sizing:border-box; padding:8px 10px; display:flex; flex-direction:column; justify-content:space-evenly;
          font-family:'Lato',sans-serif; cursor:pointer; overflow:hidden; -webkit-tap-highlight-color:transparent; }
        .row { display:grid; text-align:center; align-items:start; }
        .slot { display:flex; flex-direction:column; align-items:center; gap:1px; min-width:0; }
        .lbl { font-size:11.5px; line-height:1.2; color:var(--secondary-text-color); white-space:nowrap; }
        .lbl.now { color:var(--primary-text-color); font-weight:700; }
        .day .lbl { font-size:12.5px; font-weight:700; }
        ha-icon { --mdc-icon-size:21px; margin:1px 0; }
        .day ha-icon { --mdc-icon-size:25px; }
        .tmp { font-size:14px; line-height:1.2; color:var(--primary-text-color); white-space:nowrap; }
        .lo { color:var(--secondary-text-color); font-size:12.5px; margin-left:4px; }
        .rain { font-size:10.5px; line-height:1.2; color:#4A9FD0; min-height:12px; white-space:nowrap; }
        .rule { height:1px; background:rgba(52,58,64,0.15); margin:0 4px; flex:none; }
        .empty { text-align:center; color:var(--secondary-text-color); font-size:13px; }
      </style>
      <ha-card><div class="empty">Loading forecast…</div></ha-card>`;
    this.shadowRoot.querySelector("ha-card").addEventListener("click", () => {
      const path = this._c.navigate;
      if (path) {
        history.pushState(null, "", path.startsWith("#") ? location.pathname + location.search + path : path);
        window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
        return;
      }
      this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: this._c.entity } }));
    });
    this._built = true;
  }

  // Sunrise and sunset as minutes of the day, from sun.sun; falls back to 07:00 / 19:00.
  _sunWindow() {
    const s = this._hass && this._hass.states["sun.sun"];
    const mins = iso => { const d = new Date(iso); return isNaN(d) ? null : d.getHours() * 60 + d.getMinutes(); };
    const rise = s && mins(s.attributes.next_rising), set = s && mins(s.attributes.next_setting);
    return [rise ?? 420, set ?? 1140];
  }
  _icon(cond, night) {
    if (night && cond === "partlycloudy") return ["mdi:weather-night-partly-cloudy", NIGHT_COLOR];
    if (!night && cond === "clear-night") cond = "sunny";
    return [ICON[cond] || "mdi:weather-cloudy", COLOR[cond] || "#9AA5B1"];
  }
  _mm(p) { return p >= 1 ? Math.round(p) + " mm" : p >= 0.1 ? p.toFixed(1) + " mm" : ""; }

  _render() {
    if (!this._built || !this._hass) return;
    const card = this.shadowRoot.querySelector("ha-card");
    const hourly = this._fc.hourly, daily = this._fc.daily;
    if (!hourly && !daily) return;
    const now = Date.now(), lang = (this._hass.locale && this._hass.locale.language) || this._hass.language || "en";
    const [rise, set] = this._sunWindow();
    let html = "";

    if (hourly && hourly.length) {
      const upcoming = hourly.filter(f => new Date(f.datetime).getTime() > now - 3600e3);
      const n = Math.floor(this._c.hours / this._c.step) + 1;
      const slots = [];
      for (let i = 0; i < upcoming.length && slots.length < n; i += this._c.step) slots.push(upcoming[i]);
      const anyRain = slots.some(f => (f.precipitation || 0) >= 0.1);
      html += `<div class="row" style="grid-template-columns:repeat(${slots.length},1fr)">` + slots.map((f, i) => {
        const d = new Date(f.datetime), m = d.getHours() * 60 + d.getMinutes();
        const isNow = i === 0 && d.getTime() <= now + 1800e3;
        const [ic, col] = this._icon(f.condition, m < rise || m >= set);
        return `<div class="slot">
          <div class="lbl${isNow ? " now" : ""}">${isNow ? "Now" : String(d.getHours()).padStart(2, "0")}</div>
          <ha-icon icon="${ic}" style="color:${col}"></ha-icon>
          <div class="tmp">${Math.round(f.temperature)}°</div>
          ${anyRain ? `<div class="rain">${this._mm(f.precipitation || 0)}</div>` : ""}
        </div>`;
      }).join("") + `</div>`;
    }

    if (daily && daily.length) {
      if (html) html += `<div class="rule"></div>`;
      const today = new Date().toDateString();
      const days = daily.slice(0, this._c.days);
      const anyRain = days.some(f => (f.precipitation || 0) >= 0.5);
      html += `<div class="row" style="grid-template-columns:repeat(${days.length},1fr)">` + days.map(f => {
        const d = new Date(f.datetime);
        const label = d.toDateString() === today ? "Today" : d.toLocaleDateString(lang, { weekday: "short" });
        const [ic, col] = this._icon(f.condition, false);
        const lo = f.templow != null ? `<span class="lo">${Math.round(f.templow)}°</span>` : "";
        return `<div class="slot day">
          <div class="lbl">${esc(label)}</div>
          <ha-icon icon="${ic}" style="color:${col}"></ha-icon>
          <div class="tmp">${Math.round(f.temperature)}°${lo}</div>
          ${anyRain ? `<div class="rain">${(f.precipitation || 0) >= 0.5 ? this._mm(f.precipitation) : ""}</div>` : ""}
        </div>`;
      }).join("") + `</div>`;
    }
    card.innerHTML = html || `<div class="empty">No forecast available</div>`;
  }
}

if (!customElements.get("corujeira-forecast-card")) customElements.define("corujeira-forecast-card", CorujeiraForecastCard);
window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === "corujeira-forecast-card"))
  window.customCards.push({ type: "corujeira-forecast-card", name: "A Corujeira forecast", description: "Next 12 hours above a 5-day forecast, in one compact tile." });
})();
