import * as maplibregl from "maplibre-gl";
import sdkCss from "maplibre-gl/dist/maplibre-gl.css";

const CARD_VERSION = "0.1.0";
const DEFAULT_CENTER = [0, 0];
const DEFAULT_ZOOM = 2;
const DEFAULT_STYLE = "https://tiles.openfreemap.org/styles/liberty";
maplibregl.setWorkerUrl(new URL("./maplibre-gl-worker.mjs", import.meta.url).href);

function coordinates(attributes) {
  const lat = Number(attributes?.latitude);
  const lon = Number(attributes?.longitude);
  return Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180
    ? [lon, lat] : null;
}

function safeUrl(url) {
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url, window.location.origin);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}

function markerElement(state, hass) {
  const marker = document.createElement("div");
  marker.className = "ha-openfreemap-marker";
  const picture = safeUrl(state.attributes.entity_picture);
  if (picture) {
    const image = document.createElement("img");
    image.src = picture;
    image.alt = "";
    marker.appendChild(image);
  } else {
    const icon = document.createElement("ha-icon");
    icon.setAttribute("icon", state.attributes.icon || hass.entities?.[state.entity_id]?.icon || "mdi:map-marker");
    marker.appendChild(icon);
  }
  return marker;
}

function popupElement(state, hass) {
  const content = document.createElement("div");
  content.className = "ha-openfreemap-popup";
  const name = document.createElement("strong");
  name.textContent = state.attributes.friendly_name || hass.entities?.[state.entity_id]?.name || state.entity_id;
  const status = document.createElement("span");
  status.textContent = state.state;
  content.append(name, status);
  return content;
}

class HaOpenFreeMapCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._markers = new Map();
    this._zones = new Map();
  }

  static getStubConfig() {
    return { type: "custom:ha-openfreemap-card", entities: [], title: "Map", show_zones: false };
  }

  setConfig(config) {
    if (!Array.isArray(config.entities)) throw new Error("OpenFreeMap Card requires an entities array");
    this._config = {
      title: "", height: "400px", style: DEFAULT_STYLE, center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM, fit_bounds: true, show_zones: false, zones: [], ...config
    };
    const height = this._config.height;
    if (!(typeof height === "number" && height >= 100) && !(typeof height === "string" && /^\d+(px|vh|rem|em|%)$/.test(height))) {
      throw new Error("height must be a number (pixels) or a CSS length such as 400px");
    }
    this._renderShell();
    this._destroyMap();
    if (this.isConnected) this._initMap();
  }

  set hass(value) {
    this._hass = value;
    this._sync();
  }

  getCardSize() { return Math.max(3, Math.ceil((Number.parseInt(this._config?.height, 10) || 400) / 50)); }

  connectedCallback() { if (this._config && !this._map) this._initMap(); }
  disconnectedCallback() { this._destroyMap(); }

  _renderShell() {
    const height = typeof this._config.height === "number" ? `${this._config.height}px` : this._config.height;
    this.shadowRoot.innerHTML = `
      <style id="maplibre-sdk-style"></style>
      <style>
        :host { display:block; } ha-card { overflow:hidden; }
        .title { padding:16px 16px 0; font-size:var(--ha-card-header-font-size,24px); color:var(--primary-text-color); }
        #map { height:var(--map-height); min-height:100px; width:100%; background:var(--secondary-background-color,#eee); }
        .error { padding:12px 16px; color:var(--error-color,#db4437); }
        .ha-openfreemap-marker { box-sizing:border-box; width:38px; height:38px; border:2px solid var(--primary-color,#03a9f4); border-radius:50%; background:var(--card-background-color,#fff); color:var(--primary-color,#03a9f4); box-shadow:0 2px 6px #0005; display:grid; place-items:center; overflow:hidden; cursor:pointer; }
        .ha-openfreemap-marker img { width:100%; height:100%; object-fit:cover; }
        .ha-openfreemap-marker ha-icon { --mdc-icon-size:24px; }
        .ha-openfreemap-popup { color:#222; display:grid; gap:3px; min-width:110px; }
        .ha-openfreemap-popup span { overflow-wrap:anywhere; }
        .ha-openfreemap-zone { width:15px; height:15px; border-radius:50%; background:#4285f4; border:2px solid white; box-shadow:0 0 0 2px #4285f4; }
      </style>
      <ha-card style="--map-height:${height}">
        ${this._config.title ? '<div class="title"></div>' : ""}
        <div id="map"></div><div class="error" hidden></div>
      </ha-card>`;
    this.shadowRoot.querySelector("#maplibre-sdk-style").textContent = sdkCss;
    const title = this.shadowRoot.querySelector(".title");
    if (title) title.textContent = this._config.title;
  }

  _initMap() {
    if (this._map || !this.shadowRoot.querySelector("#map")) return;
    const center = Array.isArray(this._config.center) && this._config.center.length === 2
      ? this._config.center.map(Number) : DEFAULT_CENTER;
    try {
      this._map = new maplibregl.Map({
        container: this.shadowRoot.querySelector("#map"),
        style: this._config.style, center, zoom: Number(this._config.zoom) || DEFAULT_ZOOM
      });
      this._map.on("error", (event) => this._showError(event.error?.message || "Map failed to load"));
      this._map.on("load", () => this._sync());
      this._sync();
    } catch (error) { this._showError(error.message); }
  }

  _showError(message) {
    const element = this.shadowRoot.querySelector(".error");
    if (element) { element.hidden = false; element.textContent = message; }
  }

  _sync() {
    if (!this._map || !this._hass || !this._config) return;
    const bounds = new maplibregl.LngLatBounds();
    const seen = new Set();
    for (const entry of this._config.entities) {
      const entityId = typeof entry === "string" ? entry : entry?.entity;
      const state = this._hass.states[entityId];
      const point = coordinates(state?.attributes);
      if (!point) continue;
      seen.add(entityId);
      bounds.extend(point);
      const fingerprint = JSON.stringify([point, state.state, state.attributes.friendly_name, state.attributes.entity_picture, state.attributes.icon]);
      const previous = this._markers.get(entityId);
      if (previous?.fingerprint === fingerprint) continue;
      previous?.marker.remove();
      const marker = new maplibregl.Marker({ element: markerElement(state, this._hass), anchor: "bottom" })
        .setLngLat(point).setPopup(new maplibregl.Popup({ offset: 20 }).setDOMContent(popupElement(state, this._hass)))
        .addTo(this._map);
      this._markers.set(entityId, { marker, fingerprint });
    }
    for (const [id, item] of this._markers) if (!seen.has(id)) { item.marker.remove(); this._markers.delete(id); }
    this._syncZones();
    const signature = JSON.stringify([...seen].map((id) => this._markers.get(id)?.marker.getLngLat().toArray()));
    if (this._config.fit_bounds && signature !== this._boundsSignature) {
      this._boundsSignature = signature;
      if (seen.size > 1) this._map.fitBounds(bounds, { padding: 45, maxZoom: 15, duration: 350 });
      else if (seen.size === 1) this._map.easeTo({ center: bounds.getCenter(), zoom: Math.min(Number(this._config.zoom) || 13, 15), duration: 350 });
      else this._map.easeTo({ center: this._config.center, zoom: Number(this._config.zoom) || DEFAULT_ZOOM, duration: 350 });
    }
  }

  _syncZones() {
    const ids = this._config.show_zones
      ? (this._config.zones.length ? this._config.zones : Object.keys(this._hass.states).filter((id) => id.startsWith("zone."))) : [];
    const seen = new Set();
    for (const id of ids) {
      const state = this._hass.states[id];
      const point = coordinates(state?.attributes);
      if (!point) continue;
      seen.add(id);
      const fingerprint = JSON.stringify([point, state.attributes.friendly_name]);
      if (this._zones.get(id)?.fingerprint === fingerprint) continue;
      this._zones.get(id)?.marker.remove();
      const element = document.createElement("div");
      element.className = "ha-openfreemap-zone";
      const marker = new maplibregl.Marker({ element }).setLngLat(point)
        .setPopup(new maplibregl.Popup({ offset: 12 }).setDOMContent(popupElement(state, this._hass))).addTo(this._map);
      this._zones.set(id, { marker, fingerprint });
    }
    for (const [id, item] of this._zones) if (!seen.has(id)) { item.marker.remove(); this._zones.delete(id); }
  }

  _destroyMap() {
    for (const item of this._markers.values()) item.marker.remove();
    for (const item of this._zones.values()) item.marker.remove();
    this._markers.clear(); this._zones.clear();
    this._map?.remove(); this._map = null; this._boundsSignature = null;
  }
}

if (!customElements.get("ha-openfreemap-card")) customElements.define("ha-openfreemap-card", HaOpenFreeMapCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: "ha-openfreemap-card", name: "OpenFreeMap Card", description: "Map Home Assistant entities with MapLibre and OpenFreeMap", version: CARD_VERSION });
