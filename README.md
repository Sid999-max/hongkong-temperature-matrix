# Hong Kong Monthly Temperature Matrix (Last 10 Years)

## Overview
This project visualizes Hong Kong's monthly temperatures in a matrix layout (Year x Month).  
Each cell encodes temperature using color and contains a mini line chart showing daily changes.

## Features
- Matrix view: x-axis = Year, y-axis = Month
- Click toggle: switch between monthly MAX and monthly MIN temperature coloring
- Tooltip: shows the date and temperature value (extreme day) for the selected mode
- Mini line charts per cell: daily MAX (green) and MIN (cyan)
- Vertical color legend for temperature scale

## How to Run Locally
1. Ensure these files are in the same folder:
   - index.html
   - style.css
   - script.js
   - temperature_daily.csv
2. Start a local server:
   ```bash
   python -m http.server 8000
