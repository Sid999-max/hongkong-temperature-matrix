// ==============================
// CONFIG
// ==============================
const DATA_FILE = "temperature_daily.csv";
const YEARS_TO_SHOW = 10;

const months = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// Match screenshot-like geometry
const margin = { top: 45, right: 15, bottom: 10, left: 95 };
const cellW = 88;
const cellH = 62;

const tempDomain = [0, 40]; // matches the screenshot scale

let showMax = true; // toggle mode

const tooltip = d3.select("#tooltip");

// Containers
const chartDiv = d3.select("#chart");
const legendDiv = d3.select("#legend");

// ==============================
// HELPERS
// ==============================
function parseRow(d) {
  const dt = new Date(d.date); // <-- correct column name is "date"

  return {
    date: dt,
    year: dt.getFullYear(),
    month: dt.getMonth() + 1,
    day: dt.getDate(),
    max: +d.max_temperature, // <-- correct column name
    min: +d.min_temperature  // <-- correct column name
  };
}

function lastNYears(allYears, n) {
  return [...new Set(allYears)].sort((a,b) => a - b).slice(-n);
}

function formatISODate(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth()+1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Return { value, date } for tooltip based on mode
function getExtremeDay(monthData, modeMax) {
  if (modeMax) {
    const best = monthData.reduce((a,b) => (a.max > b.max ? a : b));
    return { value: best.max, date: best.date };
  } else {
    const best = monthData.reduce((a,b) => (a.min < b.min ? a : b));
    return { value: best.min, date: best.date };
  }
}

// ==============================
// RENDER (build once, then update on toggle)
// ==============================
let state = {
  years: [],
  byYearMonth: new Map(), // key `${year}-${month}` -> day array
  svg: null
};

function buildState(rows) {
  const years = lastNYears(rows.map(r => r.year), YEARS_TO_SHOW);
  const filtered = rows.filter(r => years.includes(r.year));

  // Map year-month -> array of daily rows
  const byYearMonth = new Map();
  for (const r of filtered) {
    const key = `${r.year}-${r.month}`;
    if (!byYearMonth.has(key)) byYearMonth.set(key, []);
    byYearMonth.get(key).push(r);
  }

  // Sort days for lines
  for (const arr of byYearMonth.values()) {
    arr.sort((a,b) => a.day - b.day);
  }

  state.years = years;
  state.byYearMonth = byYearMonth;
}

function initSVG() {
  // Clear any previous
  chartDiv.html("");

  const width = margin.left + margin.right + state.years.length * cellW;
  const height = margin.top + margin.bottom + 12 * cellH;

  const svg = chartDiv.append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  state.svg = g;

  drawAxisLabels();
  drawLegend(); // static legend
  drawCellsAndMiniCharts(); // create all cells once
  updateModeStyling(); // apply initial MAX mode fill + tooltip behavior
}

function drawAxisLabels() {
  // Years on top
  state.years.forEach((yr, i) => {
    state.svg.append("text")
      .attr("class", "axis-text")
      .attr("x", i * cellW + cellW / 2)
      .attr("y", -12)
      .attr("text-anchor", "middle")
      .text(yr);
  });

  // Months on left
  months.forEach((m, i) => {
    state.svg.append("text")
      .attr("class", "axis-text")
      .attr("x", -10)
      .attr("y", i * cellH + cellH / 2)
      .attr("text-anchor", "end")
      .attr("alignment-baseline", "middle")
      .text(m);
  });
}

function drawCellsAndMiniCharts() {
  // Color scale (fill updated later based on mode)
  const colorScale = d3.scaleSequential()
    .interpolator(d3.interpolateSpectral) // closer to screenshot’s look
    .domain([tempDomain[1], tempDomain[0]]); // invert so warmer = red-ish

  // Mini chart scales (shared)
  const yScale = d3.scaleLinear()
    .domain(tempDomain)
    .range([cellH - 6, 6]);

  // create one group per cell
  const cells = [];

  state.years.forEach((year, col) => {
    for (let month = 1; month <= 12; month++) {
      const key = `${year}-${month}`;
      const monthData = state.byYearMonth.get(key);
      if (!monthData) continue;

      const gx = col * cellW;
      const gy = (month - 1) * cellH;

      const gCell = state.svg.append("g")
        .attr("class", "cell-group")
        .attr("transform", `translate(${gx},${gy})`)
        .attr("data-key", key);

      // background rect (fill updated in updateModeStyling)
      gCell.append("rect")
        .attr("class", "cell")
        .attr("width", cellW)
        .attr("height", cellH);

      // xScale depends on month length
      const xScale = d3.scaleLinear()
        .domain([1, d3.max(monthData, d => d.day)])
        .range([6, cellW - 6]);

      // Max & min lines (always show both, like screenshot)
      const maxLine = d3.line()
        .x(d => xScale(d.day))
        .y(d => yScale(d.max));

      const minLine = d3.line()
        .x(d => xScale(d.day))
        .y(d => yScale(d.min));

      gCell.append("path")
        .datum(monthData)
        .attr("fill", "none")
        .attr("stroke", "limegreen")
        .attr("stroke-width", 1.3)
        .attr("d", maxLine);

      gCell.append("path")
        .datum(monthData)
        .attr("fill", "none")
        .attr("stroke", "cyan")
        .attr("stroke-width", 1.3)
        .attr("d", minLine);

      // store so we can update fill/tooltip by mode later
      cells.push({ key, gCell, monthData, colorScale });
    }
  });

  // stash selection for updates
  state.cells = cells;
}

function updateModeStyling() {
  const modeLabel = showMax ? "MAX" : "MIN";

  // Update button text
  d3.select("#toggleBtn").text(
    showMax ? "Mode: MAX (Click to switch to MIN)" : "Mode: MIN (Click to switch to MAX)"
  );

  // Fill cells based on mode (monthly extreme)
  state.cells.forEach(({ gCell, monthData, colorScale }) => {
    const value = showMax
      ? d3.max(monthData, d => d.max)
      : d3.min(monthData, d => d.min);

    gCell.select("rect.cell")
      .attr("fill", colorScale(value))
      .on("mouseover", () => tooltip.style("opacity", 1))
      .on("mousemove", (event) => {
        const extreme = getExtremeDay(monthData, showMax);
        tooltip.html(
          `Mode: <b>${modeLabel}</b><br>` +
          `Date: ${formatISODate(extreme.date)}<br>` +
          `Temperature: <b>${extreme.value.toFixed(1)} °C</b>`
        )
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 18) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
  });
}

function drawLegend() {
  legendDiv.html("");

  const legendH = 320;
  const legendW = 24;

  const svg = legendDiv.append("svg")
    .attr("width", 90)
    .attr("height", legendH + 50);

  // Use same color scheme as cells
  const colorScale = d3.scaleSequential()
    .interpolator(d3.interpolateSpectral)
    .domain([tempDomain[1], tempDomain[0]]);

  const defs = svg.append("defs");
  const grad = defs.append("linearGradient")
    .attr("id", "tempGrad")
    .attr("x1", "0%").attr("y1", "100%")
    .attr("x2", "0%").attr("y2", "0%");

  // gradient stops
  d3.range(0, 1.0001, 0.05).forEach(t => {
    grad.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", colorScale(tempDomain[0] + t * (tempDomain[1] - tempDomain[0])));
  });

  svg.append("text")
    .attr("class", "legend-title")
    .attr("x", 0)
    .attr("y", 14)
    .text("Temperature");

  // gradient bar
  svg.append("rect")
    .attr("x", 10)
    .attr("y", 25)
    .attr("width", legendW)
    .attr("height", legendH)
    .attr("fill", "url(#tempGrad)")
    .attr("stroke", "#ddd");

  // labels (top=40, bottom=0)
  svg.append("text").attr("x", 45).attr("y", 35).text("40 °C").style("font-size", "12px");
  svg.append("text").attr("x", 45).attr("y", 25 + legendH).text("0 °C").style("font-size", "12px");
}

// ==============================
// MAIN
// ==============================
d3.csv(DATA_FILE, parseRow).then(rows => {
  buildState(rows);
  initSVG();
});

// Toggle behavior
d3.select("#toggleBtn").on("click", () => {
  showMax = !showMax;
  updateModeStyling();
});