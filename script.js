/**********************************************************************
 * Hong Kong Monthly Temperature Matrix (Last 10 Years)
 * 
 * Assignment: Matrix View Visualization using D3.js
 * 
 * Requirements satisfied:
 * - X-axis: Year
 * - Y-axis: Month
 * - Each cell color encodes monthly max/min temperature
 * - Click button toggles between MAX and MIN mode
 * - Tooltip displays date and temperature value
 * - Mini line charts show daily temperature changes
 * - Vertical legend shows temperature scale
 * 
 * Code Design Principles:
 * - Modular structure (separation of concerns)
 * - Clear state management
 * - Reusable update logic
 * - Extensive comments for readability
 **********************************************************************/

// ========================== CONFIGURATION ============================

// CSV file path
const DATA_FILE = "temperature_daily.csv";

// Only display last 10 years of dataset
const YEARS_TO_SHOW = 10;

// Months displayed on Y-axis
const months = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// Margin convention for SVG layout
const margin = { top: 45, right: 20, bottom: 20, left: 95 };

// Cell dimensions (controls overall grid spacing)
const cellWidth = 88;
const cellHeight = 62;

// Temperature domain for consistent scaling
// Fixed to 0–40°C for visual comparability
const temperatureDomain = [0, 40];

// Toggle state (true = show MAX mode)
let showMax = true;

// Tooltip selection
const tooltip = d3.select("#tooltip");

// ========================== GLOBAL STATE =============================

// This object stores processed data and references
// Keeps code modular and easy to update
let state = {
  years: [],
  yearMonthMap: new Map(),   // key: "year-month" → daily rows
  svgGroup: null,
  cells: []
};

// ========================== DATA PARSING =============================

/**
 * Converts raw CSV row into structured object
 * This ensures consistent numeric typing and date extraction
 */
function parseRow(d) {
  const dateObj = new Date(d.date);

  return {
    date: dateObj,
    year: dateObj.getFullYear(),
    month: dateObj.getMonth() + 1,
    day: dateObj.getDate(),
    max: +d.max_temperature,
    min: +d.min_temperature
  };
}

/**
 * Returns the last N years sorted ascending
 */
function getLastNYears(allYears, n) {
  return [...new Set(allYears)]
    .sort((a, b) => a - b)
    .slice(-n);
}

// ========================== DATA PREPARATION =========================

/**
 * Builds application state:
 * - Filters last 10 years
 * - Groups daily records by (year, month)
 */
function buildState(rows) {

  const years = getLastNYears(rows.map(r => r.year), YEARS_TO_SHOW);

  const filteredRows = rows.filter(r => years.includes(r.year));

  const yearMonthMap = new Map();

  // Group data into year-month buckets
  filteredRows.forEach(r => {
    const key = `${r.year}-${r.month}`;
    if (!yearMonthMap.has(key)) {
      yearMonthMap.set(key, []);
    }
    yearMonthMap.get(key).push(r);
  });

  // Sort each month’s daily data by day (important for line chart)
  yearMonthMap.forEach(arr => {
    arr.sort((a, b) => a.day - b.day);
  });

  state.years = years;
  state.yearMonthMap = yearMonthMap;
}

// ========================== INITIALIZATION ===========================

/**
 * Initializes SVG container and static elements
 */
function initializeVisualization() {

  const width =
    margin.left + margin.right + state.years.length * cellWidth;

  const height =
    margin.top + margin.bottom + 12 * cellHeight;

  const svg = d3.select("#chart")
    .html("") // Clear existing
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const group = svg.append("g")
    .attr("transform",
      `translate(${margin.left},${margin.top})`
    );

  state.svgGroup = group;

  drawAxisLabels();
  drawLegend();
  drawMatrixCells();
  updateMode(); // Apply initial coloring + tooltip logic
}

// ========================== AXIS LABELS ==============================

/**
 * Draws year labels (top) and month labels (left)
 */
function drawAxisLabels() {

  // Year labels (X direction)
  state.years.forEach((year, i) => {
    state.svgGroup.append("text")
      .attr("x", i * cellWidth + cellWidth / 2)
      .attr("y", -12)
      .attr("text-anchor", "middle")
      .attr("class", "axis-text")
      .text(year);
  });

  // Month labels (Y direction)
  months.forEach((month, i) => {
    state.svgGroup.append("text")
      .attr("x", -10)
      .attr("y", i * cellHeight + cellHeight / 2)
      .attr("text-anchor", "end")
      .attr("alignment-baseline", "middle")
      .attr("class", "axis-text")
      .text(month);
  });
}

// ========================== MATRIX CELLS =============================

/**
 * Creates each matrix cell and mini line charts
 * NOTE: Color is applied later in updateMode()
 */
function drawMatrixCells() {

  const colorScale = d3.scaleSequential()
    .interpolator(d3.interpolateSpectral)
    .domain([temperatureDomain[1], temperatureDomain[0]]);

  const yScale = d3.scaleLinear()
    .domain(temperatureDomain)
    .range([cellHeight - 6, 6]);

  const cells = [];

  state.years.forEach((year, colIndex) => {

    for (let month = 1; month <= 12; month++) {

      const key = `${year}-${month}`;
      const monthData = state.yearMonthMap.get(key);

      if (!monthData) continue;

      const group = state.svgGroup.append("g")
        .attr("transform",
          `translate(${colIndex * cellWidth}, ${(month - 1) * cellHeight})`
        );

      // Background rectangle
      const rect = group.append("rect")
        .attr("class", "cell")
        .attr("width", cellWidth)
        .attr("height", cellHeight);

      // X-scale depends on month length
      const xScale = d3.scaleLinear()
        .domain([1, d3.max(monthData, d => d.day)])
        .range([6, cellWidth - 6]);

      // Line generators
      const maxLine = d3.line()
        .x(d => xScale(d.day))
        .y(d => yScale(d.max));

      const minLine = d3.line()
        .x(d => xScale(d.day))
        .y(d => yScale(d.min));

      // Draw MAX line
      group.append("path")
        .datum(monthData)
        .attr("fill", "none")
        .attr("stroke", "limegreen")
        .attr("stroke-width", 1.3)
        .attr("d", maxLine);

      // Draw MIN line
      group.append("path")
        .datum(monthData)
        .attr("fill", "none")
        .attr("stroke", "cyan")
        .attr("stroke-width", 1.3)
        .attr("d", minLine);

      cells.push({ rect, monthData, colorScale });
    }
  });

  state.cells = cells;
}

// ========================== MODE UPDATE ==============================

/**
 * Updates:
 * - Cell color
 * - Tooltip behavior
 * When toggle button is clicked
 */
function updateMode() {

  const modeLabel = showMax ? "MAX" : "MIN";

  d3.select("#toggleBtn")
    .text(showMax
      ? "Mode: MAX (Click to switch to MIN)"
      : "Mode: MIN (Click to switch to MAX)"
    );

  state.cells.forEach(({ rect, monthData, colorScale }) => {

    const value = showMax
      ? d3.max(monthData, d => d.max)
      : d3.min(monthData, d => d.min);

    rect.attr("fill", colorScale(value))
      .on("mouseover", () => tooltip.style("opacity", 1))
      .on("mousemove", (event) => {

        const extreme = showMax
          ? monthData.reduce((a,b)=>a.max>b.max?a:b)
          : monthData.reduce((a,b)=>a.min<b.min?a:b);

        tooltip.html(`
          <strong>Mode:</strong> ${modeLabel}<br>
          <strong>Date:</strong> ${extreme.date.toISOString().split("T")[0]}<br>
          <strong>Temperature:</strong> ${showMax ? extreme.max : extreme.min} °C
        `)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 20 + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
  });
}

// ========================== LEGEND ==================================

/**
 * Creates vertical temperature legend
 */
function drawLegend() {

  const legendHeight = 300;
  const legendWidth = 20;

  const svg = d3.select("#legend")
    .html("")
    .append("svg")
    .attr("width", 90)
    .attr("height", legendHeight + 40);

  const scale = d3.scaleSequential()
    .interpolator(d3.interpolateSpectral)
    .domain([temperatureDomain[1], temperatureDomain[0]]);

  const gradient = svg.append("defs")
    .append("linearGradient")
    .attr("id", "legendGradient")
    .attr("x1", "0%").attr("y1", "100%")
    .attr("x2", "0%").attr("y2", "0%");

  d3.range(0, 1.01, 0.05).forEach(t => {
    gradient.append("stop")
      .attr("offset", `${t*100}%`)
      .attr("stop-color",
        scale(temperatureDomain[0] + t*(temperatureDomain[1]-temperatureDomain[0]))
      );
  });

  svg.append("rect")
    .attr("x", 10)
    .attr("y", 20)
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("fill", "url(#legendGradient)");

  svg.append("text").attr("x", 40).attr("y", 30).text("40 °C");
  svg.append("text").attr("x", 40).attr("y", legendHeight + 20).text("0 °C");
}

// ========================== MAIN ====================================

// Load CSV and initialize
d3.csv(DATA_FILE, parseRow).then(rows => {
  buildState(rows);
  initializeVisualization();
});

// Toggle event
d3.select("#toggleBtn").on("click", () => {
  showMax = !showMax;
  updateMode();
});
