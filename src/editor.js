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
    this._pickerCount = 0;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(value) {
    const first = !this._hass;
    this._hass = value;
    if (first && this._config) this._render();
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
    const wrapper = document.createElement("div");
    wrapper.className = "entity-combobox";
    const input = document.createElement("input");
    input.type = "text";
    input.value = value || "";
    input.placeholder = label;
    input.autocomplete = "off";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-label", label);
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    const menu = document.createElement("div");
    menu.className = "entity-options";
    menu.id = `entity-options-${++this._pickerCount}`;
    menu.setAttribute("role", "listbox");
    menu.hidden = true;
    input.setAttribute("aria-controls", menu.id);
    wrapper.append(input, menu);
    let matches = [];
    let active = 0;
    let query = "";

    const choices = () => {
      const states = this._hass?.states || {};
      const ids = new Set([...Object.keys(states), ...(value ? [value] : [])]);
      return [...ids].filter((id) => !excluded.includes(id)).map((id) => {
        const attributes = states[id]?.attributes;
        const latitude = attributes?.latitude;
        const longitude = attributes?.longitude;
        const location = latitude != null && longitude != null && latitude !== "" && longitude !== "" &&
          Number.isFinite(Number(latitude)) && Math.abs(Number(latitude)) <= 90 &&
          Number.isFinite(Number(longitude)) && Math.abs(Number(longitude)) <= 180;
        return { id, name: String(attributes?.friendly_name || id), location };
      }).sort((a, b) => Number(b.location) - Number(a.location) ||
        a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    };
    const close = () => {
      input.value = value || "";
      menu.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    };
    const choose = (id) => { close(); onChange(id); };
    const show = () => {
      matches = choices().filter(({ id, name }) =>
        id.toLowerCase().includes(query) || name.toLowerCase().includes(query)).slice(0, 60);
      active = Math.min(active, Math.max(matches.length - 1, 0));
      menu.replaceChildren();
      if (!matches.length) {
        const empty = document.createElement("div");
        empty.className = "entity-empty";
        empty.textContent = "No matching entities";
        menu.appendChild(empty);
      }
      matches.forEach(({ id, name, location }, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.id = `${menu.id}-${index}`;
        option.className = "entity-option";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(index === active));
        option.tabIndex = -1;
        const title = document.createElement("span");
        title.textContent = name;
        const detail = document.createElement("small");
        detail.textContent = id;
        option.append(title, detail);
        if (location) {
          const badge = document.createElement("small");
          badge.className = "location-badge";
          badge.textContent = "Location";
          option.appendChild(badge);
        }
        option.addEventListener("pointerdown", (event) => event.preventDefault());
        option.addEventListener("click", () => choose(id));
        menu.appendChild(option);
      });
      menu.hidden = false;
      input.setAttribute("aria-expanded", "true");
      if (matches.length) input.setAttribute("aria-activedescendant", `${menu.id}-${active}`);
      else input.removeAttribute("aria-activedescendant");
    };
    input.addEventListener("focus", () => { query = ""; active = 0; input.select(); show(); });
    input.addEventListener("input", () => { query = input.value.trim().toLowerCase(); active = 0; show(); });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { close(); return; }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (menu.hidden) show();
        else if (matches.length) {
          active = (active + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
          show();
          menu.querySelector(`#${menu.id}-${active}`)?.scrollIntoView({ block: "nearest" });
        }
      } else if (event.key === "Enter" && !menu.hidden && matches.length) {
        event.preventDefault();
        choose(matches[active].id);
      }
    });
    wrapper.addEventListener("focusout", (event) => {
      if (!wrapper.contains(event.relatedTarget)) close();
    });
    return wrapper;
  }

  _entities() {
    const section = document.createElement("section");
    section.className = "entity-section";
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = "Entities";
    const hint = document.createElement("small");
    hint.textContent = "Search by name or ID. Entities with coordinates appear first; all entities remain available.";
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
      ".entity-combobox{position:relative}",
      ".entity-options{position:absolute;z-index:10;top:100%;left:0;right:0;max-height:260px;overflow:auto;background:var(--card-background-color,#fff);border:1px solid var(--divider-color,#aaa);border-radius:6px;box-shadow:0 5px 16px #0003}",
      ".entity-options[hidden]{display:none}",
      ".entity-option{display:grid;grid-template-columns:1fr auto;gap:2px 8px;width:100%;text-align:left;border:0;border-radius:0;box-shadow:none}",
      ".entity-option small{grid-column:1;overflow-wrap:anywhere}",
      ".entity-option .location-badge{grid-column:2;grid-row:1 / 3;align-self:center}",
      ".entity-option[aria-selected=true]{background:var(--secondary-background-color,#eee)}",
      ".entity-empty{padding:10px;color:var(--secondary-text-color)}",
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
