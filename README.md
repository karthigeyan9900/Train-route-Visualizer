# Vande Bharat Route Explorer

An interactive visual map of all **Vande Bharat Express** train routes across India — built with **Leaflet.js + OpenStreetMap**. No backend, no framework, pure HTML/CSS/JS.

## Features

- Dark-themed interactive map with **50 routes** drawn as smooth curved arcs
- Color-coded by region: North · West · South · East · Central
- Live search by train name, number, or station
- Region filter chips (All / North / West / South / East / Central)
- Click any route or sidebar card to highlight it and zoom in
- Info panel showing distance, duration, and schedule on selection

## How to Run

Just open `index.html` in any modern browser. An internet connection is needed for map tiles and fonts (all served via CDN).

```
git clone <repo-url>
# then open index.html
```

## Project Structure

```
├── index.html    # App shell + all CSS
├── data.js       # Train routes & station coordinates
└── app.js        # Leaflet map, route rendering, UI logic
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| [Leaflet.js](https://leafletjs.com/) v1.9.4 | Interactive map |
| [CartoDB Dark Matter](https://carto.com/basemaps/) | Map tiles |
| [OpenStreetMap](https://www.openstreetmap.org/) | Base geodata |
| [Inter](https://fonts.google.com/specimen/Inter) | Typography |

## Roadmap

- **V1** — Start/end stations, region filters, search, info panel
- **V1.5** — Intermediate stations along each route
- **V2** — Schedule view, distance heatmap, journey time analytics
