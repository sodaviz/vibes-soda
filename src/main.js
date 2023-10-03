import * as soda from "@sodaviz/soda";
import autocomplete from "autocompleter";
import * as d3 from "d3";

let colors = ["#ad5252", "#496279", "#afc7d9", "#e7a865", "#343434", "#65bac6"];
let timeoutId = 0;

let options = {
  viewMode: "radial",
  charts: {
    main: undefined,
    reference: undefined,
    occurrence: undefined,
  },
  buttons: {
    linearOnText: "radial",
    radialOnText: "linear",
    relatedOnText: "show related",
    relatedOffText: "hide related",
  },
  occurrence: {
    rows: 30,
    xAxisYOffset: -2,
    xAxisRows: 2,
  },
  colors: {
    outline: colors[4],
    virusGene: colors[0],
    occurrenceSelected: colors[5],
    occurrenceRelated: colors[3],
    bacteriaGene: colors[1],
    bacteriaGeneGroup: colors[2],
    phage: colors[3],
    geneAlignmentTop: colors[0],
    geneAlignmentBottom: colors[1],
  },
};
//
//
function prepareBacteria(seqs) {
  let names = [];
  let paramsMap = new Map();

  for (const seq of seqs) {
    names.push(seq.sequenceName);

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

    paramsMap.set(seq.sequenceName, {
      start: 0,
      end: seq.sequenceLength,
      integrations,
      genes,
      layout,
      integrationRows,
    });
  }

  return [names, paramsMap];
}

//
//
function prepareVirus(data) {
  let names = [];
  let paramsMap = new Map();

  for (const virus of data) {
    names.push(virus.virusName);

    let idCnt = 0;
    let genes = virus.genes.map((r) => {
      let tokens = r.split(",");
      return {
        id: `vg-${idCnt++}`,
        start: parseInt(tokens[0]),
        end: parseInt(tokens[1]),
        queryStart: parseInt(tokens[2]),
        queryEnd: parseInt(tokens[3]),
        strand: tokens[5],
        evalue: parseFloat(tokens[6]),
        name: tokens[7],
      };
    });
    paramsMap.set(virus.virusName, {
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

  return [names, paramsMap];
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

        let value =
          params.genes
            .filter((a) => a.start >= start && a.end <= end)
            .reduce((acc, curr) => acc + (curr.end - curr.start), 0) /
          chunkWidth;

        density.push({
          id: `{agg-i}`,
          start,
          end,
          value,
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

  postRender() {
    this.defaultPostRender();
    options.charts.reference.highlight({
      start: this.domain[0],
      end: this.domain[1],
      selector: "highlight",
    });
  },

  postZoom() {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      this.render({
        ...this.renderParams,
        updateDomain: false,
      });
      // addSelectedIntegrationOutline();
    }, 500);

    options.charts.reference.highlight({
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
    this.addAxis();

    soda.rectangle({
      chart: this,
      annotations: params.integrations,
      selector: "linear-bacteria-phages",
      fillColor: options.colors.phage,
    });

    soda.rectangle({
      chart: this,
      annotations: params.density,
      selector: "bacteria-genes-aggregated",
      fillColor: options.colors.bacteriaGeneGroup,
      fillOpacity: (d) => d.a.value,
      row: params.integrationRows,
    });

    soda.rectangle({
      chart: this,
      annotations: params.filteredGenes,
      selector: "bacteria-genes",
      fillColor: options.colors.bacteriaGene,
    });

    soda.tooltip({
      annotations: params.filteredGenes,
      text: (d) => `${d.a.name}`,
    });

    soda.clickBehavior({
      chart: this,
      annotations: params.integrations,
      click(_, d) {
        selectIntegration(d.a);
      },
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
    this.addAxis();
    this.addTrackOutline();

    soda.radialRectangle({
      chart: this,
      annotations: params.integrations,
      selector: "linear-bacteria-phages",
      fillColor: options.colors.phage,
    });

    soda.radialRectangle({
      chart: this,
      annotations: params.density,
      selector: "bacteria-genes-aggregated",
      fillColor: options.colors.bacteriaGeneGroup,
      fillOpacity: (d) => d.a.value,
      row: params.integrationRows,
    });

    soda.radialRectangle({
      chart: this,
      annotations: params.filteredGenes,
      selector: "bacteria-genes",
      fillColor: options.colors.bacteriaGene,
    });

    soda.tooltip({
      annotations: params.filteredGenes,
      text: (d) => `${d.a.name}`,
    });

    soda.clickBehavior({
      chart: this,
      annotations: params.integrations,
      click(_, d) {
        selectIntegration(d.a);
      },
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
    let plotRows = options.occurrence.rows - geneRows;

    params.genes.forEach((a) => {
      let offset = geneLayout.rowCount - geneLayout.row({ a }) + 1;
      map.set(a.id, options.occurrence.rows - offset);
    });

    let relatedLayout = soda.intervalGraphLayout(params.related, 10);

    params.related.forEach((a) => {
      let offset = relatedLayout.row({ a }) + 3;
      map.set(a.id, plotRows - offset);
    });

    this.layout = {
      row(d) {
        return map.get(d.a.id);
      },
    };
    // shading for selected integration
    params.shading = [
      {
        id: "plot-shading",
        start: params.selected.queryStart,
        end: params.selected.queryEnd,
        values: params.occurrences[0].values.slice(
          params.selected.queryStart,
          params.selected.queryEnd,
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
      rowSpan: plotRows - options.occurrence.xAxisRows,
    };

    params.xAxis = {
      x: 0,
      y:
        this.rowHeight * (plotRows - options.occurrence.xAxisRows) +
        options.occurrence.xAxisYOffset,
    };

    params.plot = {
      y: 0,
      domain: [maxCount, 0],
      rowSpan: plotRows - options.occurrence.xAxisRows,
    };
  },

  updateRowCount() {
    this.rowCount = options.occurrence.rows;
  },

  updateDimensions(params) {
    let height = 500;
    if (options.viewMode == "radial") {
      height =
        options.charts.main.calculatePadHeight() -
        this.upperPadSize -
        this.lowerPadSize;
    }

    this.rowHeight = height / options.occurrence.rows;
    this.defaultUpdateDimensions(params);
  },

  draw(params) {
    this.clear();

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
          rowSelection.style("background-color", "yellow");
          rowSelection
            .interrupt()
            .transition()
            .duration(2000)
            .style("background-color", null);
        }
      },
    });

    // related integrations
    soda.rectangle({
      chart: this,
      annotations: params.related,
      selector: "related",
      fillColor: options.colors.occurrenceRelated,
      height: this.rowHeight / 2,
    });

    // soda.hoverBehavior({
    //   annotations: params.related,
    //   mouseover: (s, d) => {
    //     s.style("stroke", "green");
    //     s.style("stroke-width", 2);

    //     let glyphs = soda.queryGlyphMap({
    //       annotations: [d.a],
    //     });

    //     for (const glyph of glyphs) {
    //       glyph.style("stroke-width", 2);
    //       glyph.style("stroke", "green");
    //     }
    //   },
    //   mouseout: (s, d) => {
    //     s.style("stroke", "none");

    //     let glyphs = soda.queryGlyphMap({
    //       annotations: [d.a],
    //     });

    //     for (const glyph of glyphs) {
    //       glyph.style("stroke", "none");
    //     }
    //   },
    // });

    let labelFontSize = this.rowHeight / 2 + 3;

    let xLabelX =
      this.viewportWidthPx / 2 - this.leftPadSize + this.rightPadSize;
    let xLabelY = params.xAxis.y;

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

  postResize() {
    if (this._renderParams) {
      this.divHeight = undefined;
      this.render(this._renderParams);
    } else {
      this.divHeight = options.charts.main.divHeight;
    }
  },
};

export function run(data) {
  let [seqNames, seqParamsMap] = prepareBacteria(data.bacteriaData);
  let [virusNames, occParamsMap] = prepareVirus(data.virusData);

  options.charts.reference = new soda.Chart(referenceConfig);
  options.charts.occurrence = new soda.Chart(occurrenceConfig);
  options.charts.main = new soda.RadialChart(radialConfig);

  populateBacteriaList(data.bacteriaName);
  populateSequenceList(seqNames, selectSequence);

  selectSequence(seqNames[0]);
  selectIntegration(options.charts.main.renderParams.integrations[0].id);

  function selectSequence(name) {
    let label = document.getElementById("seq-label");
    label.innerHTML = `Sequence: ${name}`;

    let params = seqParamsMap.get(name);
    options.charts.reference.render(params);
    options.charts.main.render(params);
  }

  function selectIntegration(id) {
    let mainParams = options.charts.main.renderParams;
    let selected = mainParams.integrations.find((a) => a.id == id);
    let name = selected.name;
    let related = mainParams.integrations
      .filter((a) => a.name == name)
      .map((a) => {
        return {
          ...a,
          start: a.queryStart,
          end: a.queryEnd,
        };
      });

    params = occParamsMap.get(name);
    options.charts.occurrence.render({
      ...params,
      selected,
      related,
    });

    //renderTable(params);
  }
}

//
//
function populateBacteriaList(bacteriaName) {
  const items = bacteriaNames.map((name) => {
    return { label: name, group: "Bacteria: type to search" };
  });

  let form = document.getElementById("bacteria-selection");
  let label = document.getElementById("bacteria-label");
  label.innerHTML = `Bacteria: ${bacteriaName}`;

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
function populateSequenceList(seqNames, select) {
  const items = seqNames.map((name) => {
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
      select(item.label);
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

// function fuckOff() {
//   let timeoutId;

//   function selectSequence(sequenceName) {
//     selectedSequence = sequenceName;

//     populateIntegrationList();

//     let inputLabel = document.getElementById("seq-label");
//     inputLabel.innerHTML = `Sequence: ${sequenceName}`;

//     renderSequence();
//   }

//   populateBacteriaList();
//   populateSequenceList();

//   let chart;

//   if (viewMode == "radial") {
//     chart = new soda.RadialChart(radialConfig);
//   } else if (viewMode == "linear") {
//     chart = new soda.Chart(linearConfig);
//   }

//   function setToggleChartText() {
//     if (viewMode == "radial") {
//       d3.select("#chart-toggle").html(`${radialOnText}`);
//     } else if (viewMode == "linear") {
//       d3.select("#chart-toggle").html(`${linearOnText}`);
//     }
//   }

//   setToggleChartText();

//   function toggleChart() {
//     let domain = chart.domain;
//     let k = chart.transform.k;

//     chart.destroy();
//     if (viewMode == "radial") {
//       d3.select("#vibes-radial").style("flex", 0);
//       viewMode = "linear";
//       chart = new soda.Chart(linearConfig);
//     } else {
//       d3.select("#vibes-radial").style("flex", 1);
//       viewMode = "radial";
//       chart = new soda.RadialChart(radialConfig);
//     }

//     setToggleChartText();

//     if (bacteriaRenderParams == undefined) {
//       throw "bacteriaRenderParams undefined in call to swap()";
//     }

//     chart.render(bacteriaRenderParams);
//     chart.transform.k = k;
//     chart.domain = domain;
//     chart.applyGlyphModifiers();
//     chart.postZoom();
//   }

//   const toggleChartButton = document.getElementById("chart-toggle");
//   toggleChartButton.addEventListener("click", toggleChart);

//   const resetZoomButton = document.getElementById("reset-zoom");
//   resetZoomButton.addEventListener("click", () => {
//     chart.resetTransform();
//     chart.render({ ...chart.renderParams, updateDomain: true });
//   });

//   function setToggleRelatedText() {
//     if (occurrenceRelatedEnabled) {
//       d3.select("#related-toggle").html(`${relatedOnText}`);
//     } else {
//       d3.select("#related-toggle").html(`${relatedOffText}`);
//     }
//   }

//   function toggleRelated() {
//     setToggleRelatedText();
//     occurrenceRelatedEnabled = !occurrenceRelatedEnabled;
//     renderOccurrence();
//   }

//   setToggleRelatedText();
//   const toggleRelatedButton = document.getElementById("related-toggle");
//   toggleRelatedButton.addEventListener("click", toggleRelated);

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
    row.append("td").html(`${ann.start}`);
    row.append("td").html(`${ann.end}`);
    row.append("td").html(`${ann.evalue.toExponential(2)}`);
    row.append("td").html(`${ann.modelStart}`);
    row.append("td").html(`${ann.modelEnd}`);
    row.append("td").html(`${ann.modelLength}`);

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

    let aliWidth = ((ann.modelEnd - ann.modelStart) / ann.modelLength) * 100;
    let aliX = (ann.modelStart / ann.modelLength) * 100;

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
