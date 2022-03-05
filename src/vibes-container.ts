import * as d3 from "d3";
import * as soda from "@sodaviz/soda";

import {
  VibesBacteriaAnnotationRecord,
  VibesBacteriaGeneAnnotationRecord,
  VibesVirusPlotRecord,
} from "./vibes-records";
import {
  VibesBacteriaAnnotation,
  VibesBacteriaAnnotationConfig,
  VibesBacteriaGeneAnnotation,
  VibesBacteriaGeneAnnotationConfig,
  VibesVirusAnnotation,
  VibesVirusAnnotationConfig,
} from "./vibes-annotations";

export interface VibesContainerConfig {
  selector: string;
}

interface VibesContainerRenderParams {
  phageAnnotations: VibesBacteriaAnnotation[];
  geneAnnotations: VibesBacteriaGeneAnnotation[];
}

interface VibesBacteriaChartRenderParams extends soda.RenderParams {
  annotations: VibesBacteriaAnnotation[];
  genes: VibesBacteriaGeneAnnotation[];
}

interface VibesOccurrenceChartRenderParams extends soda.RenderParams {
  annotations: VibesVirusAnnotation[];
  occurrences: soda.ContinuousAnnotation;
  name: string;
  virusStart: number;
  virusEnd: number;
}

export class VibesContainer {
  linearBacteriaChart: soda.Chart<VibesBacteriaChartRenderParams>;
  radialBacteriaChart: soda.Contrib.RadialChart<VibesBacteriaChartRenderParams>;
  occurrencesChart: soda.Chart<VibesOccurrenceChartRenderParams>;
  occurrencesCache: VibesOccurrenceChartRenderParams[] = [];
  charts: soda.Chart<any>[] = [];
  tableSelection: d3.Selection<any, any, any, any>;
  activeAnnotation: VibesBacteriaAnnotation | undefined;
  linearChartTimeoutId: number | undefined;
  radialChartTimeoutId: number | undefined;
  occurrenceRows = 30;
  occurrenceGeneColor = d3.schemeCategory10[3];
  occurrenceFillColor = d3.schemeCategory10[9];
  bacteriaGeneColor = d3.schemeCategory10[0];
  bacteriaGeneGroupColor = d3.schemeCategory10[1];
  phageColor = d3.schemeCategory10[5];
  geneAlignmentTopColor = d3.schemeCategory10[4];
  geneAlignmentBottomColor = d3.schemeCategory10[2];

  public constructor(config: VibesContainerConfig) {
    let outerDivSelection = d3.select(config.selector);

    outerDivSelection.append("div").attr("id", "vibes-top");

    outerDivSelection
      .append("div")
      .attr("id", "vibes-mid")
      .style("display", "flex");

    outerDivSelection.append("div").attr("id", "vibes-bottom");

    let chartConfig = {
      zoomable: true,
      resizable: true,
      divOutline: "1px solid black",
      lowerPadSize: 5,
      rowHeight: 16,
    };

    let container = this;
    this.linearBacteriaChart = new soda.Chart({
      ...chartConfig,
      axisType: soda.AxisType.Bottom,
      upperPadSize: 20,
      leftPadSize: 0,
      rightPadSize: 0,
      selector: "#vibes-top",
      inRender(params): void {
        soda.rectangle({
          chart: this,
          annotations: params.annotations,
          selector: "linear-bacteria-phages",
        });

        let aggregationResults = aggregateBacteriaGenes(this, params.genes);
        soda.rectangle({
          chart: this,
          annotations: aggregationResults.aggregated,
          selector: "bacteria-genes-aggregated",
          fillColor: container.bacteriaGeneGroupColor,
        });

        soda.rectangle({
          chart: this,
          annotations: aggregationResults.individual,
          selector: "bacteria-genes-individual",
          fillColor: container.bacteriaGeneColor,
        });

        soda.tooltip({
          chart: this,
          annotations: aggregationResults.aggregated,
          selector: "bacteria-genes-aggregated-internal",
          text: (d) => `aggregated group (${d.a.group.length})`,
        });

        soda.tooltip({
          chart: this,
          annotations: aggregationResults.individual,
          selector: "bacteria-genes-individual-internal",
          text: (d) => `${d.a.alias}`,
        });
      },
      postRender(): void {
        this.defaultPostRender();
        setChartHighlight(container.radialBacteriaChart, this);
      },
      postZoom(): void {
        clearTimeout(container.linearChartTimeoutId);
        container.linearChartTimeoutId = setTimeout(() => {
          this.render({
            ...this.renderParams,
            initializeXScale: false,
          });
          container.addActiveAnnotationOutline();
        }, 500);

        setChartHighlight(container.radialBacteriaChart, this);
      },
    });

    this.radialBacteriaChart = new soda.Contrib.RadialChart({
      ...chartConfig,
      axisType: soda.AxisType.Top,
      selector: "#vibes-mid",
      padSize: 50,
      divWidth: "50%",
      inRender(params): void {
        let thisCasted = <
          soda.Contrib.RadialChart<VibesBacteriaChartRenderParams>
          >this;
        soda.Contrib.radialRectangle({
          chart: thisCasted,
          annotations: params.annotations,
          selector: "radial-bacteria-phages",
        });

        let aggregationResults = aggregateBacteriaGenes(this, params.genes);
        soda.Contrib.radialRectangle({
          chart: thisCasted,
          annotations: aggregationResults.aggregated,
          selector: "bacteria-genes-aggregated",
          fillColor: container.bacteriaGeneGroupColor,
        });

        soda.Contrib.radialRectangle({
          chart: thisCasted,
          annotations: aggregationResults.individual,
          selector: "bacteria-genes-individual",
          fillColor: container.bacteriaGeneColor,
        });

        soda.tooltip({
          chart: this,
          annotations: aggregationResults.aggregated,
          selector: "bacteria-genes-aggregated-internal",
          text: (d) => `aggregated group (${d.a.group.length})`,
        });

        soda.tooltip({
          chart: this,
          annotations: aggregationResults.individual,
          selector: "bacteria-genes-individual-internal",
          text: (d) => `${d.a.alias}`,
        });
      },
      postRender(): void {
        this.defaultPostRender();
        setChartHighlight(container.linearBacteriaChart, this);
      },
      postZoom(): void {
        clearTimeout(container.radialChartTimeoutId);
        container.radialChartTimeoutId = setTimeout(() => {
          this.render({
            ...this.renderParams,
            initializeXScale: false,
          });
          container.addActiveAnnotationOutline();
        }, 500);

        setChartHighlight(container.linearBacteriaChart, this);
      },
    });

    this.occurrencesChart = new soda.Chart({
      ...chartConfig,
      selector: "#vibes-mid",
      divWidth: "50%",
      upperPadSize: 5,
      preRender(params): void {
        let height =
          container.radialBacteriaChart.padHeight -
          this.upperPadSize -
          this.lowerPadSize;
        this.rowHeight = height / container.occurrenceRows;
        this.defaultPreRender(params);
      },
      inRender(params): void {
        let geneRows = soda.intervalGraphLayout(params.annotations, 100) + 1;
        let plotRows = container.occurrenceRows - geneRows;
        for (const ann of params.annotations) {
          ann.row += plotRows;
        }

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
          width: this.viewportWidth,
          fixed: true,
          axisType: soda.AxisType.Bottom,
          target: this.overflowViewportSelection,
        });

        soda.verticalAxis({
          chart: this,
          annotations: [params.occurrences],
          selector: "occurrence-vertical-axis",
          target: this.overflowViewportSelection,
          x: 0,
          rowSpan: plotRows - horizontalAxisRowSpan,
          axisType: soda.AxisType.Left,
          domain: (d) => [d.a.maxValue, 0],
        });

        soda.linePlot({
          chart: this,
          annotations: [params.occurrences],
          selector: "occurrence-plot",
          rowSpan: plotRows - horizontalAxisRowSpan,
        });

        let occurrenceSlice = soda.Contrib.sliceContinuousAnnotation(
          params.occurrences,
          params.virusStart,
          params.virusEnd
        );

        occurrenceSlice!.id = "occurrence-slice";
        soda.linePlot({
          chart: this,
          annotations: [occurrenceSlice!],
          strokeColor: container.occurrenceFillColor,
          selector: "occurrence-plot-slice",
          rowSpan: plotRows - horizontalAxisRowSpan,
          domain: [0, params.occurrences.maxValue],
          lowerFillColor: container.occurrenceFillColor,
          lowerFillOpacity: 0.25,
        });

        soda.rectangle({
          chart: this,
          annotations: params.annotations,
          selector: "virus-genes",
          strokeColor: container.occurrenceGeneColor,
          fillColor: container.occurrenceGeneColor,
        });
        
        soda.clickBehavior({
          chart: this,
          annotations: params.annotations,
          click: (s, d) => {
            let rowSelection = d3.select<HTMLElement, any>(`tr#row-${d.a.id}`);
            let rowElement = rowSelection
              .node();
            if (rowElement == undefined) {
              throw(`Table row element on ${d.a.id} is null or undefined`);
            } else {
              rowElement
                .scrollIntoView(false);
              rowSelection
                .style('background-color', 'yellow');
              rowSelection
                .interrupt()
                .transition()
                .duration(2000)
                .style('background-color', null);
            }
          }
        });
        
        soda.tooltip({
          chart: this,
          annotations: params.annotations,
          text: (d) => `${d.a.name}`,
        });
      },
      postResize(): void {
        if (this._renderParams) {
          this.divHeight = undefined;
          this.render(this._renderParams);
        } else {
          this.divHeight = container.radialBacteriaChart.divHeight;
          this.updateDivProperties();
        }
      },
    });
    this.charts = [this.linearBacteriaChart, this.radialBacteriaChart, this.occurrencesChart];
    this.tableSelection = d3.select("div#vibes-bottom").append("div");
  }

  public clear() {
    this.occurrencesCache = [];
    this.activeAnnotation = undefined;
    this.tableSelection.selectAll("*").remove();
    for (const chart of this.charts) {
      chart.clear();
    }
  }

  async query(bacteriaName: string) {
    this.clear();
    let phageRecords = await fetch(
      `https://sodaviz.org/vibesBacteria/${bacteriaName}/range?start=0&end=0`
    )
      .then((response) => response.text())
      .then((text) => <VibesBacteriaAnnotationRecord[]>JSON.parse(text))
      .then((records) =>
        records.sort((a, b) => (a.bacteria_start > b.bacteria_start ? 1 : -1))
      );

    let geneRecords = await fetch(
      `https://sodaviz.org/vibesBacteriaGenes/${bacteriaName}/range?start=0&end=0`
    )
      .then((response) => response.text())
      .then((text) => <VibesBacteriaGeneAnnotationRecord[]>JSON.parse(text));

    let phageAnnotations: VibesBacteriaAnnotation[] = phageRecords.map((r) => {
      let start, end;
      if (r.bacteria_end > r.bacteria_start) {
        start = r.bacteria_start;
        end = r.bacteria_end;
      } else {
        start = r.bacteria_end;
        end = r.bacteria_start;
      }
      let conf: VibesBacteriaAnnotationConfig = {
        start,
        end,
        row: 0,
        virusName: r.virus_name,
        virusEnd: r.virus_end,
        virusStart: r.virus_start,
        evalue: r.evalue,
        strand: r.strand,
      };
      return new VibesBacteriaAnnotation(conf);
    });

    let geneAnnotations: VibesBacteriaGeneAnnotation[] = geneRecords.map(
      (r) => {
        let conf: VibesBacteriaGeneAnnotationConfig = {
          ...r,
          row: 1,
        };
        return new VibesBacteriaGeneAnnotation(conf);
      }
    );

    this.occurrencesCache = [];
    let phageNames = phageRecords
      .map((r) => r.virus_name)
      .filter((value, idx, self) => self.indexOf(value) === idx);

    for (const phageName of phageNames) {
      const response = await fetch(
        `https://sodaviz.org/vibesProphage/${phageName}/`
      );
      const data = await response.text();
      let record: VibesVirusPlotRecord = JSON.parse(data)[0];

      let occurrences = new soda.ContinuousAnnotation({
        start: 0,
        end: record.occurrences.length,
        row: 0,
        values: record.occurrences,
      });

      let annotations: VibesVirusAnnotation[] = record.annotations.map((r) => {
        let conf: VibesVirusAnnotationConfig = {
          start: r.genomeStart,
          end: r.genomeEnd,
          geneStart: r.geneStart,
          geneEnd: r.geneEnd,
          geneLength: r.geneLength,
          genomeStrand: r.genomeStrand,
          geneStrand: r.geneStrand,
          name: r.name,
          evalue: r.evalue,
        };
        return new VibesVirusAnnotation(conf);
      });
      annotations.sort((a, b) => (a.x > b.x ? 1 : -1));
      this.occurrencesCache.push({
        annotations,
        occurrences,
        name: phageName,
        start: occurrences.start,
        end: occurrences.end,
        rowCount: this.occurrenceRows,
        virusStart: 0,
        virusEnd: 0,
      });
    }

    this.render({
      phageAnnotations,
      geneAnnotations,
    });
  }

  public render(params: VibesContainerRenderParams) {
    let bacteriaRenderParams = {
      annotations: params.phageAnnotations,
      genes: params.geneAnnotations,
      rowCount: 2,
    };
    this.linearBacteriaChart.render(bacteriaRenderParams);
    this.radialBacteriaChart.render(bacteriaRenderParams);

    soda.hoverBehavior({
      annotations: params.phageAnnotations,
      mouseover(s): void {
        s.attr("fill", "maroon");
      },
      mouseout(s): void {
        s.attr("fill", "black");
      },
    });

    let container = this;
    soda.clickBehavior({
      annotations: params.phageAnnotations,
      click(s, d): void {
        container.setActiveAnnotation(d.a);
      },
    });

    this.setActiveAnnotation(params.phageAnnotations[0]);
  }

  public removeActiveAnnotationOutline() {
    if (this.activeAnnotation != undefined) {
      let glyphs = <d3.Selection<any, any, any, any>[]>(
        soda.queryGlyphMap(this.activeAnnotation)
      );
      for (const glyph of glyphs) {
        glyph.style("stroke", "none");
      }
    }
  }

  public addActiveAnnotationOutline() {
    if (this.activeAnnotation != undefined) {
      let glyphs = <d3.Selection<any, any, any, any>[]>(
        soda.queryGlyphMap(this.activeAnnotation)
      );

      for (const glyph of glyphs) {
        glyph.style("stroke", this.occurrenceFillColor);
      }
    }
  }

  public setActiveAnnotation(annotation: VibesBacteriaAnnotation) {
    this.removeActiveAnnotationOutline();
    this.activeAnnotation = annotation;
    this.addActiveAnnotationOutline();

    let idx = 0;
    for (const [i, occurrence] of this.occurrencesCache.entries()) {
      if (annotation.virusName == occurrence.name) {
        idx = i;
        break;
      }
    }
    this.occurrencesChart.render({
      ...this.occurrencesCache[idx],
      virusStart: annotation.virusStart,
      virusEnd: annotation.virusEnd,
    });
    this.renderTable(this.occurrencesCache[idx]);
  }

  public renderTable(params: VibesOccurrenceChartRenderParams) {
    this.tableSelection.selectAll("*").remove();

    this.tableSelection
      .append("h3")
      .html(params.name)
      .style("background", "#cccccc")
      .style("margin", "0px")
      .style("margin-top", "0.5em")
      .style("padding", "0.5em");

    let table = this.tableSelection
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
      .data(params.annotations)
      .enter()
      .append("tr")
      .attr("id", (a) => `row-${a.id}`)
      .style("font-size", "14px")
      .style("color", "#333333");

    rows.each((ann, i, nodes) => {
      let row = d3.select(nodes[i]);
      row.append("td").html(ann.name);
      row.append("td").html(`${ann.x}`);
      row.append("td").html(`${ann.x + ann.w}`);
      row.append("td").html(`${ann.evalue.toExponential(2)}`);
      row.append("td").html(`${ann.geneStart}`);
      row.append("td").html(`${ann.geneEnd}`);
      row.append("td").html(`${ann.geneLength}`);

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
        .attr("fill", this.geneAlignmentTopColor);

      let aliWidth = ((ann.geneEnd - ann.geneStart) / ann.geneLength) * 100;
      let aliX = (ann.geneStart / ann.geneLength) * 100;

      aliRow
        .append("rect")
        .attr("width", `${aliWidth}%`)
        .attr("height", "20%")
        .attr("x", `${aliX}%`)
        .attr("y", 10)
        .attr("fill", this.geneAlignmentBottomColor);
    });

    rows
      .selectAll("td")
      .style("border", "1px solid")
      .style("border-color", "#cccccc")
      .style("padding", "1px 0.5em");
  }
}

function aggregateBacteriaGenes(
  chart: soda.Chart<any>,
  annotations: VibesBacteriaGeneAnnotation[]
): {
  individual: VibesBacteriaGeneAnnotation[];
  aggregated: soda.AnnotationGroup<VibesBacteriaGeneAnnotation>[];
} {
  let domain = chart.xScale.domain();
  annotations = annotations.filter(
    (a) => a.start < domain[1] && a.end > domain[0]
  );

  let tolerance = 1000 / chart.transform.k;
  if (tolerance < 10) {
    return {individual: annotations, aggregated: []};
  }
  let aggregated = soda.aggregateIntransitive({
    annotations,
    criterion: (a, b) =>
      a.start - tolerance < b.end && a.end + tolerance > b.start,
  });

  for (const group of aggregated) {
    group.y = 1;
  }

  let individual = aggregated
    .filter((a) => a.group.length == 1)
    .map((a) => a.group[0]);

  aggregated = aggregated.filter((a) => a.group.length > 1);

  return {individual, aggregated};
}

function setChartHighlight(highlightedChart: soda.Chart<any>, representedChart: soda.Chart<any>) {
  let domain = representedChart.xScale.domain();
  highlightedChart.highlight({
    start: domain[0],
    end: domain[1],
    selector: "bacteria-highlight",
  });
}
