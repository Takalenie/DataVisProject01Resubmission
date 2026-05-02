console.log('World Data Explorer loaded');

const POVERTY_SELECTION = [ // OWID poverty data covers % below $3/day - $20
  { key: 'pct_below_3_per_day', label: '% below $3/day' },
  { key: 'pct_below_4_per_day', label: '% below $4/day' },
  { key: 'pct_below_5_per_day', label: '% below $5/day' },
  { key: 'pct_below_6_per_day', label: '% below $6/day' },
  { key: 'pct_below_7_per_day', label: '% below $7/day' },
  { key: 'pct_below_8_per_day', label: '% below $8/day' },
  { key: 'pct_below_9_per_day', label: '% below $9/day' },
  { key: 'pct_below_10_per_day', label: '% below $10/day' },
];


const EDUCATION_SELECTION = [ // OWID education data
  { key: 'literacy_rate', label: 'Literacy rate' }, // OWID literacy 
  { key: 'primary_enrolment', label: 'Primary school enrollment' }, // OWID enrollment using only primary due to incomplete data sets in upper levels
];

const YEAR_KEY = 'year'; // OWID year data

// Set the default "load-up" display
let selectedPovertyKey = 'pct_below_3_per_day'; 
let selectedEducationKey = 'literacy_rate';

// iso_code strings are 'USA', 'FRA', etc.
let selectedIsoSet = null; 

// Poverty key label 
function povertyLabelFor(key) {
  const opt = POVERTY_SELECTION.find(d => d.key === key);
  return opt ? opt.label : key;
}

// Education key label 
function educationLabelFor(key) {
  const opt = EDUCATION_SELECTION.find(d => d.key === key);
  return opt ? opt.label : key;
}

// Formatting numbers
function fmt(val, digits = 1) {
  if (val == null || Number.isNaN(val)) return 'Data not present';
  return Number(val).toFixed(digits); 
}

const margin = { top: 30, right: 20, bottom: 55, left: 55 };
const histWidth = 460;
const histHeight = 260;
const scatterWidth = 980;
const scatterHeight = 420;
const tooltipPadding = 10;

let worldGeo = null;

let allData = [];

// prep for data cleaning
Promise.all([
  d3.csv('data/country_data.csv'),
  d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'),
  d3.json('https://raw.githubusercontent.com/stefangabos/world_countries/master/data/countries/en/countries.json'),
]).then(([rawData, worldTopo, countryCodeRows]) => {

  // Changes data from numbers -> strings
  rawData.forEach(d => {
    d[YEAR_KEY] = +d[YEAR_KEY];

    d.literacy_rate = +d.literacy_rate;
    d.primary_enrolment = +d.primary_enrolment;

    POVERTY_SELECTION.forEach(opt => {
      d[opt.key] = +d[opt.key];
    });
  });

  // allData = cleaned data
  allData = rawData;

  // Convert from TopoJSON into GeoJSON (since D3 formatting requires that)
  worldGeo = topojson.feature(worldTopo, worldTopo.objects.countries);

  // map the ISO-3 into an id val (type: string). Prep for world-atlas integration 
  const iso3ToId = {};
  countryCodeRows.forEach(row => {
    const iso3 = String(row.alpha3 || '').toUpperCase();
    const idNum = row.id;
    if (iso3 && idNum != null) { // check for valid data
      iso3ToId[iso3] = String(idNum).padStart(3, '0');
    }
  });

  // For each country, tack on its map_id
  allData.forEach(d => {
    const iso = String(d.iso_code || '').toUpperCase();
    d.map_id = iso3ToId[iso] || null;
  });

  // setup the dropdown and buttons
  setupPovertyDropdown();
  setupEducationToggle();

  // min and max years of valid data pulled - for the header display 
  const minYear = d3.min(allData, d => d[YEAR_KEY]);
  const maxYear = d3.max(allData, d => d[YEAR_KEY]);
  d3.select('#yearA').text(minYear); // << displaying it
  d3.select('#yearB').text(maxYear + ' (varies by country)');

  // Render 'em
  renderGraphics();

}).catch(err => {
  console.error('Error loading data or map', err);
});

// aptly named to setup the poverty %'s dropdown element
function setupPovertyDropdown() {
  // select the dropdown element
  const select = d3.select('#povertySelect');
  //set dropdown val to be the same  as the active poverty key
  select.property('value', selectedPovertyKey);

  // User selects a poverty threshold 
  select.on('change', (event) => {
    selectedPovertyKey = event.target.value; // update the selected poverty key
    selectedIsoSet = null; // clear the currently displayed countries 
    renderGraphics(); // rerender to display the now selected threshold values
  });
}

// aptly named to setup the toggle between Literacy rates and Primary education attendance
function setupEducationToggle() {

  // The 2 toggle buttons
  const btnLiteracy = document.querySelector('#btnLiteracy');
  const btnPrimary = document.querySelector('#btnPrimary');

  // Active button determin-er (active = highlighted button on screen)
  function setActiveButton() {
    if (selectedEducationKey === 'literacy_rate') {
      btnLiteracy.classList.add('active'); 
      btnPrimary.classList.remove('active'); 
    } else { // Primary education 
      btnPrimary.classList.add('active'); 
      btnLiteracy.classList.remove('active');
    }
  }

  setActiveButton(); // set the active button...

  // When a button is clicked:
  btnLiteracy.addEventListener('click', () => { 
    selectedEducationKey = 'literacy_rate';
    selectedIsoSet = null; // clear the currently displayed countries 
    setActiveButton();
    renderGraphics(); // re-render
  });

  btnPrimary.addEventListener('click', () => {
    selectedEducationKey = 'primary_enrolment';
    selectedIsoSet = null; // clear the currently displayed countries 
    setActiveButton();
    renderGraphics(); // & render again
  });

}

// Based on determined active states, produce the appropriate graphics
function renderGraphics() {

  const povertyLabel = povertyLabelFor(selectedPovertyKey);
  const eduLabel = educationLabelFor(selectedEducationKey);

  // Histogram Chart Labels
  d3.select('#labelA').text(`${povertyLabel}`);
  d3.select('#labelB').text(`${eduLabel}`);

  // Scatterplot Chart Labels
  d3.select('#mapBTitle').text(`${eduLabel}`);
  d3.select('#scatterTitle').text(`${eduLabel} vs Poverty`);

  // Show only selected data
  const viewData = (selectedIsoSet && selectedIsoSet.size > 0)
    ? allData.filter(d => selectedIsoSet.has(String(d.iso_code || '').toUpperCase()))
    : allData;

  // Draw functions take allData for the fixed data display elements, and viewData to determine what of it is displayed
  drawHistogram('#histA', allData, viewData, selectedPovertyKey, povertyLabel, histWidth, histHeight, onHistogramBrush); 
  drawHistogram('#histB', allData, viewData, selectedEducationKey, eduLabel, histWidth, histHeight, onHistogramBrush); 
  drawScatterplot('#scatter', allData, viewData, selectedPovertyKey, selectedEducationKey, povertyLabel, eduLabel, scatterWidth, scatterHeight, onScatterBrush);

  // "Draw" choropleth maps.
  if (worldGeo) { // cant load the maps if the GeoJson isnt loaded

    // collect map id's
    const povertyById = new Map();
    const eduById = new Map();
    const infoById = new Map(); 

    // i used allData for this so that the maps are visually complete even when all the data isnt presented (seemed better for clarity)
    allData.forEach(d => {
      if (!d.map_id) return; 

      // settin the color vals
      povertyById.set(d.map_id, d[selectedPovertyKey]); 
      eduById.set(d.map_id, d[selectedEducationKey]);

      // all metrics info so tooltips can show all metrics (again, seemed better for clarity)
      infoById.set(d.map_id, { 
        country: d.country, 
        poverty: d[selectedPovertyKey], 
        literacy_rate: d.literacy_rate,
        primary_enrolment: d.primary_enrolment,
      });
    });

    // Turn the current selection into map ids (so that maps can highlight selected countries)
    const selectedIdSet = new Set();
    if (selectedIsoSet && selectedIsoSet.size > 0) {
      allData.forEach(d => {
        if (d.map_id && selectedIsoSet.has(String(d.iso_code || '').toUpperCase())) {
          selectedIdSet.add(d.map_id);
        }
      });
    }

    // Map A: always colors poverty vals but tooltip also shows the CURRENT education metric
    makeChoropleth('#mapA', worldGeo, povertyById, infoById, selectedIdSet, `Poverty: ${povertyLabel}`, selectedEducationKey, eduLabel);

    // Map B: colors the CURRENT education metric
    makeChoropleth('#mapB', worldGeo, eduById, infoById, selectedIdSet, `${eduLabel}`, selectedEducationKey, eduLabel);

  }
}

// updates selectedIsoSet and re-renders
function onHistogramBrush(valKey, rangeOrNull) {
  // if selection/brush is cleared - set to null and rerender 
  if (!rangeOrNull) {
    selectedIsoSet = null;
    renderGraphics();
    return;
  }

  // brush range
  const [minVal, maxVal] = rangeOrNull;

  // Select countries whose val is valid and is inside the brushed range
  const s = new Set();
  allData.forEach(d => {
    const v = d[valKey];
    const iso = String(d.iso_code || '').toUpperCase();
    if (!Number.isNaN(v) && v >= minVal && v <= maxVal) {
      s.add(iso);
    }
  });
  selectedIsoSet = s; // storing it globaly
  renderGraphics();
}

function onScatterBrush(xKey, yKey, rectOrNull) {
  // if brush is cleared the clear display and rerender
  if (!rectOrNull) {
    selectedIsoSet = null; // Project handout (clear selection)
    renderGraphics();
    return;
  }

  const { x0, x1, y0, y1 } = rectOrNull; // brushed coordinates

  // Build ISO codes for countries inside the ^^ brushed coordinates 
  const s = new Set();
  allData.forEach(d => {
    const x = d[xKey];
    const y = d[yKey];
    const iso = String(d.iso_code || '').toUpperCase();
    if (!Number.isNaN(x) && !Number.isNaN(y) && x >= x0 && x <= x1 && y >= y0 && y <= y1) {
      s.add(iso);
    }
  });

  selectedIsoSet = s;
  renderGraphics();
}

// Covers tooltip on hover, provides bursh feature, computes histogram bins
function drawHistogram(svgSelector, domainData, plotData, valKey, valLabel, outerWidth, outerHeight, brushCallback) {

  // Set the x scale domain
  const domainvals = domainData.map(d => d[valKey]).filter(v => !Number.isNaN(v));

  // Extract numeric vals used for computing bin counts
  const plotvals = plotData.map(d => d[valKey]).filter(v => !Number.isNaN(v));

  const BIN_COUNT = 10; // Number of bins

  const [minVal, maxVal] = d3.extent(domainvals); // for fixed scaling, compute the full domains 
  const safeMax = (minVal === maxVal) ? maxVal + 1 : maxVal; // No identitucal vals accepted

  const binWidth = (safeMax - minVal) / BIN_COUNT; // obv computing bin width

  // Buildin' bins
  const bins = []; // track each bins range
  for (let i = 0; i < BIN_COUNT; i++) {
    const x0 = minVal + i * binWidth;
    const x1 = x0 + binWidth;
    bins.push({ x0, x1, count: 0 });
  }

  // Count vals into bins using plotvals (so filtered views show fewer counts)
  plotvals.forEach(v => {
    let idx = Math.floor((v - minVal) / binWidth); // compute the bin the val belongs to
    // ensure index always lands in [0, BIN_COUNT]
    if (idx < 0) idx = 0;
    if (idx >= BIN_COUNT) idx = BIN_COUNT - 1;
    bins[idx].count += 1;
  });

  // Create SVG
  const svg = d3.select(svgSelector)
    .attr('width', outerWidth)
    .attr('height', outerHeight);

  svg.selectAll('*').remove(); // clear before redraw

  // create a translated group so that the chart contents stay within the margins
  const chart = svg.append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  const width = outerWidth - margin.left - margin.right;
  const height = outerHeight - margin.top - margin.bottom;

  // X scale - maps numeric vals to pixel positioning
  const xvalScale = d3.scaleLinear()
    .domain([minVal, safeMax])
    .range([0, width]);

  // Y scale - maps bin counts to pixel positioning
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.count)])
    .range([height, 0]);

  // Axis Def.
  const xAxis = d3.axisBottom(xvalScale)
    .ticks(5)
    .tickSizeOuter(0);

  const yAxis = d3.axisLeft(yScale)
    .ticks(5)
    .tickSizeOuter(0);

  // Draw x-axis at the bottom of the chart
  chart.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0, ${height})`)
    .call(xAxis)
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end');

  // Draw y-axis on the left of the chart
  chart.append('g')
    .attr('class', 'axis y-axis')
    .call(yAxis);

  // Draw bars (rectangles)
  const bars = chart.selectAll('rect.bar')
    .data(bins)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', d => xvalScale(d.x0))
    .attr('y', d => yScale(d.count))
    .attr('width', d => Math.max(0, xvalScale(d.x1) - xvalScale(d.x0) - 1))
    .attr('height', d => height - yScale(d.count))
    .attr('fill', '#0E2F4E')
    .attr('opacity', 0.85)
    .on('mouseover', function () {
        d3.select(this).attr('fill', '#2a649b');
      })
      .on('mouseout', function () {
        d3.select(this).attr('fill', '#0E2F4E');
      });

  // Show bin info when hovering over a bar
  bars.on('mouseover', (event, d) => {
    d3.select('#tooltip')
      .style('display', 'block')
      .style('left', (event.pageX + tooltipPadding) + 'px')
      .style('top', (event.pageY + tooltipPadding) + 'px')
      .html(`
        <div class="tooltip-title">${valLabel}</div>
        <div>Range: <b>${fmt(d.x0, 1)} to ${fmt(d.x1, 1)}</b></div>  // Project handout (bar range)
        <div>Count: <b>${d.count}</b> countries</div>  // Project handout (bar val)
      `);
  }).on('mouseleave', () => {
    d3.select('#tooltip').style('display', 'none');
  });

  // Axis label (above hist.)
  chart.append('text')
    .attr('x', 0)
    .attr('y', -10)
    .attr('text-anchor', 'start')
    .text(valLabel);

  // brush on hist. (select a val range on x axis)
  const brush = d3.brushX()
    .extent([[0, 0], [width, height]])
    .on('end', (event) => {
      if (!event.selection) { // if the selection gets cleared out...
        brushCallback(valKey, null); // ... callback nothing
        return;
      }

      // cConvert the brushed pixel val range into a data range...
      const [px0, px1] = event.selection;
      const x0 = xvalScale.invert(px0);
      const x1 = xvalScale.invert(px1);

      // ... callback w/ those vals
      brushCallback(valKey, [Math.min(x0, x1), Math.max(x0, x1)]); // Project handout (range selection)
    });

  // brush layer on top of hist,\.
  chart.append('g')
    .attr('class', 'brush')
    .call(brush);

}

// Draws Scatterplut: 
// - using the selected x/y metric & plotting the brushed rows
// - keeping the axis scales fixed (domainData) using the full dataset
// - display tooltips when hovering over a point
function drawScatterplot(svgSelector, domainData, plotData, xKey, yKey, xLabel, yLabel, outerWidth, outerHeight, brushCallback) {
  // ensure only valid x/y vals are kept - for scaling domain...
  const domainClean = domainData.filter(d => !Number.isNaN(d[xKey]) && !Number.isNaN(d[yKey]));
  const plotClean = plotData.filter(d => !Number.isNaN(d[xKey]) && !Number.isNaN(d[yKey])); // ... and for plotting

  // set SVG container size
  const svg = d3.select(svgSelector)
    .attr('width', outerWidth)
    .attr('height', outerHeight);

  svg.selectAll('*').remove(); // clearing old content out

  const chart = svg.append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);
  // the chart dimensions negating the margin dimensions
  const width = outerWidth - margin.left - margin.right;
  const height = outerHeight - margin.top - margin.bottom;

  // x and y scales from ful data so that axes stay fixed
  const xScale = d3.scaleLinear()
    .domain(d3.extent(domainClean, d => d[xKey]))
    .range([0, width]);

  const yScale = d3.scaleLinear()
    .domain(d3.extent(domainClean, d => d[yKey]))
    .range([height, 0]);

  const xAxis = d3.axisBottom(xScale).tickSizeOuter(0);
  const yAxis = d3.axisLeft(yScale).tickSizeOuter(0);

  chart.append('g') // x axis at the bottom
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0, ${height})`)
    .call(xAxis);

  chart.append('g') // y axis to the left
    .attr('class', 'axis y-axis')
    .call(yAxis);

  // label those axis-es that we just made
  chart.append('text')
    .attr('x', width / 2)
    .attr('y', height + 42)
    .attr('text-anchor', 'middle')
    .text(xLabel);

  chart.append('text')
    .attr('x', -height / 2)
    .attr('y', -42)
    .attr('transform', 'rotate(-90)')
    .attr('text-anchor', 'middle')
    .text(yLabel);

  // Create a circle for each (selected) data row
  const circles = chart.selectAll('circle')
    .data(plotClean)
    .enter()
    .append('circle')
    .attr('cx', d => xScale(d[xKey]))
    .attr('cy', d => yScale(d[yKey]))
    .attr('r', 4)
    .attr('stroke', '#f8e6de')
    .attr('stroke-width', 0.5)
    .attr('opacity', 0.75);

  // tooltip on hover (poverty % & selected education metric)
  circles.on('mouseover', (event, d) => {
    d3.select('#tooltip')
      .style('display', 'block')
      .style('left', (event.pageX + tooltipPadding) + 'px')
      .style('top', (event.pageY + tooltipPadding) + 'px')
      .html(`
        <div class="tooltip-title">${d.country}</div>
        <div>${xLabel}: <b>${fmt(d[xKey], 1)}%</b></div>  // Project handout (poverty % on hover)
        <div>${yLabel}: <b>${fmt(d[yKey], 1)}%</b></div>  // Project handout (education metric on hover)
      `);
  }).on('mouseleave', () => {
    d3.select('#tooltip').style('display', 'none');
  });

  // rectangle brush in scatterplot functionality
  const brush = d3.brush()
    .extent([[0, 0], [width, height]])
    .on('end', (event) => {
      if (!event.selection) { // if brush is cleared, callback as null
        brushCallback(xKey, yKey, null);
        return;
      }
      
      // the brushed rectangle in coordinates (px)
      const [[px0, py0], [px1, py1]] = event.selection;

      // Convert pixel coords into data-space bounds
      const x0 = xScale.invert(Math.min(px0, px1));
      const x1 = xScale.invert(Math.max(px0, px1));
      const y0 = yScale.invert(Math.max(py0, py1));
      const y1 = yScale.invert(Math.min(py0, py1));

      brushCallback(xKey, yKey, { x0, x1, y0, y1 }); // callback w/ the converted vals
    });

  chart.append('g')
    .attr('class', 'brush')
    .call(brush); // brush layer added

}