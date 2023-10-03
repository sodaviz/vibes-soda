import * as soda from "@sodaviz/soda";
import autocomplete from "autocompleter";
import * as d3 from "d3";

let colors = ["#ad5252", "#496279", "#afc7d9", "#e7a865", "#343434", "#65bac6"];

let state = {
  viewMode: "radial",
  timeoutId: 0,
  relatedEnabled: true,
  bacteriaName: undefined,
  sequenceName: undefined,
  autocompleter: undefined,
  selectedIntegration: undefined,
  charts: {
    main: undefined,
    reference: undefined,
    occurrence: undefined,
  },
  data: {
    bacteria: {
      sequenceNames: undefined,
      params: undefined,
    },
    virus: {
      names: undefined,
      params: undefined,
    },
  },
  currentBacteriaParams() {
    return this.data.bacteria.params.get(this.sequenceName);
  },
  currentVirusParams() {
    return this.data.virus.params.get(this.selectedIntegration.name);
  },
};

let options = {
  timeoutTime: 300,
  buttons: {
    linearOnText: "radial",
    radialOnText: "linear",
    relatedOffText: "show related",
    relatedOnText: "hide related",
  },
  plots: {
    rows: 30,
    xAxisYOffset: -2,
    xAxisRows: 2,
  },
  colors: {
    selectedOutline: colors[5],
    relatedOutline: "green",
    outline: colors[4],
    virusGene: colors[0],
    occurrenceSelected: colors[5],
    occurrenceRelated: colors[3],
    bacteriaGene: colors[1],
    bacteriaGeneGroup: colors[1],
    phage: colors[3],
    geneAlignmentTop: colors[1],
    geneAlignmentBottom: colors[0],
  },
};

//
//
let relatedMouseover = (a) => {
  let glyphs = soda.queryGlyphMap({
    annotations: [a],
  });

  glyphs.forEach((g) =>
    g.style("stroke-width", "2").style("stroke", options.colors.relatedOutline),
  );
};

//
//
let relatedMouseout = (a) => {
  let glyphs = soda.queryGlyphMap({
    annotations: [a],
  });

  glyphs.forEach((g) => {
    if (g.datum().a == state.selectedIntegration) {
      g.style("stroke", options.colors.selectedOutline);
    } else {
      g.style("stroke", "none");
    }
  });
};

export function run(data) {
  state.bacteriaName = data.bacteriaName;
  state.data.bacteria = prepareBacteria(data.bacteriaData);
  state.data.virus = prepareVirus(data.virusData);

  state.charts.reference = new soda.Chart(referenceConfig);
  state.charts.occurrence = new soda.Chart(occurrenceConfig);
  state.charts.main = new soda.RadialChart(radialConfig);

  let toggleChartButton = document.getElementById("chart-toggle");
  toggleChartButton.innerText = `${options.buttons.radialOnText}`;
  toggleChartButton.addEventListener("click", toggleChart);

  let toggleRelatedButton = document.getElementById("related-toggle");
  toggleRelatedButton.innerText = `${options.buttons.relatedOnText}`;
  toggleRelatedButton.addEventListener("click", toggleRelated);

  let resetZoomButton = document.getElementById("reset-zoom");
  resetZoomButton.addEventListener("click", () => {
    state.charts.main.resetTransform();
    state.charts.main.render({
      ...state.currentBacteriaParams(),
      updateDomain: true,
    });
  });

  populateBacteriaList();
  populateSequenceList();

  let firstSequence = state.data.bacteria.sequenceNames[0];
  selectSequence(firstSequence);
}

//
//
function prepareBacteria(seqs) {
  let sequenceNames = [];
  let params = new Map();

  for (const seq of seqs) {
    sequenceNames.push(seq.sequenceName);

    let idCnt = 0;
    let integrations = seq.integrations.map((r) => {
      let tokens = r.split(",");
      return {
        id: `i-${idCnt++}`,
        start: parseInt(tokens[0]),
        end: parseInt(tokens[1]),
        queryStart: parseInt(tokens[2]),
        queryEnd: parseInt(tokens[3]),
        strand: tokens[4],
        evalue: parseFloat(tokens[5]),
        name: tokens[6],
      };
    });

    idCnt = 0;
    let genes = seq.genes.map((r) => {
      let tokens = r.split(",");
      return {
        id: `g-${idCnt++}`,
        start: parseInt(tokens[0]),
        end: parseInt(tokens[1]),
        strand: tokens[2],
        score: parseFloat(tokens[3]),
        name: tokens[4],
        product: tokens[6],
      };
    });

    // we'll do the layout here since it never
    // changes, and it's the same for both charts
    let layout = soda.intervalGraphLayout(integrations);
    let layout2 = soda.intervalGraphLayout(genes);

    let integrationRows = layout.rowCount;

    let max = 0;
    genes.forEach((g) => {
      let row = layout2.rowMap.get(g.id) + integrationRows;
      layout.rowMap.set(g.id, row);
      max = Math.max(integrationRows, row);
    });
    layout.rowCount = max + 2;

    params.set(seq.sequenceName, {
      start: 0,
      end: seq.sequenceLength,
      integrations,
      genes,
      layout,
      integrationRows,
    });
  }

  return { sequenceNames, params };
}

//
//
function prepareVirus(data) {
  let virusNames = [];
  let params = new Map();

  for (const virus of data) {
    virusNames.push(virus.virusName);

    let idCnt = 0;
    let genes = virus.genes.map((r) => {
      let tokens = r.split(",");
      return {
        id: `vg-${idCnt++}`,
        start: parseInt(tokens[0]),
        end: parseInt(tokens[1]),
        queryStart: parseInt(tokens[2]),
        queryEnd: parseInt(tokens[3]),
        queryLength: parseInt(tokens[4]),
        strand: tokens[5],
        evalue: parseFloat(tokens[6]),
        name: tokens[7],
        accession: tokens[8],
        description: tokens[9],
      };
    });

    genes.sort((a, b) => a.start - b.start);

    params.set(virus.virusName, {
      start: 0,
      end: virus.counts.length,
      occurrences: [
        {
          id: `${virus.virusName}-occ`,
          start: 0,
          end: virus.counts.length,
          values: virus.counts,
        },
      ],
      genes,
    });
  }

  return { virusNames, params };
}

//
//
let commonConfig = {
  resizable: true,
  zoomable: true,
  divOutline: "1px solid black",
  updateLayout(params) {
    this.layout = params.layout;

    // sneaky: we also do the gene filtering here
    let domainStart = this.domain[0];
    let domainEnd = this.domain[1];
    let domainWidth = domainEnd - domainStart;

    let filteredGenes = [];
    let density = [];

    if (domainWidth > 1_000_000) {
      let chunkWidth = domainWidth / 10;
      for (let i = 0; i < 10; i++) {
        let start = domainStart + i * chunkWidth;
        let end = domainStart + (i + 1) * chunkWidth;

        let inChunk = params.genes.filter(
          (a) => a.start >= start && a.end <= end,
        );

        let densityValue =
          inChunk.reduce((acc, curr) => acc + (curr.end - curr.start), 0) /
          chunkWidth;

        density.push({
          id: `agg-${i}`,
          start,
          end,
          density: densityValue,
          count: inChunk.length,
        });
      }
    } else {
      filteredGenes = params.genes.filter(
        (a) => a.start <= domainEnd && a.end >= domainStart,
      );
    }

    params.filteredGenes = filteredGenes;
    params.density = density;
  },

  updateDomain(params) {
    if (params.updateDomain == true || params.updateDomain == undefined) {
      this.defaultUpdateDomain(params);
    }
  },

  postRender(params) {
    this.defaultPostRender();

    soda.tooltip({
      annotations: params.integrations,
      text: (d) =>
        `${d.a.name}: ` +
        `${d.a.queryStart.toLocaleString()}..${d.a.queryEnd.toLocaleString()}<br>` +
        `${d.a.start.toLocaleString()}..${d.a.end.toLocaleString()}<br>` +
        `Strand: ${d.a.strand}<br>`,
    });

    soda.tooltip({
      annotations: params.filteredGenes,
      text: (d) =>
        `${d.a.name}<br>` +
        `${d.a.start.toLocaleString()}..${d.a.end.toLocaleString()}<br>` +
        `Strand: ${d.a.strand}<br>` +
        `Product: ${d.a.product}<br>`,
    });

    soda.tooltip({
      annotations: params.density,
      text: (d) =>
        "Aggregated gene group<br>" +
        `Density: ${d.a.density.toFixed(2)}<br>` +
        `Count: ${d.a.count}<br>`,
    });

    soda.clickBehavior({
      chart: this,
      annotations: params.integrations,
      click(_, d) {
        selectIntegration(d.a);
      },
    });

    state.charts.reference.highlight({
      start: this.domain[0],
      end: this.domain[1],
      selector: "highlight",
    });
  },

  postZoom() {
    clearTimeout(state.timeoutId);
    state.timeoutId = window.setTimeout(() => {
      this.updateLayout(this.renderParams);
      this.draw(this.renderParams);
      this.postRender(this.renderParams);
    }, options.timeoutTime);

    state.charts.reference.highlight({
      start: this.domain[0],
      end: this.domain[1],
      selector: "highlight",
    });
  },
};

//
//
let linearConfig = {
  ...commonConfig,
  selector: "#vibes-linear",
  lowerPadSize: 5,
  rowHeight: 16,
  upperPadSize: 25,
  leftPadSize: 0,
  rightPadSize: 0,
  draw(params) {
    this.clear();
    this.addAxis();

    soda.rectangle({
      chart: this,
      annotations: params.integrations,
      selector: "linear-virus",
      fillColor: options.colors.phage,
      strokeWidth: 2,
      strokeColor: (d) =>
        d.a == state.selectedIntegration
          ? options.colors.selectedOutline
          : "none",
    });

    soda.rectangle({
      chart: this,
      annotations: params.density,
      selector: "linear-gene-group",
      fillColor: options.colors.bacteriaGeneGroup,
      fillOpacity: (d) => d.a.density,
      row: params.integrationRows,
    });

    soda.rectangle({
      chart: this,
      annotations: params.filteredGenes,
      selector: "linear-genes",
      fillColor: options.colors.bacteriaGene,
    });
  },
};

//
//
let radialConfig = {
  ...commonConfig,
  selector: "#vibes-radial",
  padSize: 50,
  trackHeightRatio: 0.15,
  axisConfig: {
    tickSizeOuter: 10,
    tickPadding: 15,
  },
  draw(params) {
    this.clear();
    this.addAxis();
    this.addTrackOutline();

    soda.radialRectangle({
      chart: this,
      annotations: params.integrations,
      selector: "radial-virus",
      fillColor: options.colors.phage,
      strokeWidth: 2,
      strokeColor: (d) =>
        d.a == state.selectedIntegration
          ? options.colors.selectedOutline
          : "none",
    });

    soda.radialRectangle({
      chart: this,
      annotations: params.density,
      selector: "radial-gene-group",
      fillColor: options.colors.bacteriaGeneGroup,
      fillOpacity: (d) => d.a.density,
      row: params.integrationRows,
    });

    soda.radialRectangle({
      chart: this,
      annotations: params.filteredGenes,
      selector: "radial-genes",
      fillColor: options.colors.bacteriaGene,
    });
  },
};

//
//
let referenceConfig = {
  resizable: true,
  divOutline: "1px solid black",
  lowerPadSize: 5,
  rowHeight: 16,
  upperPadSize: 25,
  leftPadSize: 0,
  rightPadSize: 0,
  selector: "#vibes-ref",
  updateLayout(params) {
    this.layout = params.layout;
  },
  updateDomain(params) {
    if (params.updateDomain == true || params.updateDomain == undefined) {
      this.defaultUpdateDomain(params);
    }
  },
  draw(params) {
    this.addAxis();
    soda.rectangle({
      chart: this,
      annotations: params.integrations,
      selector: "reference-bacteria-phages",
      fillColor: options.colors.phage,
      strokeColor: options.colors.phage,
    });

    soda.rectangle({
      chart: this,
      annotations: params.genes,
      selector: "bacteria-genes",
      fillColor: options.colors.bacteriaGene,
    });
  },
};

//
//
let occurrenceConfig = {
  zoomable: true,
  resizable: true,
  divOutline: "1px solid black",
  lowerPadSize: 5,
  rowHeight: 16,
  selector: "#vibes-occurrence",
  upperPadSize: 50,
  leftPadSize: 50,
  updateLayout(params) {
    let map = new Map();
    let geneLayout = soda.intervalGraphLayout(params.genes, 100);
    let geneRows = geneLayout.rowCount + 1;
    let plotRows = options.plots.rows - geneRows;

    params.genes.forEach((a) => {
      let offset = geneLayout.rowCount - geneLayout.row({ a }) + 1;
      map.set(a.id, options.plots.rows - offset);
    });

    let relatedLayout = soda.intervalGraphLayout(params.related, 10);

    params.related.forEach((a) => {
      let offset = relatedLayout.row({ a }) + 3;
      map.set(a.id, plotRows - offset);
    });

    // custom layout object
    this.layout = {
      row(d) {
        return map.get(d.a.id);
      },
    };

    // shading for selected integration
    params.shading = [
      {
        id: "plot-shading",
        start: state.selectedIntegration.queryStart,
        end: state.selectedIntegration.queryEnd,
        values: params.occurrences[0].values.slice(
          state.selectedIntegration.queryStart,
          state.selectedIntegration.queryEnd,
        ),
      },
    ];

    // do some of the weird positioning logic here
    let maxCount = Math.max(...params.occurrences[0].values);

    // plots
    params.yAxis = {
      x: 0,
      y: 0,
      domain: [0, maxCount],
      rowSpan: plotRows - options.plots.xAxisRows,
    };

    params.xAxis = {
      x: 0,
      y:
        this.rowHeight * (plotRows - options.plots.xAxisRows) +
        options.plots.xAxisYOffset,
    };

    params.plot = {
      y: 0,
      domain: [maxCount, 0],
      rowSpan: plotRows - options.plots.xAxisRows,
    };
  },

  updateRowCount() {
    this.rowCount = options.plots.rows;
  },

  updateDimensions(params) {
    let height = 500;
    if (state.viewMode == "radial") {
      height =
        state.charts.main.calculatePadHeight() -
        this.upperPadSize -
        this.lowerPadSize;
    }

    this.rowHeight = height / options.plots.rows;
    this.defaultUpdateDimensions(params);
  },

  draw(params) {
    this.clear();

    // x-axis
    soda.horizontalAxis({
      chart: this,
      selector: "x-axis",
      annotations: params.occurrences,
      width: this.viewportWidthPx,
      fixed: true,
      axisType: soda.AxisType.Bottom,
      target: this.overflowViewportSelection,
      ...params.xAxis,
    });

    // y-axis
    soda.verticalAxis({
      chart: this,
      annotations: params.occurrences,
      selector: "y-axis",
      target: this.overflowViewportSelection,
      axisType: soda.AxisType.Left,
      ...params.yAxis,
    });

    // occurrences line plot
    soda.linePlot({
      chart: this,
      annotations: params.occurrences,
      selector: "plot",
      strokeColor: options.colors.outline,
      strokeWidth: 1.5,
      ...params.plot,
    });

    // occurrences shading
    soda.area({
      chart: this,
      annotations: params.shading,
      strokeColor: "none",
      selector: "plot-shading",
      fillColor: options.colors.occurrenceSelected,
      fillOpacity: 0.2,
      ...params.plot,
    });

    // viral genes
    soda.rectangle({
      chart: this,
      annotations: params.genes,
      selector: "virus-genes",
      strokeColor: options.colors.virusGene,
      fillColor: options.colors.virusGene,
      height: this.rowHeight / 2,
    });

    if (state.relatedEnabled) {
      // related integrations
      soda.rectangle({
        chart: this,
        annotations: params.related,
        selector: "related",
        fillColor: options.colors.occurrenceRelated,
        height: this.rowHeight / 2,
      });
    }

    // axis labels
    let labelFontSize = this.rowHeight / 2 + 3;

    let xLabelX =
      this.viewportWidthPx / 2 - this.leftPadSize + this.rightPadSize;
    let xLabelY = params.xAxis.y + this.rowHeight * 1.5;

    let yLabelX = -25;
    let yLabelY = this.viewportHeightPx / 2 - this.upperPadSize;

    let selection = this.overflowViewportSelection
      .selectAll("text.x-label")
      .data(["x-label"]);

    let enter = selection
      .enter()
      .append("text")
      .attr("class", "x-label")
      .text("sequence position (nt)")
      .attr("text-anchor", "middle");

    let merged = selection.merge(enter);

    merged
      .attr("y", xLabelY)
      .attr("x", xLabelX)
      .attr("font-size", labelFontSize);

    selection = this.overflowViewportSelection
      .selectAll("text.y-label")
      .data(["y-label"]);

    enter = selection
      .enter()
      .append("text")
      .attr("class", "y-label")
      .text("position specific integrations (count)")
      .attr("text-anchor", "middle");

    merged = selection.merge(enter);

    merged
      .attr("x", yLabelX)
      .attr("y", yLabelY)
      .attr("transform", `rotate(270 ${yLabelX} ${yLabelY})`)
      .attr("font-size", labelFontSize);
  },

  postRender(params) {
    soda.tooltip({
      annotations: params.genes,
      text: (d) =>
        `${d.a.name}: ` +
        `${d.a.queryStart.toLocaleString()}..${d.a.queryEnd.toLocaleString()}<br>` +
        `${d.a.start.toLocaleString()}..${d.a.end.toLocaleString()}<br>` +
        `Strand: ${d.a.strand}<br>` +
        `Accession: ${d.a.accession}<br>` +
        `Description: ${d.a.description}<br>`,
    });

    soda.hoverBehavior({
      annotations: params.related,
      mouseover: (_, d) => relatedMouseover(d.a),
      mouseout: (_, d) => relatedMouseout(d.a),
    });

    soda.clickBehavior({
      chart: this,
      annotations: params.genes,
      click: (_, d) => {
        let rowSelection = d3.select(`tr#row-${d.a.id}`);
        let rowElement = rowSelection.node();
        if (rowElement == undefined) {
          throw `Table row element on ${d.a.id} is null or undefined`;
        } else {
          rowElement.scrollIntoView(false);
          rowSelection.style("background-color", options.colors.virusGene);
          rowSelection
            .interrupt()
            .transition()
            .duration(2000)
            .style("background-color", null);
        }
      },
    });
  },
  postResize() {
    if (this._renderParams) {
      this.divHeight = undefined;
      this.render(this._renderParams);
    } else {
      this.divHeight = state.charts.main.divHeight;
    }
  },
};

//
//
function selectSequence(name) {
  state.sequenceName = name;
  let label = document.getElementById("seq-label");
  label.innerHTML = `Sequence: ${name}`;

  let params = state.data.bacteria.params.get(name);
  state.charts.reference.render(params);
  state.charts.main.domain = [params.start, params.end];
  state.charts.main.render(params);

  populateIntegrationList();

  let firstIntegration = state.currentBacteriaParams().integrations[0];
  selectIntegration(firstIntegration);
}

//
//
function selectIntegration(selected) {
  if (state.selectedIntegration != undefined) {
    let glyphs = soda.queryGlyphMap({
      annotations: [state.selectedIntegration],
    });
    glyphs.forEach((g) => g.style("stroke", "none"));
  }

  if (selected == undefined) {
    state.selectedIntegration = undefined;
    state.charts.occurrence.clear();
    return;
  }

  let bacteriaParams = state.currentBacteriaParams();
  state.selectedIntegration = bacteriaParams.integrations.find(
    (a) => a == selected,
  );

  let glyphs = soda.queryGlyphMap({ annotations: [state.selectedIntegration] });
  glyphs.forEach((g) => g.style("stroke", options.colors.selectedOutline));

  let name = state.selectedIntegration.name;

  let label = document.getElementById("integration-label");
  label.innerHTML =
    `Viral integration:` +
    `${state.selectedIntegration.name}: ` +
    `${state.selectedIntegration.start.toLocaleString()}..` +
    `${state.selectedIntegration.end.toLocaleString()} `;

  let related = bacteriaParams.integrations
    .filter((a) => a.name == name)
    .map((a) => {
      return {
        ...a,
        start: a.queryStart,
        end: a.queryEnd,
      };
    });

  params = state.data.virus.params.get(name);
  params.related = related;
  state.charts.occurrence.render(params);

  renderTable(params);
}

//
//
function populateBacteriaList() {
  const items = bacteriaNames.map((name) => {
    return { label: name, group: "Bacteria: type to search" };
  });

  let form = document.getElementById("bacteria-selection");
  let label = document.getElementById("bacteria-label");
  label.innerHTML = `Bacteria: ${state.bacteriaName}`;

  autocomplete({
    input: form,
    emptyMsg: "No items found",
    minLength: 0,
    showOnFocus: true,
    disableAutoSelect: true,
    onSelect: (item) => {
      form.blur();
      window.location.href = `./${item.label}.html`;
    },
    fetch: (text, update) => {
      text = text.toLowerCase();
      let suggestions = items.filter(
        (i) => i.label.toLowerCase().indexOf(text) !== -1,
      );
      update(suggestions);
    },
  });
}

//
//
function populateSequenceList() {
  const items = state.data.bacteria.sequenceNames.map((name) => {
    return { label: name, group: "Sequence: type to search" };
  });

  let input = document.getElementById("seq-selection");

  autocomplete({
    input: input,
    emptyMsg: "No items found",
    minLength: 0,
    showOnFocus: true,
    disableAutoSelect: true,
    onSelect: (item) => {
      input.blur();
      selectSequence(item.label);
    },
    fetch: (text, update) => {
      text = text.toLowerCase();
      let suggestions = items.filter(
        (i) => i.label.toLowerCase().indexOf(text) !== -1,
      );
      update(suggestions);
    },
  });
}

//
//
function populateIntegrationList() {
  if (state.autocompleter != undefined) {
    state.autocompleter.destroy();
  }

  let integrations = state.currentBacteriaParams().integrations;

  let items = integrations.map((ann) => {
    return {
      label:
        `${ann.name}: ` +
        `${ann.start.toLocaleString()}..` +
        `${ann.end.toLocaleString()}`,
      ann: ann,
      group: "Integration: type to search",
    };
  });

  let input = document.getElementById("integration-selection");

  state.autocompleter = autocomplete({
    input: input,
    emptyMsg: "No items found",
    minLength: 0,
    showOnFocus: true,
    disableAutoSelect: true,
    onSelect: (item) => {
      input.blur();
      selectIntegration(item.ann);
    },
    customize: (_i, _r, container) => {
      let sel = d3.select(container).selectAll("div").filter(":not(.group)");
      sel
        .data(integrations)
        .on("mouseover", relatedMouseover)
        .on("mouseout", relatedMouseout);
    },
    fetch: (text, update) => {
      text = text.toLowerCase();
      let suggestions = items.filter(
        (i) => i.label.toLowerCase().indexOf(text) !== -1,
      );
      update(suggestions);
    },
  });
}

//
//
function toggleChart() {
  let domain = state.charts.main.domain;
  let k = state.charts.main.transform.k;

  state.charts.main.destroy();
  if (state.viewMode == "radial") {
    d3.select("#chart-toggle").html(`${options.buttons.linearOnText}`);
    d3.select("#vibes-radial").style("flex", 0);
    state.viewMode = "linear";
    state.charts.main = new soda.Chart(linearConfig);
  } else {
    d3.select("#chart-toggle").html(`${options.buttons.radialOnText}`);
    d3.select("#vibes-radial").style("flex", 1);
    state.viewMode = "radial";
    state.charts.main = new soda.RadialChart(radialConfig);
  }

  let chart = state.charts.main;
  let params = state.currentBacteriaParams();

  chart.render(params);
  chart.transform.k = k;
  chart.domain = domain;
  chart.applyGlyphModifiers();
  chart.postZoom();

  state.charts.occurrence.resize();
}

function toggleRelated() {
  if (state.relatedEnabled) {
    d3.select("#related-toggle").html(`${options.buttons.relatedOffText}`);
    state.relatedEnabled = false;
  } else {
    d3.select("#related-toggle").html(`${options.buttons.relatedOnText}`);
    state.relatedEnabled = true;
  }

  let params = state.currentVirusParams();
  state.charts.occurrence.render(params);
}

function renderTable(params) {
  let tableSelection = d3.select("div#vibes-bottom");
  tableSelection.selectAll("*").remove();

  tableSelection
    .append("h3")
    .html(params.name)
    .style("background", "#cccccc")
    .style("margin", "0px")
    .style("margin-top", "0.5em")
    .style("padding", "0.5em");

  let table = tableSelection
    .append("table")
    .style("border-collapse", "collapse")
    .style("border", "1px black solid")
    .style("padding", "5px 0.5em")
    .style("width", "100%")
    .style("font-size", "12px");

  let thead = table.append("thead");
  let tbody = table.append("tbody");

  let columns = [
    "Gene name",
    "Strand",
    "Start (nt)",
    "End (nt)",
    "E-value",
    "Gene start (aa)",
    "Gene end (aa)",
    "Gene" + " length (aa)",
    "Alignment",
  ];

  thead
    .append("tr")
    .selectAll("th")
    .data(columns)
    .enter()
    .append("th")
    .text((d) => d)
    .style("border", "1px solid")
    .style("border-color", "#cccccc")
    .style("background", "#ddd")
    .style("color", "rgba(0, 0, 0, 0.80)")
    .style("padding", "1px 0.5em");

  thead.style("text-align", "left");

  let rows = tbody
    .selectAll("tr")
    .data(params.genes)
    .enter()
    .append("tr")
    .attr("id", (a) => `row-${a.id}`)
    .style("font-size", "14px")
    .style("color", "#333333");

  rows.each((ann, i, nodes) => {
    let row = d3.select(nodes[i]);
    row.append("td").html(ann.name);
    row.append("td").html(`${ann.strand}`);
    row.append("td").html(`${ann.start}`);
    row.append("td").html(`${ann.end}`);
    row.append("td").html(`${ann.evalue.toExponential(2)}`);
    row.append("td").html(`${ann.queryStart}`);
    row.append("td").html(`${ann.queryEnd}`);
    row.append("td").html(`${ann.queryLength}`);

    let aliRow = row
      .append("td")
      .append("svg")
      .attr("width", "100%")
      .attr("height", 20);

    aliRow
      .append("rect")
      .attr("width", "100%")
      .attr("height", "20%")
      .attr("y", 5)
      .attr("fill", options.colors.geneAlignmentTop);

    let aliWidth = ((ann.queryEnd - ann.queryStart) / ann.queryLength) * 100;
    let aliX = (ann.queryStart / ann.queryLength) * 100;

    aliRow
      .append("rect")
      .attr("width", `${aliWidth}%`)
      .attr("height", "20%")
      .attr("x", `${aliX}%`)
      .attr("y", 10)
      .attr("fill", options.colors.geneAlignmentBottom);
  });

  rows
    .selectAll("td")
    .style("border", "1px solid")
    .style("border-color", "#cccccc")
    .style("padding", "1px 0.5em");
}
