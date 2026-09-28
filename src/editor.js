const STYLE_OPTIONS = [
  ["liberty", "Liberty"],
  ["bright", "Bright"],
  ["positron", "Positron"],
  ["dark", "Dark"],
  ["fiord", "Fiord"]
];
const DEFAULT_CUSTOM_STYLE = "https://tiles.openfreemap.org/styles/liberty";

class HaOpenFreeMapCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(value) {
    const first = !this._hass;
    this._hass = value;
    if (first && this._config) this._render();
    else this.shadowRoot.querySelectorAll("ha-entity-picker").forEach((picker) => { picker.hass = value; });
  }

  _emit(patch) {
    this._config = { ...this._config, ...patch };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config }, bubbles: true, composed: true
    }));
  }

  _row(labelText, description) {
    const row = document.createElement("label");
    row.className = "row";
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = labelText;
    row.appendChild(label);
    if (description) {
      const hint = document.createElement("small");
      hint.textContent = description;
      row.appendChild(hint);
    }
    this.shadowRoot.querySelector(".fields").appendChild(row);
    return row;
  }

  _entityId(entry) {
    return typeof entry === "string" ? entry : entry?.entity;
  }

  _entityPicker(value, excluded, onChange, label) {
    if (customElements.get("ha-entity-picker")) {
      const picker = document.createElement("ha-entity-picker");
      picker.hass = this._hass;
      picker.value = value;
      picker.label = label;
      picker.excludeEntities = excluded;
      picker.addEventListener("value-changed", (event) => {
        event.stopPropagation();
        if (event.detail?.value) onChange(event.detail.value);
      });
      return picker;
    }
    const picker = document.createElement("select");
    picker.setAttribute("aria-label", label);
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = label;
    picker.appendChild(empty);
    const ids = new Set([...Object.keys(this._hass?.states || {}), ...(value ? [value] : [])]);
    for (const id of [...ids].sort()) {
      if (excluded.includes(id)) continue;
      const option = document.createElement("option");
      option.value = id;
      const name = this._hass?.states?.[id]?.attributes?.friendly_name;
      option.textContent = name && name !== id ? name + " (" + id + ")" : id;
      picker.appendChild(option);
    }
    picker.value = value || "";
    picker.addEventListener("change", () => { if (picker.value) onChange(picker.value); });
    return picker;
  }

  _entities() {
    const section = document.createElement("section");
    section.className = "entity-section";
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = "Entities";
    const hint = document.createElement("small");
    hint.textContent = "Choose entities with latitude and longitude attributes.";
    const list = document.createElement("div");
    list.className = "entity-list";
    const entries = this._config.entities || [];
    const ids = entries.map((entry) => this._entityId(entry));
    entries.forEach((entry, index) => {
      const id = this._entityId(entry);
      const item = document.createElement("div");
      item.className = "entity-item";
      if (this._editingIndex === index) {
        const picker = this._entityPicker(id, ids.filter((_, other) => other !== index), (next) => {
          const updated = [...this._config.entities];
          updated[index] = typeof entry === "string" ? next : { ...entry, entity: next };
          this._editingIndex = undefined;
          this._emit({ entities: updated });
          this._render();
        }, "Change entity");
        picker.classList.add("entity-picker");
        item.appendChild(picker);
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", () => { this._editingIndex = undefined; this._render(); });
        item.appendChild(cancel);
      } else {
        const meta = document.createElement("div");
        meta.className = "entity-meta";
        const name = document.createElement("span");
        name.textContent = this._hass?.states?.[id]?.attributes?.friendly_name || id;
        const entityId = document.createElement("small");
        entityId.textContent = id;
        meta.append(name, entityId);
        item.appendChild(meta);
        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "Edit";
        edit.setAttribute("aria-label", "Edit " + id);
        edit.addEventListener("click", () => { this._editingIndex = index; this._render(); });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Delete";
        remove.setAttribute("aria-label", "Delete " + id);
        remove.addEventListener("click", () => {
          const updated = [...this._config.entities];
          updated.splice(index, 1);
          this._editingIndex = undefined;
          this._emit({ entities: updated });
          this._render();
        });
        item.append(edit, remove);
      }
      list.appendChild(item);
    });
    const add = this._entityPicker(undefined, ids, (id) => {
      this._emit({ entities: [...entries, id] });
      this._render();
    }, "Add entity");
    add.classList.add("entity-picker");
    section.append(label, hint, list, add);
    this.shadowRoot.querySelector(".fields").appendChild(section);
  }

  _text(label, key, value, description, multiline = false) {
    const row = this._row(label, description);
    const field = document.createElement(multiline ? "textarea" : "input");
    if (!multiline) field.type = "text";
    if (multiline) field.rows = 3;
    field.value = value ?? "";
    field.addEventListener("change", () => {
      let next = multiline
        ? field.value.split(/[\n,]+/).map((part) => part.trim()).filter(Boolean)
        : field.value.trim();
      if (key === "height" && /^\d+$/.test(next)) next = Number(next);
      this._emit({ [key]: next });
    });
    row.appendChild(field);
  }

  _number(label, value, min, max, step, onChange, description) {
    const row = this._row(label, description);
    const field = document.createElement("input");
    field.type = "number";
    field.min = String(min);
    field.max = String(max);
    field.step = String(step);
    field.value = String(value);
    field.addEventListener("change", () => {
      if (field.validity.valid && field.value !== "") onChange(Number(field.value));
    });
    row.appendChild(field);
  }

  _check(label, key, value, description) {
    const row = this._row(label, description);
    row.classList.add("check");
    const field = document.createElement("input");
    field.type = "checkbox";
    field.checked = Boolean(value);
    field.addEventListener("change", () => {
      this._emit({ [key]: field.checked });
      if (key === "show_zones") this._render();
    });
    row.insertBefore(field, row.firstChild);
  }

  _style(label, key, value, allowAuto = false) {
    const row = this._row(label);
    const presets = [...(allowAuto ? [["auto", "Automatic (HA theme)"]] : []), ...STYLE_OPTIONS];
    const selected = presets.some(([id]) => id === value) ? value : "custom";
    const select = document.createElement("select");
    for (const [id, name] of [...presets, ["custom", "Custom style URL"]]) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = name;
      select.appendChild(option);
    }
    select.value = selected;
    select.addEventListener("change", () => {
      this._emit({ [key]: select.value === "custom" ? DEFAULT_CUSTOM_STYLE : select.value });
      this._render();
    });
    row.appendChild(select);
    if (selected === "custom") {
      const input = document.createElement("input");
      input.type = "url";
      input.value = value ?? DEFAULT_CUSTOM_STYLE;
      input.placeholder = "https://example.com/style.json";
      input.addEventListener("change", () => {
        if (input.validity.valid && input.value) this._emit({ [key]: input.value.trim() });
      });
      row.appendChild(input);
    }
  }

  _render() {
    if (!this._config) return;
    this.shadowRoot.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = [
      ":host{display:block;color:var(--primary-text-color)}",
      ".fields{display:grid;gap:16px;padding:8px 0 16px}",
      ".row{display:grid;gap:5px;font-size:14px}",
      ".label{font-weight:500}",
      "small{color:var(--secondary-text-color);font-size:12px}",
      "input:not([type=checkbox]),select,textarea{box-sizing:border-box;width:100%;padding:9px;border:1px solid var(--divider-color,#aaa);border-radius:6px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#222);font:inherit}",
      "textarea{resize:vertical}",
      ".check{grid-template-columns:auto 1fr;align-items:center;column-gap:10px}",
      ".check small{grid-column:2}",
      ".entity-section{display:grid;gap:7px}",
      ".entity-list{display:grid;gap:6px}",
      ".entity-item{display:flex;align-items:center;gap:6px;padding:8px;border:1px solid var(--divider-color,#aaa);border-radius:6px}",
      ".entity-meta{display:grid;gap:2px;min-width:0;flex:1;overflow-wrap:anywhere}",
      ".entity-picker{flex:1;min-width:0}",
      "button{padding:6px 8px;border:1px solid var(--divider-color,#aaa);border-radius:5px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#222);cursor:pointer}",
      "button:hover{background:var(--secondary-background-color,#eee)}"
    ].join("");
    const fields = document.createElement("div");
    fields.className = "fields";
    this.shadowRoot.append(style, fields);

    const config = this._config;
    this._entities();
    this._text("Title", "title", config.title || "");
    this._text("Height", "height", config.height || "400px", "For example: 400px or 50vh");
    this._style("Map style", "style", config.style || "auto", true);
    if (!config.style || config.style === "auto") {
      this._style("Light style", "light_style", config.light_style || "liberty");
      this._style("Dark style", "dark_style", config.dark_style || "dark");
    }
    this._check("Compact attribution", "compact_attribution",
      config.compact_attribution !== false, "The attribution expands when clicked.");
    this._check("Fit map to entities", "fit_bounds",
      config.fit_bounds !== false, "When enabled, center and zoom are used as fallbacks.");
    const center = Array.isArray(config.center) ? config.center : [0, 0];
    this._number("Fallback longitude", center[0], -180, 180, 0.000001,
      (value) => this._emit({ center: [value, Number(this._config.center?.[1] ?? 0)] }));
    this._number("Fallback latitude", center[1], -90, 90, 0.000001,
      (value) => this._emit({ center: [Number(this._config.center?.[0] ?? 0), value] }));
    this._number("Fallback zoom", config.zoom ?? 2, 0, 22, 0.5,
      (value) => this._emit({ zoom: value }));
    this._check("Show Home Assistant zones", "show_zones", config.show_zones === true);
    if (config.show_zones) {
      this._text("Zones", "zones", (config.zones || []).join("\n"),
        "Optional zone IDs, one per line. Empty shows all zones.", true);
    }
  }
}

if (!customElements.get("ha-openfreemap-card-editor")) {
  customElements.define("ha-openfreemap-card-editor", HaOpenFreeMapCardEditor);
}
