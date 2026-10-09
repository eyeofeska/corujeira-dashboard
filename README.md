# A Corujeira dashboard

Custom Lovelace cards for the Home Assistant dashboard at A Corujeira, an off-grid land in the Minho Valley, Portugal. Each card is a single, dependency-free JavaScript file.

| Card | Type | What it shows |
| --- | --- | --- |
| [`corujeira-flow-card.js`](cards/corujeira-flow-card.js) | `custom:corujeira-flow-card` | Power flow: up to 3 sources on top, a hub, up to 4 loads below, with animated wiring-diagram lines. |
| [`corujeira-span-card.js`](cards/corujeira-span-card.js) | `custom:corujeira-span-card` | Wraps any card and overlays range pills driven by an `input_select`. |
| [`corujeira-forecast-card.js`](cards/corujeira-forecast-card.js) | `custom:corujeira-forecast-card` | Next 12 hours (2-hourly) above a 5-day forecast, from any `weather` entity. |
| [`corujeira-meteogram-card.js`](cards/corujeira-meteogram-card.js) | `custom:corujeira-meteogram-card` | Multi-model Open-Meteo meteogram with rain agreement, wind, a written summary and land advice. |
| [`corujeira-fire-card.js`](cards/corujeira-fire-card.js) | `custom:corujeira-fire-card` | IPMA fire risk and weather warning, plus nearby NASA FIRMS hotspots and wind direction. |

## Install

1. Copy the file into `config/www/` on your Home Assistant.
2. Settings > Dashboards > Resources > Add resource: URL `/local/corujeira-meteogram-card.js`, type JavaScript module.
3. Add the card to a dashboard with `type: custom:corujeira-meteogram-card` (or the matching type above).

Options are documented in the comment block at the top of each file.

## Examples

```yaml
type: custom:corujeira-forecast-card
entity: weather.forecast_home
navigate: "#weather"
```

```yaml
type: custom:corujeira-meteogram-card
title: Meteogram
silo: sensor.silo_level   # optional, enables the low-silo pump advice
```

```yaml
type: custom:corujeira-fire-card
risk: sensor.ponte_de_lima_fire_risk
warning: sensor.ponte_de_lima_weather_alert
wind: weather.forecast_home
```

```yaml
type: custom:corujeira-span-card
entity: input_select.chart_span
card:
  type: history-graph
  entities: [sensor.battery_soc]
```

```yaml
type: custom:corujeira-flow-card
hub: { entity: sensor.house_power, name: Home, color: "#3D9BC9", icon: mdi:home }
sources:
  - { entity: sensor.solar_power, name: Solar, color: "#E9A92C", icon: mdi:solar-power }
  - { entity: sensor.battery_power, soc_entity: sensor.battery_soc, name: Battery, color: "#3DAA5C", bidirectional: true }
loads:
  - { entity: sensor.lighting_power, name: Lighting, color: "#E8913A", icon: mdi:lightbulb }
  - { entity: sensor.other_loads_power, name: Other, color: "#A08C7A", icon: mdi:dots-horizontal, dashed: true }
```

## License

MIT, see [LICENSE](LICENSE).
