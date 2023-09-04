import * as soda from "@sodaviz/soda";
import autocomplete from "autocompleter";
import * as d3 from "d3";

interface DensityAnnotation extends soda.Annotation {
  value: number;
}

interface IntegrationAnnotation extends soda.Annotation {
  bacteriaName: string;
  virusName: string;
  virusStart: number;
  virusEnd: number;
  strand: string;
  evalue: number;
}

interface BacterialGeneAnnotation extends soda.Annotation {
  strand: string;
  name: string;
}

interface ViralGeneAnnotation extends soda.Annotation {
  name: string;
  modelStart: number;
  modelEnd: number;
  modelLength: number;
  strand: string;
  evalue: number;
}

interface BacteriaRenderParams extends soda.RenderParams {
  integrations: IntegrationAnnotation[];
  genes: BacterialGeneAnnotation[];
  updateDomain?: boolean;
  layout: soda.VerticalLayout;
  integrationRows: number;
  geneRows: number;
}

interface VirusRenderParams extends soda.RenderParams {
  occurrences: soda.PlotAnnotation;
  selected: soda.PlotAnnotation;
  related: soda.Annotation[];
  genes: ViralGeneAnnotation[];
  name: string;
}

interface BacteriaNameItem {
  label: string;
  group: string;
}

function buildAnnotations(
  integrationsData: any,
  bacterialGeneData: any,
  viralGeneData: any,
  virusLengths: number[],
  occurrenceData: any,
) {
  let bacteriaSeqNames = [];
  let virusNames = [];
  let integrationAnnotations = [];
  let bacterialGeneAnnotations = [];
  let viralGeneAnnotations = [];
  let occurrenceAnnotations = [];

  let idCount = 0;

  let annList = [];
  for (const seqName in integrationsData) {
    annList = [];
    bacteriaSeqNames.push(seqName);

    let integrationObj = integrationsData[seqName];
    let numAnn = integrationObj["starts"].length;
    for (let i = 0; i < numAnn; i++) {
      annList.push({
        id: `${idCount++}`,
        start: integrationObj["starts"][i],
        end: integrationObj["ends"][i],
        bacteriaName: "TEMPTEMP",
        virusName: integrationObj["virusNames"][i],
        virusStart: integrationObj["virusStarts"][i],
        virusEnd: integrationObj["virusEnds"][i],
        strand: integrationObj["strands"][i],
        evalue: integrationObj["evalues"][i],
      });
    }

    integrationAnnotations.push(annList);

    let bacterialGeneObj = bacterialGeneData[seqName];

    annList = [];
    numAnn = bacterialGeneObj["starts"].length;
    for (let i = 0; i < numAnn; i++) {
      annList.push({
        id: `${idCount++}`,
        start: bacterialGeneObj["starts"][i],
        end: bacterialGeneObj["ends"][i],
        strand: bacterialGeneObj["strands"][i],
        name: bacterialGeneObj["labels"][i],
      });
    }
    bacterialGeneAnnotations.push(annList);
  }

  for (const virusName in viralGeneData) {
    virusNames.push(virusName);

    annList = [];
    let viralGeneObj = viralGeneData[virusName];
    let numAnn = viralGeneObj["starts"].length;
    for (let i = 0; i < numAnn; i++) {
      annList.push({
        id: `${idCount++}`,
        start: viralGeneObj["starts"][i],
        end: viralGeneObj["ends"][i],
        modelStart: viralGeneObj["modelStarts"][i],
        modelEnd: viralGeneObj["modelEnds"][i],
        modelLength: viralGeneObj["modelLengths"][i],
        name: viralGeneObj["labels"][i],
        strand: viralGeneObj["strands"][i],
        evalue: viralGeneObj["evalues"][i],
      });
    }
    viralGeneAnnotations.push(annList);

    let occurrenceObj = occurrenceData[virusName];

    let virusLength = virusLengths[virusNames.length - 1];
    // ------------------------------------- + 1 for 1-based indexing
    let occurrenceValues = Array(virusLength + 1).fill(0);
    numAnn = occurrenceObj["starts"].length;
    for (let i = 0; i < numAnn; i++) {
      let start = occurrenceObj["starts"][i];
      let end = occurrenceObj["ends"][i];
      if (end > virusLength) {
        console.log(
          "virus length error:",
          virusName,
          `${end} > ${virusLength}`,
        );
      }
      for (let pos = start; pos <= end; pos++) {
        occurrenceValues[pos]++;
      }
    }
    occurrenceAnnotations.push({
      id: "occurrence-plot",
      start: 0,
      end: virusLength,
      values: occurrenceValues,
    });
  }

  return {
    bacteriaSeqNames,
    virusNames,
    integrationAnnotations,
    viralGeneAnnotations,
    bacterialGeneAnnotations,
    occurrenceAnnotations,
  };
}

export function run(
  bacteriaName: string,
  bacteriaNames: string[],
  // {bacteriaSeqName: {starts: [], ends: [], ...} ...}
  integrationData: any,
  // {bacteriaSeqName: {starts: [], ends: [], ...} ...}
  bacterialGeneData: any,
  // {virusName: {starts: [], ends: [], ...} ...}
  viralGeneData: any,
  // [<L1>, <L2>, ...]
  bacteriaSequenceLengths: any,
  // [<L1>, <L2>, ...]
  virusLengths: any,
  // {virusName: {starts: [], ends: []}, ...}
  occurrenceData: any,
) {
  let params = buildAnnotations(
    integrationData,
    bacterialGeneData,
    viralGeneData,
    virusLengths,
    occurrenceData,
  );

  let bacteriaSequenceNames = params.bacteriaSeqNames;
  let virusNames = params.virusNames;
  let integrationAnnotations = params.integrationAnnotations;
  let virusGeneAnnotations = params.viralGeneAnnotations;
  let bacteriaGeneAnnotations = params.bacterialGeneAnnotations;
  let occurrenceAnnotations = params.occurrenceAnnotations;

  let occurrenceRows = 30;
  let colors = [
    "#ad5252",
    "#496279",
    "#afc7d9",
    "#e7a865",
    "#343434",
    "#65bac6",
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

  let selectedSequence: string | undefined;
  let selectedIntegration: IntegrationAnnotation | undefined;

  let occurrenceRelatedEnabled = true;

  function populateBacteriaList() {
    const items: BacteriaNameItem[] = bacteriaNames.map((name: string) => {
      return { label: name, group: "Bacteria" };
    });

    let inputForm = <HTMLInputElement>(
      document.getElementById("bacteria-selection")
    );
    let inputLabel = <HTMLSpanElement>document.getElementById("bacteria-label");

    inputLabel.innerHTML = `Bacteria: ${bacteriaName}`;

    autocomplete<BacteriaNameItem>({
      input: inputForm,
      emptyMsg: "No items found",
      minLength: 0,
      showOnFocus: true,
      disableAutoSelect: true,
      onSelect: (item: BacteriaNameItem, _) => {
        window.location.href = `./${item.label}.html`;
      },
      fetch: (text: string, update: Function) => {
        text = text.toLowerCase();
        let suggestions = items.filter(
          (i: BacteriaNameItem) => i.label.toLowerCase().indexOf(text) !== -1,
        );
        update(suggestions);
      },
    });
  }

  function populateSequenceList() {
    const items: BacteriaNameItem[] = bacteriaSequenceNames.map(
      (name: string) => {
        return { label: name, group: "Sequence" };
      },
    );

    let inputForm = <HTMLInputElement>document.getElementById("seq-selection");

    autocomplete<BacteriaNameItem>({
      input: inputForm,
      emptyMsg: "No items found",
      minLength: 0,
      showOnFocus: true,
      disableAutoSelect: true,
      onSelect: (item: BacteriaNameItem, _) => {
        selectSequence(item.label);
      },
      fetch: (text: string, update: Function) => {
        text = text.toLowerCase();
        let suggestions = items.filter(
          (i: BacteriaNameItem) => i.label.toLowerCase().indexOf(text) !== -1,
        );
        update(suggestions);
      },
    });
  }

  function selectSequence(sequenceName: string) {
    let inputLabel = <HTMLSpanElement>document.getElementById("seq-label");
    inputLabel.innerHTML = `Sequence: ${sequenceName}`;
    selectedSequence = sequenceName;
    render();
  }

  populateBacteriaList();
  populateSequenceList();

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
        selector: "linear-bacteria-phages",
        fillColor: phageColor,
        strokeColor: phageColor,
      });

      let { density, filteredGenes } = aggregateBacteriaGenes(
        this,
        params.genes,
      );

      soda.rectangle({
        chart: this,
        annotations: density,
        selector: "bacteria-genes-aggregated",
        fillColor: bacteriaGeneGroupColor,
        fillOpacity: (d) => d.a.value,
        row: params.integrationRows,
        height: this.rowHeight * params.geneRows,
      });

      soda.rectangle({
        chart: this,
        annotations: filteredGenes,
        selector: "bacteria-genes",
        fillColor: bacteriaGeneColor,
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
    trackHeightRatio: 0.15,
    axisConfig: {
      tickSizeOuter: 10,
      tickPadding: 15,
    },
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
      let thisCasted = <soda.RadialChart<BacteriaRenderParams>>this;
      // thisCasted.addTrackOutline();

      soda.radialRectangle({
        chart: thisCasted,
        annotations: params.integrations,
        selector: "linear-bacteria-phages",
        fillColor: phageColor,
      });

      let { density, filteredGenes } = aggregateBacteriaGenes(
        this,
        params.genes,
      );

      soda.radialRectangle({
        chart: thisCasted,
        annotations: density,
        selector: "bacteria-genes-aggregated",
        fillColor: bacteriaGeneGroupColor,
        fillOpacity: (d) => d.a.value,
        row: params.integrationRows,
        height: this.rowHeight * params.geneRows,
      });

      soda.radialRectangle({
        chart: thisCasted,
        annotations: filteredGenes,
        selector: "bacteria-genes",
        fillColor: bacteriaGeneColor,
      });

      soda.tooltip({
        annotations: filteredGenes,
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
          relatedLayout.rowMap.get(id)! + plotRows - relatedRows - 2,
        );
      }

      let horizontalAxisYOffset = -2;
      let horizontalAxisRowSpan = 2;
      let verticalAxisRowSpan = plotRows - horizontalAxisRowSpan;

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
        fillOpacity: 0.5,
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
        click: (_, d) => {
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
        glyph.style("stroke", "none");
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

    renderOccurrence();
  }

  function renderOccurrence() {
    if (selectedSequence == undefined) {
      console.error(
        "selectedBacteria is undefined in call to renderOccurrence()",
      );
      return;
    }

    if (selectedIntegration == undefined) {
      console.error(
        "selectedIntegration is undefined in call to renderOccurrence()",
      );
      return;
    }

    let phageName = selectedIntegration.virusName;
    let phageIdx = virusNames.indexOf(phageName);
    let phageLength = virusLengths[phageIdx];
    let occurrences = occurrenceAnnotations[phageIdx];

    let selected: soda.PlotAnnotation = soda.slicePlotAnnotations({
      annotations: [occurrences],
      start: selectedIntegration.virusStart,
      end: selectedIntegration.virusEnd,
    })!.annotations[0];

    selected.id = "selected-occurrence-integration";

    // -------------------
    // related annotations
    // -------------------
    let related: soda.Annotation[] = [];
    if (occurrenceRelatedEnabled) {
      let selectedBacteriaIdx = bacteriaSequenceNames.indexOf(selectedSequence);

      let relatedIntegrations = integrationAnnotations[
        selectedBacteriaIdx
      ].filter((a) => a.virusName == phageName && a != selectedIntegration);

      related = relatedIntegrations.map((a) => {
        return {
          id: a.id,
          start: a.virusStart,
          end: a.virusEnd,
        };
      });
    }

    let params = {
      start: 0,
      end: phageLength,
      occurrences,
      selected,
      related,
      genes: virusGeneAnnotations[phageIdx],
      name: selectedIntegration.virusName,
      virusStart: selectedIntegration.virusStart,
      virusEnd: selectedIntegration.virusEnd,
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

  function aggregateBacteriaGenes(
    chart: soda.Chart<any>,
    genes: BacterialGeneAnnotation[],
  ): {
    density: DensityAnnotation[];
    filteredGenes: BacterialGeneAnnotation[];
  } {
    let domainWidth = chart.domain[1] - chart.domain[0];
    let filteredGenes: BacterialGeneAnnotation[] = [];
    let density: DensityAnnotation[] = [];
    if (domainWidth > 1000000) {
      let chunkWidth = domainWidth / 10;
      for (let i = 0; i < 10; i++) {
        let start = chart.domain[0] + i * chunkWidth;
        let end = chart.domain[0] + (i + 1) * chunkWidth;
        let value =
          genes
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
      filteredGenes = genes.filter(
        (a) => a.start <= chart.domain[1] && a.end >= chart.domain[0],
      );
    }
    return { density, filteredGenes };
  }

  function setChartHighlight(
    highlightedChart: soda.Chart<any>,
    representedChart: soda.Chart<any>,
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

    if (selectedSequence == undefined) {
      console.error("selectedBacteria is undefined in call to render()");
      return;
    }

    let bacteriaIdx = bacteriaSequenceNames.indexOf(selectedSequence);
    let integrations = integrationAnnotations[bacteriaIdx];
    let genes = bacteriaGeneAnnotations[bacteriaIdx];

    let integrationLayout = soda.intervalGraphLayout(integrations, 100);
    let integrationRows = integrationLayout.rowCount;

    let geneLayout = soda.intervalGraphLayout(genes, 100);
    let geneRows = geneLayout.rowCount;

    integrationLayout.rowCount += geneRows;

    // combine the layouts
    for (const gene of genes) {
      integrationLayout.rowMap.set(
        gene.id,
        geneLayout.rowMap.get(gene.id)! + integrationRows,
      );
    }

    // we use the same render params for the linear & radial bacteria charts
    let bacteriaRenderParams = {
      integrations,
      genes,
      start: 0,
      end: bacteriaSequenceLengths[bacteriaIdx],
      layout: integrationLayout,
      integrationRows,
      geneRows,
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
      click(_, d): void {
        setSelectedIntegration(d.a);
      },
    });

    soda.tooltip({
      annotations: integrations,
      text: (d) => `${d.a.virusName} ${d.a.virusStart} : ${d.a.virusEnd}`,
    });

    // we'll just default to setting the first phage annotation as "active"
    setSelectedIntegration(integrationAnnotations[bacteriaIdx][0]);
  }

  selectSequence(bacteriaSequenceNames[0]);
}
