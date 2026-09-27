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
show_zones: true
# zones: [zone.home, zone.office]
# style: https://tiles.openfreemap.org/styles/positron
```

| Option | Default | Description |
| --- | --- | --- |
| `entities` | required array | Entity IDs with latitude and longitude attributes |
| `title` | empty | Card heading |
| `height` | `400px` | Pixel number or CSS length |
| `style` | [OpenFreeMap Liberty](https://tiles.openfreemap.org/styles/liberty) | MapLibre style URL |
| `center` | `[0, 0]` | Fallback longitude, latitude |
| `zoom` | `2` | Fallback zoom, also used for one marker |
| `fit_bounds` | `true` | Reframe when tracked positions change |
| `show_zones` | `false` | Display Home Assistant zone markers |
| `zones` | all zones | Limit zones to these entity IDs |

Other OpenFreeMap styles include `bright`, `positron`, and `dark`; use URLs such as `https://tiles.openfreemap.org/styles/dark`. You can also use another MapLibre-compatible style URL from a provider of your choice.

Markers follow Home Assistant state updates. An entity's `entity_picture` is shown when available; otherwise its icon is used. Clicking a marker shows the entity name and state. Entities without valid coordinates are skipped. Zone markers do not affect automatic bounds.

## Service and privacy notes

OpenFreeMap currently offers its public instance without API keys or stated request limits. It is provided as-is without an availability guarantee. Keep its attribution visible. Basemap requests go to OpenFreeMap, so the provider receives the viewed map area and normal request metadata; individual entity state and names stay in Home Assistant and are not sent by this card to OpenFreeMap. For a fully self-hosted basemap, provide your own MapLibre style and tile sources.

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
