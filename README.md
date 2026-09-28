# OpenFreeMap Card for Home Assistant

A Lovelace map card for Home Assistant entities with `latitude` and `longitude` attributes. It uses MapLibre GL JS and OpenFreeMap's hosted OpenStreetMap basemap by default. No API key is needed.

## Install with HACS

Add this GitHub repository URL under **HACS → Custom repositories → Dashboard** (called **Frontend** in some HACS versions), then install OpenFreeMap Card. If HACS does not add the dashboard resource automatically, add:

```yaml
url: /hacsfiles/ha-openfreemap-card/ha-openfreemap-card.js
type: module
```

For manual installation, copy **all three files** from `dist/` to `<config>/www/ha-openfreemap-card/`, then add `/local/ha-openfreemap-card/ha-openfreemap-card.js` as a module resource. The MapLibre worker and shared module must remain beside the card file. Refresh the dashboard after installing or upgrading.

## Configure

Add the card in the dashboard editor to use its graphical settings. Choose an entity from the dropdown, then edit or delete it from the selected list. The editor also offers styles, center, zoom, attribution, and zones. YAML configuration remains available:

```yaml
type: custom:ha-openfreemap-card
title: Family map
height: 420px
entities:
  - person.alex
  - device_tracker.car
center: [103.8198, 1.3521] # longitude, latitude
zoom: 10
fit_bounds: true
style: auto # follows the active Home Assistant light/dark theme
light_style: liberty
dark_style: dark
compact_attribution: true
show_zones: true
# zones: [zone.home, zone.office]
```

| Option | Default | Description |
| --- | --- | --- |
| `entities` | required array | Entity IDs with latitude and longitude attributes |
| `title` | empty | Card heading |
| `height` | `400px` | Pixel number or CSS length |
| `style` | `auto` | `auto`, OpenFreeMap style name, or MapLibre style URL |
| `light_style` | `liberty` | Style used when HA is in light mode and `style: auto` |
| `dark_style` | `dark` | Style used when HA is in dark mode and `style: auto` |
| `compact_attribution` | `true` | Compact expandable map attribution |
| `center` | `[0, 0]` | Fallback longitude, latitude |
| `zoom` | `2` | Fallback zoom, also used for one marker |
| `fit_bounds` | `true` | Reframe when tracked positions change |
| `show_zones` | `false` | Display Home Assistant zone markers |
| `zones` | all zones | Limit zones to these entity IDs |

OpenFreeMap style names are `liberty`, `bright`, `positron`, `dark`, and `fiord`. A full HTTP(S) URL to another MapLibre-compatible style also works. With `style: auto`, the card follows `hass.themes.darkMode` and switches live. The attribution control stays available and expands when clicked. When `fit_bounds: true`, center and zoom are fallbacks; disable it to keep your chosen initial view.

Markers follow Home Assistant state updates. An entity's `entity_picture` is shown when available; otherwise its icon is used. Clicking a marker shows the entity name and state. Entities without valid coordinates are skipped. Zone markers do not affect automatic bounds. On card load, the map starts at the calculated entity bounds without a camera animation; later position updates still reframe smoothly.

## Service and privacy notes

OpenFreeMap currently offers its public instance without API keys or stated request limits. It is provided as-is without an availability guarantee. Keep the attribution control available; click it to read the full credits. Basemap requests go to OpenFreeMap, so the provider receives the viewed map area and normal request metadata; individual entity state and names stay in Home Assistant and are not sent by this card to OpenFreeMap. For a fully self-hosted basemap, provide your own MapLibre style and tile sources.

MapLibre GL JS v6 requires WebGL2, so older tablets or browsers without WebGL2 may not display the map. Home Assistant 2024.12 or newer is the intended compatibility baseline.

## Build

Requires Node.js 20 or newer.

```sh
npm ci
npm run lint
npm run build
```

Commit the generated `dist/` files when releasing. HACS installs the files in that directory.

## License

MIT. MapLibre GL JS and its dependencies retain their own licenses.
