/* A Corujeira span pills: wraps any card and overlays a row of range pills (from an input_select) in its top-right corner. Remove this resource to revert. */
(() => {
class CorujeiraSpanCard extends HTMLElement {
  setConfig(c) {
    if (!c || !c.entity || !c.card) throw new Error("corujeira-span-card: entity and card are required");
    this._c = { top: 12, right: 12, color: "#3D9BC9", ...c };
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const r = this.shadowRoot;
    r.innerHTML = `
      <style>
        :host { display:block; }
        .wrap { position:relative; height:100%; }
        .pills { position:absolute; top:${this._c.top}px; right:${this._c.right}px; z-index:2; display:flex; gap:4px; }
        button { all:unset; box-sizing:border-box; cursor:pointer; font-family:'Lato',sans-serif; font-size:13px; font-weight:700; line-height:1;
          padding:6px 10px; border-radius:999px; color:var(--secondary-text-color);
          background:color-mix(in srgb, var(--primary-text-color) 7%, transparent);
          transition:background .15s, color .15s, transform .1s; -webkit-tap-highlight-color:transparent; }
        @media (hover:hover) { button:not(.on):hover { background:color-mix(in srgb, var(--primary-text-color) 13%, transparent); } }
        button:active { transform:scale(.94); }
        button:focus-visible { outline:2px solid ${this._c.color}; outline-offset:1px; }
        button.on { background:${this._c.color}; color:#fff; box-shadow:0 1px 3px rgba(0,0,0,.15); cursor:default; }
      </style>
      <div class="wrap"><div class="pills"></div><div class="inner"></div></div>`;
    this._pills = r.querySelector(".pills");
    this._opts = null;
    this._card = null;
    const make = async () => {
      const h = await window.loadCardHelpers();
      const el = h.createCardElement(this._c.card);
      el.addEventListener("ll-rebuild", e => { e.stopPropagation(); make(); });
      if (this._hass) el.hass = this._hass;
      const inner = r.querySelector(".inner");
      inner.innerHTML = "";
      inner.appendChild(el);
      this._card = el;
    };
    make();
  }
  set hass(h) {
    this._hass = h;
    if (this._card) this._card.hass = h;
    this._render();
  }
  _render() {
    const s = this._hass && this._hass.states[this._c.entity];
    if (!s) return;
    const opts = this._c.options || s.attributes.options || [];
    if (JSON.stringify(opts) !== this._opts) {
      this._opts = JSON.stringify(opts);
      this._pills.innerHTML = "";
      opts.forEach(o => {
        const b = document.createElement("button");
        b.textContent = o;
        b.dataset.o = o;
        b.addEventListener("click", e => {
          e.stopPropagation();
          if (this._hass.states[this._c.entity].state === o) return;
          this._hass.callService(this._c.entity.split(".")[0], "select_option", { entity_id: this._c.entity, option: o });
        });
        this._pills.appendChild(b);
      });
    }
    this._pills.querySelectorAll("button").forEach(b => {
      const on = b.dataset.o === s.state;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on);
    });
  }
  getCardSize() { return this._card && this._card.getCardSize ? this._card.getCardSize() : 5; }
  getGridOptions() { return { columns: 12, rows: "auto" }; }
}
if (!customElements.get("corujeira-span-card")) customElements.define("corujeira-span-card", CorujeiraSpanCard);
window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === "corujeira-span-card"))
  window.customCards.push({ type: "corujeira-span-card", name: "A Corujeira span pills", description: "Wraps a card with range pills in the top-right corner." });
})();
