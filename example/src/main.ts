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
let bigColors = [
  "#f44336",
  "#e81e63",
  "#9c27b0",
  "#673ab7",
  "#3f51b5",
  "#2196f3",
  "#03a9f4",
  "#00bcd4",
  "#009688",
  "#4caf50",
  "#8bc34a",
  "#cddc39",
  "#ffeb3b",
  "#ffc107",
  "#ff9800",
  "#ff5722",
  "#795548",
  "#9e9e9e",
  "#607d8b",
  "#000000",
];
let outlineColor = colors[4];
let virusGeneColor = colors[0];
let occurrenceSelectedColor = colors[5];
let occurrenceRelatedColor = colors[3];
let bacteriaGeneColor = colors[1];
let bacteriaGeneGroupColor = colors[2];
let phageColor = colors[3];
let geneAlignmentTopColor = colors[0];
let geneAlignmentBottomColor = colors[1];

let linearChartTimeoutId: number | undefined;
let radialChartTimeoutId: number | undefined;

let selectedBacteria: string | undefined;
let selectedIntegration: IntegrationAnnotation | undefined;
let occurrenceBacteriaInclusionMap: Map<string, boolean> = new Map();

let occurrenceBacteriaSelectionExpanded = false;
let occurrenceMosaicEnabled = true;
let occurrenceRelatedEnabled = true;

interface IntegrationAnnotation extends soda.Annotation {
  // TODO: this needs bacteriaName
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

interface MosaicAnnotation extends soda.Annotation {
  bacteriaName: string;
  color: string;
  row: number;
}

interface BacteriaRenderParams extends soda.RenderParams {
  integrations: IntegrationAnnotation[];
  genes: BacteriaGeneAnnotation[];
  updateDomain?: boolean;
}

interface VirusRenderParams extends soda.RenderParams {
  occurrences: soda.PlotAnnotation;
  selected: soda.PlotAnnotation;
  related: soda.Annotation[];
  mosaic: MosaicAnnotation[];
  genes: VirusGeneAnnotation[];
  name: string;
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

  let clearButton = <HTMLButtonElement>document.getElementById("clear");

  clearButton.addEventListener("click", () => (inputForm.value = ""));

  //@ts-ignore
  autocomplete<BacteriaNameItem>({
    input: inputForm,
    emptyMsg: "No items found",
    minLength: 0,
    showOnFocus: true,
    disableAutoSelect: true,
    onSelect: (item: BacteriaNameItem, input: HTMLInputElement) => {
      // this function is called when the user clicks
      // on an element in the autocomplete list
      input.value = item.label;
      selectedBacteria = item.label;
      input.blur();
      render();
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
      addSelectedIntegrationOutline();
    }, 500);

    setChartHighlight(radialBacteriaChart, this);
  },
});

let radialBacteriaChart = new soda.RadialChart<BacteriaRenderParams>({
  ...chartConfig,
  selector: "#vibes-radial",
  padSize: 50,
  axisConfig: {
    tickSizeOuter: 10,
    tickPadding: 15,
  },
  updateLayout() {},
  updateDomain(params) {
    if (params.updateDomain == true || params.updateDomain == undefined) {
      this.defaultUpdateDomain(params);
    }
  },
  draw(params) {
    this.addAxis();
    let thisCasted = <soda.RadialChart<BacteriaRenderParams>>this;
    thisCasted.addTrackOutline();
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
      addSelectedIntegrationOutline();
    }, 500);

    setChartHighlight(linearBacteriaChart, this);
  },
});

let occurrencesChart = new soda.Chart<VirusRenderParams>({
  ...chartConfig,
  selector: "#vibes-occurrence",
  upperPadSize: 50,
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
    let geneLayout = soda.intervalGraphLayout(params.genes, 100);
    let relatedLayout = soda.intervalGraphLayout(params.related, 10);

    let geneRows = geneLayout.rowCount + 1;
    let relatedRows = relatedLayout.rowCount + 1;
    let plotRows = occurrenceRows - geneRows;

    for (const id of geneLayout.rowMap.keys()) {
      geneLayout.rowMap.set(id, geneLayout.rowMap.get(id)! + plotRows);
    }

    for (const id of relatedLayout.rowMap.keys()) {
      relatedLayout.rowMap.set(
        id,
        relatedLayout.rowMap.get(id)! + plotRows - relatedRows - 2
      );
    }

    let horizontalAxisYOffset = -2;
    let horizontalAxisRowSpan = 2;
    let verticalAxisRowSpan = plotRows - horizontalAxisRowSpan;
    let verticalAxisHeightPx = verticalAxisRowSpan * this.rowHeight;
    let numMosaicRows = Math.max(...params.mosaic.map((a) => a.row)) + 1;
    let mosaicRowHeight = verticalAxisHeightPx / numMosaicRows;

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
      rowSpan: verticalAxisRowSpan,
      axisType: soda.AxisType.Left,
    });

    soda.linePlot({
      chart: this,
      annotations: [params.occurrences],
      selector: "occurrence-plot",
      domain: [maxValue, 0],
      strokeColor: outlineColor,
      strokeWidth: 1.5,
      rowSpan: plotRows - horizontalAxisRowSpan,
    });

    soda.area({
      chart: this,
      annotations: [params.selected],
      domain: [maxValue, 0],
      strokeColor: occurrenceSelectedColor,
      selector: "occurrence-plot-selected",
      rowSpan: plotRows - horizontalAxisRowSpan,
      fillColor: occurrenceSelectedColor,
      fillOpacity: 0.25,
    });

    soda.rectangle({
      chart: this,
      annotations: params.related,
      selector: "occurrence-plot-related",
      fillColor: occurrenceRelatedColor,
      row: (d) => relatedLayout.row(d),
    });

    soda.rectangle({
      chart: this,
      annotations: params.mosaic,
      selector: "occurrence-plot-mosaic",
      fillColor: (d) => d.a.color,
      fillOpacity: 0.5,
      y: (d) => {
        return mosaicRowHeight * (numMosaicRows - d.a.row - 1);
      },
      height: mosaicRowHeight,
    });

    soda.rectangle({
      chart: this,
      annotations: params.genes,
      selector: "virus-genes",
      strokeColor: virusGeneColor,
      fillColor: virusGeneColor,
      row: (d) => geneLayout.row(d),
      height: this.rowHeight / 2,
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

function removeSelectedIntegrationOutline() {
  if (selectedIntegration != undefined) {
    let glyphs = <d3.Selection<any, any, any, any>[]>(
      soda.queryGlyphMap({ annotations: [selectedIntegration] })
    );
    for (const glyph of glyphs) {
      glyph.style("stroke", outlineColor);
    }
  }
}

function addSelectedIntegrationOutline() {
  if (selectedIntegration != undefined) {
    let glyphs = <d3.Selection<any, any, any, any>[]>(
      soda.queryGlyphMap({ annotations: [selectedIntegration] })
    );

    for (const glyph of glyphs) {
      glyph.style("stroke", occurrenceSelectedColor);
    }
  }
}

function setSelectedIntegration(annotation: IntegrationAnnotation) {
  removeSelectedIntegrationOutline();
  selectedIntegration = annotation;
  addSelectedIntegrationOutline();

  let phageName = selectedIntegration.phageName;

  // find the bacteria that have at least one integration of the selected phage
  let bacteriaNameSubset = bacteriaNames.filter((name) => {
    let bacteriaIdx = bacteriaNames.indexOf(name);
    let annotations = integrationAnnotations[bacteriaIdx];
    for (const ann of annotations) {
      if (ann.phageName == phageName) {
        return true;
      }
    }
    return false;
  });

  occurrenceBacteriaInclusionMap = new Map();
  for (const bacteriaName of bacteriaNameSubset) {
    occurrenceBacteriaInclusionMap.set(bacteriaName, true);
  }

  renderOccurrenceBacteriaSelection(bacteriaNameSubset);
  renderOccurrence();
}

function renderOccurrence() {
  if (selectedBacteria == undefined) {
    console.error(
      "selectedBacteria is undefined in call to renderOccurrence()"
    );
    return;
  }

  if (selectedIntegration == undefined) {
    console.error(
      "selectedIntegration is undefined in call to renderOccurrence()"
    );
    return;
  }

  let phageName = selectedIntegration.phageName;
  let phageIdx = phageNames.indexOf(phageName);
  let phageLength = phageLengths[phageIdx];

  // ----------------------
  // occurrence annotations
  // ----------------------

  // TODO: remove this once IntegrationAnnotaiton has bacteriaName
  type FillIntegrationAnnotation = IntegrationAnnotation & {
    bacteriaName: string;
  };

  // find the annotations for each integration of the selected phage
  //   - we search across integration annotations of each bacterial genome
  //   - we exclude bacterial genomes that are not in the inclusion map
  let integrations = integrationAnnotations.reduce<FillIntegrationAnnotation[]>(
    (accumulatedIntegrations, currentIntegrations, bacteriaIdx) => {
      let bacteriaName = bacteriaNames[bacteriaIdx];
      if (occurrenceBacteriaInclusionMap.get(bacteriaName) == true) {
        let matches = currentIntegrations.filter(
          (a: IntegrationAnnotation) => a.phageName == phageName
        );

        let fillAnnotations = matches.map((match) => {
          return {
            ...match,
            bacteriaName,
          };
        });

        return accumulatedIntegrations.concat(fillAnnotations);
      } else {
        return accumulatedIntegrations;
      }
    },
    []
  );

  let occurrenceValues = new Array(phageLength).fill(0);
  for (const ann of integrations) {
    for (let i = ann.phageStart; i <= ann.phageEnd; i++) {
      occurrenceValues[i]++;
    }
  }

  let occurrences: soda.PlotAnnotation = {
    id: "occurrence-plot",
    start: 0,
    end: phageLength,
    values: occurrenceValues,
  };

  let selected: soda.PlotAnnotation = soda.slicePlotAnnotations({
    annotations: [occurrences],
    start: selectedIntegration.phageStart,
    end: selectedIntegration.phageEnd,
  })!.annotations[0];

  selected.id = "selected-occurrence-integration";

  // -------------------
  // related annotations
  // -------------------
  let related: soda.Annotation[] = [];
  if (occurrenceRelatedEnabled) {
    let selectedBacteriaIdx = bacteriaNames.indexOf(selectedBacteria);

    let relatedIntegrations = integrationAnnotations[
      selectedBacteriaIdx
    ].filter((a) => a.phageName == phageName && a != selectedIntegration);

    related = relatedIntegrations.map((a) => {
      return {
        id: a.id,
        start: a.phageStart,
        end: a.phageEnd,
      };
    });
  }

  // ------------------
  // mosaic annotations
  // ------------------
  let mosaic: MosaicAnnotation[] = [];
  if (occurrenceMosaicEnabled) {
    let involvedBacteriaNames: string[] = Array.from(
      occurrenceBacteriaInclusionMap.entries()
    )
      // filter for every entry in the map that is set to true
      .filter((e) => e[1])
      // retrieve the keys for those filtered entries
      .map((e) => e[0]);

    // if we had an occurrence plot that looked like this:
    //          ________
    //         |        |        ------
    //         |        |_______|      |
    //  _______|                       |
    // |                               |
    // ^       ^        ^       ^      ^
    // these would be the slice points ^
    // i.e. everywhere we have a vertical line
    let mosaicSlicePoints: number[] = [];
    let prevVal = -1;
    for (const [i, val] of occurrenceValues.entries()) {
      if (prevVal != val) {
        mosaicSlicePoints.push(i);
      }
      prevVal = val;
    }

    // [slice index][bacteria index][annotations]
    let mosaicAnnotations3D: MosaicAnnotation[][][] = [];
    for (let i = 1; i < mosaicSlicePoints.length; i++) {
      // [bacteria index][annotations]
      let mosaicColumn: MosaicAnnotation[][] = [];

      for (const b of involvedBacteriaNames) {
        mosaicColumn.push([]);
      }

      let [start, end] = [mosaicSlicePoints[i - 1], mosaicSlicePoints[i]];

      // if we were working between these slice points
      //         v        v
      //          ________
      //         |[=ann1=]|        ------
      //         |[=ann2=]|_______|      |
      //  _______|[=ann3======]          |
      // |[=========ann4========]        |
      //             ^
      // these would be overlapping
      let overlapping = integrations.filter(
        (a) => a.phageStart < end && a.phageEnd > start
      );

      //          ________
      //         |[=ann1=]|        ------
      //         |[=ann2=]|_______|      |
      //  _______|[=ann3=][xxx]          |
      // |[xxxxxx][=ann4=][xxxxx]        |
      //             ^
      // these would be mosaicColumn
      for (const ann of overlapping) {
        let bacteriaIdx = involvedBacteriaNames.indexOf(ann.bacteriaName);
        mosaicColumn[bacteriaIdx].push({
          id: ann.id,
          bacteriaName: ann.bacteriaName,
          start: Math.max(ann.phageStart, start),
          end: Math.min(ann.phageEnd, end),
          color: "",
          row: 0,
        });
      }
      mosaicAnnotations3D.push(mosaicColumn);
    }

    let bacteriaColors = [];
    let colorIdx = 0;
    for (const bacteriaName of involvedBacteriaNames) {
      bacteriaColors.push(bigColors[colorIdx & bigColors.length]);
      colorIdx++;
    }

    // lay out the mosaic annotations in each column so that annotations
    // from the same bacteria are always next to each other vertically
    for (const column of mosaicAnnotations3D) {
      let row = 0;
      for (
        let bacteriaIdx = 0;
        bacteriaIdx < involvedBacteriaNames.length;
        bacteriaIdx++
      ) {
        for (const ann of column[bacteriaIdx]) {
          ann.row = row++;
          ann.color = bacteriaColors[bacteriaIdx];
        }
      }
    }

    mosaic = mosaicAnnotations3D.flat(3);
  }

  let params = {
    start: 0,
    end: phageLength,
    occurrences,
    selected,
    related,
    mosaic,
    genes: virusGeneAnnotations[phageIdx],
    name: selectedIntegration.phageName,
    virusStart: selectedIntegration.phageStart,
    virusEnd: selectedIntegration.phageEnd,
    rowCount: occurrenceRows,
  };

  occurrencesChart.render(params);
  renderTable(params);
}

function renderTable(params: VirusRenderParams) {
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

bindButtonListeners();

function bindButtonListeners() {
  d3.select("button#vibes-occurrence-expand-button")
    .html(() => {
      if (occurrenceBacteriaSelectionExpanded) {
        return "－";
      } else {
        return "＋";
      }
    })
    .on("click", toggleOccurrenceControls);

  d3.select("button#vibes-occurrence-select-all-button").on("click", () =>
    toggleAllOccurrenceBacteriaSelections(true)
  );

  d3.select("button#vibes-occurrence-select-none-button").on("click", () =>
    toggleAllOccurrenceBacteriaSelections(false)
  );

  let mosaicToggle = d3.select<HTMLInputElement, any>(
    "input#vibes-occurrence-mosaic-toggle"
  );
  mosaicToggle.on("change", () => {
    occurrenceMosaicEnabled = mosaicToggle.node()!.checked;
    renderOccurrence();
  });

  let relatedToggle = d3.select<HTMLInputElement, any>(
    "input#vibes-occurrence-related-toggle"
  );
  relatedToggle.on("change", () => {
    occurrenceRelatedEnabled = relatedToggle.node()!.checked;
    renderOccurrence();
  });
}

function toggleOccurrenceControls() {
  let buttonSelection = d3.select("button#vibes-occurrence-expand-button");
  let outerSelection = d3.select("#vibes-occurrence-select");

  occurrenceBacteriaSelectionExpanded = !occurrenceBacteriaSelectionExpanded;

  if (occurrenceBacteriaSelectionExpanded) {
    buttonSelection.html("－");
    outerSelection
      .transition()
      .duration(100)
      .style("height", "500px")
      .style("width", "500px");
  } else {
    buttonSelection.html("＋");
    outerSelection
      .transition()
      .duration(100)
      .style("height", "29px")
      .style("width", "34px");
  }
}

function toggleAllOccurrenceBacteriaSelections(state: boolean) {
  for (const bacteriaName of occurrenceBacteriaInclusionMap.keys()) {
    occurrenceBacteriaInclusionMap.set(bacteriaName, state);
  }
  d3.select("div#vibes-occurrence-select-inner")
    .selectAll<any, string>("div.selection")
    .style("font-weight", (d) =>
      occurrenceBacteriaInclusionMap.get(d) == true ? "bold" : "normal"
    );
  renderOccurrence();
}

function renderOccurrenceBacteriaSelection(names: string[]) {
  let innerSelection = d3.select("div#vibes-occurrence-select-inner");
  innerSelection.selectAll("div.selection").remove();

  innerSelection
    .selectAll("div.selection")
    .data(names)
    .enter()
    .append("div")
    .attr("class", "selection")
    .html((d) => d)
    .style("margin-top", "5px")
    .style("font-weight", (d) =>
      occurrenceBacteriaInclusionMap.get(d) == true ? "bold" : "normal"
    )
    .on("mouseover", (d, i, nodes) => {
      d3.select(nodes[i]).style("background-color", "cadetblue");
    })
    .on("mouseout", (d, i, nodes) => {
      d3.select(nodes[i]).style("background-color", "white");
    })
    .on("mousedown", (d, i, nodes) => {
      occurrenceBacteriaInclusionMap.set(
        d,
        !occurrenceBacteriaInclusionMap.get(d)
      );
      d3.select(nodes[i]).style("font-weight", () =>
        occurrenceBacteriaInclusionMap.get(d) == true ? "bold" : "normal"
      );
      renderOccurrence();
    });
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
  selectedIntegration = undefined;
  d3.select("div#vibes-bottom").selectAll("*").remove();
  linearBacteriaChart.clear();
  radialBacteriaChart.clear();
  occurrencesChart.clear();
}

function render() {
  clear();

  if (selectedBacteria == undefined) {
    console.error("selectedBacteria is undefined in call to render()");
    return;
  }

  let bacteriaIdx = bacteriaNames.indexOf(selectedBacteria);
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
      setSelectedIntegration(d.a);
    },
  });

  // we'll just default to setting the first phage annotation as "active"
  setSelectedIntegration(integrationAnnotations[bacteriaIdx][0]);
}
