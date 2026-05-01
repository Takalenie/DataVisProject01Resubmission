// 1 Choropleth map comin right up
function makeChoropleth(parentSelector, geoData, valueById, infoById, selectedIdSet, titleText, eduKey, eduLabel) {

  const tooltipPadding = 10;

  // Measures container so I know what to make graphic size
  const container = document.querySelector(parentSelector); 
  const width = container.clientWidth; 
  const height = container.clientHeight;

  // Clear out any previous SVG and Create new SVG
  d3.select(parentSelector).selectAll('*').remove(); // remove prev.
  const svg = d3.select(parentSelector)
    .append('svg')
    .attr('width', width) 
    .attr('height', height);

  // projection &  path generator
  const projection = d3.geoMercator()
    .fitSize([width, height], geoData);

  const path = d3.geoPath().projection(projection);

  // Determines min & max values for the color scale
  const values = Array.from(valueById.values()).filter(v => !Number.isNaN(v));
  const minvalue = d3.min(values);
  const maxvalue = d3.max(values);

  // Colors! (aka: the fun part)
  const colorScale = d3.scaleLinear()
    .domain([minvalue, maxvalue])
    .range(['#6b97a1', '#5D1B21']);

  // Is a subset of data selected?
  const activeSelection = selectedIdSet && selectedIdSet.size > 0;

  // Form each country (SVG paths)
  const paths = svg.selectAll('path')
    .data(geoData.features)
    .enter()
    .append('path')
    .attr('d', path)
    .attr('stroke', '#f8e6de')
    .attr('stroke-width', 0.4)
    .attr('fill', d => {

      const id = String(d.id);

      //  When filtered, unselected countries fade
      if (activeSelection && !selectedIdSet.has(id)) {
        return '#807675'; 
      } 

      const value = valueById.get(id); 
      if (value == null || Number.isNaN(value)) return '#d8cccc'; 

      return colorScale(value); 
    })
    .attr('opacity', d => { 
      const id = String(d.id); 
      if (activeSelection && !selectedIdSet.has(id)) return 0.25;
      return 1;
    }); 

  // Hover pop-up info blocks
  paths.on('mouseover', (event, d) => { 
    const id = String(d.id); 
    const info = infoById.get(id) || {}; // Use empty object so hover still works on data-less countries

    const countryName = info.country || d.properties?.name || `Country ID: ${id}`;

    // Determines weither to display Literacy vs Primary enrollment) to show
    const eduvalue = info[eduKey];

    d3.select('#tooltip')
      .style('display', 'block')
      .style('left', (event.pageX + tooltipPadding) + 'px')
      .style('top', (event.pageY + tooltipPadding) + 'px')
      .html(`
        <div class="tooltip-title">${countryName}</div> 
        <div>Poverty: <b>${(info.poverty == null || Number.isNaN(info.poverty)) ? 'Data not present' : Number(info.poverty).toFixed(1) + '%'}</b></div> 
        <div>${eduLabel}: <b>${(eduvalue == null || Number.isNaN(eduvalue)) ? 'Data not present' : Number(eduvalue).toFixed(1) + '%'}</b></div>
      `); 
  }).on('mouseleave', () => {
    d3.select('#tooltip').style('display', 'none');
  }); 

}
