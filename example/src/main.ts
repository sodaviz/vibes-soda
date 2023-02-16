import * as autocomplete from "autocompleter";
import * as soda from "@sodaviz/soda";

import {
  bacteriaNames,
  bacteriaLengths,
  phageNames,
  phageLengths,
  integrationAnnotations,
  bacteriaGeneAnnotations,
  virusGeneAnnotations,
} from "./out";
import * as d3 from "d3";

let occurrenceRows = 30;
let colors = ["#ad5252", "#496279", "#afc7d9", "#e7a865", "#343434", "#65bac6"];
let outlineColor = colors[4];
let virusGeneColor = colors[0];
let occurrenceFillColor = colors[5];
let bacteriaGeneColor = colors[1];
let bacteriaGeneGroupColor = colors[2];
let phageColor = colors[3];
let geneAlignmentTopColor = colors[0];
let geneAlignmentBottomColor = colors[1];

let linearChartTimeoutId: number | undefined;
let radialChartTimeoutId: number | undefined;

let activeAnnotation: IntegrationAnnotation | undefined;

interface IntegrationAnnotation extends soda.Annotation {
  phageName: string;
  phageStart: number;
  phageEnd: number;
  strand: string;
  evalue: number;
}

interface BacteriaGeneAnnotation extends soda.Annotation {
  strand: string;
  name: string;
}

interface VirusGeneAnnotation extends soda.Annotation {
  name: string;
  modelStart: number;
  modelEnd: number;
  modelLength: number;
  strand: string;
  evalue: number;
}

interface BacteriaRenderParams extends soda.RenderParams {
  integrations: IntegrationAnnotation[];
  genes: BacteriaGeneAnnotation[];
  updateDomain?: boolean;
}

interface VirusRenderParams extends soda.RenderParams {
  occurrences: soda.PlotAnnotation;
  genes: VirusGeneAnnotation[];
  name: string;
  virusStart: number;
  virusEnd: number;
}

interface BacteriaNameItem {
  label: string;
  group: string;
}

function populateBacteriaList() {
  const items: BacteriaNameItem[] = bacteriaNames.map((name: string) => {
    return { label: name, group: "Bacteria" };
  });

  let inputForm = <HTMLInputElement>(
    document.getElementById("bacteria-selection")
  );

  //@ts-ignore
  autocomplete<BacteriaNameItem>({
    input: inputForm,
    emptyMsg: "No items found",
    minLength: 1,
    showOnFocus: true,
    onSelect: (item: BacteriaNameItem, input: HTMLInputElement) => {
      // this function is called when the user clicks
      // on an element in the autocomplete list
      input.value = item.label;
      render(item.label);
    },
    fetch: (text: string, update: Function) => {
      // this function is called everytime there is a change
      // in the form we have bound the autocompleter to
      text = text.toLowerCase();
      let suggestions = items.filter(
        (i: BacteriaNameItem) => i.label.toLowerCase().indexOf(text) !== -1
      );
      update(suggestions);
    },
  });
}

populateBacteriaList();

let chartConfig = {
  zoomable: true,
  resizable: true,
  divOutline: "1px solid black",
  lowerPadSize: 5,
  rowHeight: 16,
};

let linearBacteriaChart = new soda.Chart<BacteriaRenderParams>({
  ...chartConfig,
  upperPadSize: 25,
  leftPadSize: 0,
  rightPadSize: 0,
  selector: "#vibes-top",
  updateLayout() {},
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
      selector: "linear-bacteria-phages",
      fillColor: phageColor,
      strokeColor: outlineColor,
    });

    let aggregationResults = aggregateBacteriaGenes(this, params.genes);
    soda.rectangle({
      chart: this,
      annotations: aggregationResults.aggregated,
      selector: "bacteria-genes-aggregated",
      fillColor: bacteriaGeneGroupColor,
      strokeColor: outlineColor,
      row: 1,
    });

    soda.rectangle({
      chart: this,
      annotations: aggregationResults.individual,
      selector: "bacteria-genes-individual",
      fillColor: bacteriaGeneColor,
      strokeColor: outlineColor,
      row: 1,
    });

    soda.tooltip({
      chart: this,
      annotations: aggregationResults.aggregated,
      selector: "bacteria-genes-aggregated",
      text: (d) => `aggregated group (${d.a.annotations.length})`,
    });

    soda.tooltip({
      chart: this,
      annotations: aggregationResults.individual,
      selector: "bacteria-genes-individual",
      text: (d) => `${d.a.name}`,
    });
  },
  postRender(): void {
    this.defaultPostRender();
    setChartHighlight(radialBacteriaChart, this);
  },
  postZoom(): void {
    clearTimeout(linearChartTimeoutId);
    linearChartTimeoutId = window.setTimeout(() => {
      this.render({
        ...this.renderParams,
        updateDomain: false,
      });
      addActiveAnnotationOutline();
    }, 500);

    setChartHighlight(radialBacteriaChart, this);
  },
});

let radialBacteriaChart = new soda.RadialChart<BacteriaRenderParams>({
  ...chartConfig,
  selector: "#vibes-mid",
  padSize: 50,
  divWidth: "50%",
  updateLayout() {},
  updateDomain(params) {
    if (params.updateDomain == true || params.updateDomain == undefined) {
      this.defaultUpdateDomain(params);
    }
  },
  draw(params) {
    this.addAxis();
    let thisCasted = <soda.RadialChart<BacteriaRenderParams>>this;
    soda.radialRectangle({
      chart: thisCasted,
      annotations: params.integrations,
      selector: "radial-bacteria-phages",
      fillColor: phageColor,
      strokeColor: outlineColor,
    });

    let aggregationResults = aggregateBacteriaGenes(this, params.genes);
    soda.radialRectangle({
      chart: thisCasted,
      annotations: aggregationResults.aggregated,
      selector: "bacteria-genes-aggregated",
      fillColor: bacteriaGeneGroupColor,
      strokeColor: outlineColor,
      row: 1,
    });

    soda.radialRectangle({
      chart: thisCasted,
      annotations: aggregationResults.individual,
      selector: "bacteria-genes-individual",
      fillColor: bacteriaGeneColor,
      strokeColor: outlineColor,
      row: 1,
    });

    soda.tooltip({
      chart: this,
      annotations: aggregationResults.aggregated,
      selector: "bacteria-genes-aggregated",
      text: (d) => `aggregated group (${d.a.annotations.length})`,
    });

    soda.tooltip({
      chart: this,
      annotations: aggregationResults.individual,
      selector: "bacteria-genes-individual",
      text: (d) => `${d.a.name}`,
    });
  },
  postRender(): void {
    this.defaultPostRender();
    setChartHighlight(linearBacteriaChart, this);
  },
  postZoom(): void {
    clearTimeout(radialChartTimeoutId);
    radialChartTimeoutId = window.setTimeout(() => {
      this.render({
        ...this.renderParams,
        updateDomain: false,
      });
      addActiveAnnotationOutline();
    }, 500);

    setChartHighlight(linearBacteriaChart, this);
  },
});

let occurrencesChart = new soda.Chart<VirusRenderParams>({
  ...chartConfig,
  selector: "#vibes-mid",
  divWidth: "50%",
  upperPadSize: 5,
  updateLayout() {},
  updateDimensions(params): void {
    let height =
      radialBacteriaChart.calculatePadHeight() -
      this.upperPadSize -
      this.lowerPadSize;
    this.rowHeight = height / occurrenceRows;
    this.defaultUpdateDimensions(params);
  },
  draw(params): void {
    let layout = soda.intervalGraphLayout(params.genes, 100);
    let geneRows = layout.rowCount + 1;
    let plotRows = occurrenceRows - geneRows;

    for (const id of layout.rowMap.keys()) {
      layout.rowMap.set(id, layout.rowMap.get(id)! + plotRows);
    }
    this.layout = layout;
    let horizontalAxisYOffset = 3;
    let horizontalAxisRowSpan = 2;
    soda.horizontalAxis({
      chart: this,
      selector: "occurrence-horizontal-axis",
      annotations: [params.occurrences],
      x: 0,
      y:
        this.rowHeight * (plotRows - horizontalAxisRowSpan) +
        horizontalAxisYOffset,
      width: this.viewportWidthPx,
      fixed: true,
      axisType: soda.AxisType.Bottom,
      target: this.overflowViewportSelection,
    });

    let maxValue = Math.max(...params.occurrences.values);
    soda.verticalAxis({
      chart: this,
      annotations: [params.occurrences],
      selector: "occurrence-vertical-axis",
      domain: [0, maxValue],
      target: this.overflowViewportSelection,
      x: 0,
      rowSpan: plotRows - horizontalAxisRowSpan,
      axisType: soda.AxisType.Left,
    });

    soda.linePlot({
      chart: this,
      annotations: [params.occurrences],
      selector: "occurrence-plot",
      domain: [maxValue, 0],
      strokeColor: outlineColor,
      rowSpan: plotRows - horizontalAxisRowSpan,
    });

    let occurrenceSlice = soda.slicePlotAnnotations({
      annotations: [params.occurrences],
      start: params.virusStart,
      end: params.virusEnd,
    })!.annotations[0];

    occurrenceSlice.id = "occurrence-slice";
    soda.area({
      chart: this,
      annotations: [occurrenceSlice!],
      domain: [maxValue, 0],
      strokeColor: occurrenceFillColor,
      selector: "occurrence-plot-slice",
      rowSpan: plotRows - horizontalAxisRowSpan,
      fillColor: occurrenceFillColor,
      fillOpacity: 0.25,
    });

    soda.rectangle({
      chart: this,
      annotations: params.genes,
      selector: "virus-genes",
      strokeColor: virusGeneColor,
      fillColor: virusGeneColor,
    });

    soda.clickBehavior({
      chart: this,
      annotations: params.genes,
      click: (s, d) => {
        let rowSelection = d3.select<HTMLElement, any>(`tr#row-${d.a.id}`);
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

    soda.tooltip({
      chart: this,
      annotations: params.genes,
      text: (d) => `${d.a.name}`,
    });
  },
  postResize(): void {
    if (this._renderParams) {
      this.divHeight = undefined;
      this.render(this._renderParams);
    } else {
      this.divHeight = radialBacteriaChart.divHeight;
    }
  },
});

function removeActiveAnnotationOutline() {
  if (activeAnnotation != undefined) {
    let glyphs = <d3.Selection<any, any, any, any>[]>(
      soda.queryGlyphMap({ annotations: [activeAnnotation] })
    );
    for (const glyph of glyphs) {
      glyph.style("stroke", outlineColor);
    }
  }
}

function addActiveAnnotationOutline() {
  if (activeAnnotation != undefined) {
    let glyphs = <d3.Selection<any, any, any, any>[]>(
      soda.queryGlyphMap({ annotations: [activeAnnotation] })
    );

    for (const glyph of glyphs) {
      glyph.style("stroke", occurrenceFillColor);
    }
  }
}

function setActiveAnnotation(annotation: IntegrationAnnotation) {
  removeActiveAnnotationOutline();
  activeAnnotation = annotation;
  addActiveAnnotationOutline();

  let phageName = annotation.phageName;
  let phageIdx = phageNames.indexOf(phageName);
  let phageLength = phageLengths[phageIdx];

  let integrations = integrationAnnotations.reduce<IntegrationAnnotation[]>(
    (acc, curr) => {
      let matches = curr.filter(
        (a: IntegrationAnnotation) => a.phageName == phageName
      );
      return acc.concat(matches);
    },
    []
  );

  let occurrences = new Array(phageLength).fill(0);
  for (const ann of integrations) {
    for (let i = ann.phageStart; i <= ann.phageEnd; i++) {
      occurrences[i]++;
    }
  }

  let occurrenceAnnotation = {
    id: "occurrence-plot",
    start: 0,
    end: phageLength,
    values: occurrences,
  };

  let params = {
    occurrences: occurrenceAnnotation,
    genes: virusGeneAnnotations[phageIdx],
    name: annotation.phageName,
    virusStart: annotation.phageStart,
    virusEnd: annotation.phageEnd,
    rowCount: occurrenceRows,
  };

  occurrencesChart.render(params);
  renderTable(params);
}

function renderTable(params: VirusRenderParams) {
  let tableSelection = d3.select("div#vibes-bottom").selectAll("*").remove();

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
    row.append("td").html(`${ann.start + ann.end}`);
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
      .attr("fill", geneAlignmentTopColor);

    let aliWidth = ((ann.modelEnd - ann.modelStart) / ann.modelLength) * 100;
    let aliX = (ann.modelStart / ann.modelLength) * 100;

    aliRow
      .append("rect")
      .attr("width", `${aliWidth}%`)
      .attr("height", "20%")
      .attr("x", `${aliX}%`)
      .attr("y", 10)
      .attr("fill", geneAlignmentBottomColor);
  });

  rows
    .selectAll("td")
    .style("border", "1px solid")
    .style("border-color", "#cccccc")
    .style("padding", "1px 0.5em");
}

function aggregateBacteriaGenes(
  chart: soda.Chart<any>,
  annotations: BacteriaGeneAnnotation[]
): {
  individual: BacteriaGeneAnnotation[];
  aggregated: soda.AnnotationGroup<BacteriaGeneAnnotation>[];
} {
  let domain = chart.xScale.domain();
  annotations = annotations.filter(
    (a) => a.start < domain[1] && a.end > domain[0]
  );

  let tolerance = 1000 / chart.transform.k;
  if (tolerance < 10) {
    return { individual: annotations, aggregated: [] };
  }
  let aggregated = soda.aggregateIntransitive({
    annotations,
    criterion: (a, b) =>
      a.start - tolerance < b.end && a.end + tolerance > b.start,
  });

  let individual = aggregated
    .filter((a) => a.annotations.length == 1)
    .map((a) => a.annotations[0]);

  aggregated = aggregated.filter((a) => a.annotations.length > 1);

  return { individual, aggregated };
}

function setChartHighlight(
  highlightedChart: soda.Chart<any>,
  representedChart: soda.Chart<any>
) {
  let domain = representedChart.xScale.domain();
  highlightedChart.highlight({
    start: domain[0],
    end: domain[1],
    selector: "bacteria-highlight",
  });
}

function clear() {
  activeAnnotation = undefined;
  d3.select("div#vibes-bottom").selectAll("*").remove();
  linearBacteriaChart.clear();
  radialBacteriaChart.clear();
  occurrencesChart.clear();
}

function render(bacteriaName: string) {
  clear();

  let bacteriaIdx = bacteriaNames.indexOf(bacteriaName);
  let integrations = integrationAnnotations[bacteriaIdx];
  let genes = bacteriaGeneAnnotations[bacteriaIdx];

  // we use the same render params for the linear & radial bacteria charts
  let bacteriaRenderParams = {
    integrations,
    genes,
    start: 0,
    end: bacteriaLengths[bacteriaIdx],
    rowCount: 2,
  };

  linearBacteriaChart.render(bacteriaRenderParams);
  radialBacteriaChart.render(bacteriaRenderParams);

  // hover behavior for highlighting phage annotations
  soda.hoverBehavior({
    annotations: integrations,
    mouseover(s): void {
      s.attr("fill", "maroon");
    },
    mouseout(s): void {
      s.attr("fill", "black");
    },
  });

  // click behavior for setting the active annotation
  soda.clickBehavior({
    annotations: integrations,
    click(s, d): void {
      setActiveAnnotation(d.a);
    },
  });

  // we'll just default to setting the first phage annotation as "active"
  setActiveAnnotation(integrationAnnotations[bacteriaIdx][0]);
}
