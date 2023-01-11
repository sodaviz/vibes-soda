import { Spinner } from "spin.js";
import * as vs from "@sodaviz/vibes-soda";
import * as soda from "@sodaviz/soda";

let container = new vs.VibesContainer({ selector: "#charts" });
let dropdown = new vs.VibesDropdown({
  selector: "#dropdown",
  selectCallback: (t: string) => {
    let spinner = new Spinner({
      color: "cadetblue",
      position: "relative",
      top: `${container.radialBacteriaChart.calculateContainerHeight() / 2}px`,
    });
    spinner.spin(document.querySelector<HTMLDivElement>("#vibes-mid")!);
    query(t).then(() => spinner.stop());
  },
});

async function getBacteriaNames(): Promise<vs.VibesBacteriaNameRecord[]> {
  const response = await fetch("https://sodaviz.org/data/vibesBacteriaNames/");
  const data = await response.text();
  return JSON.parse(data);
}

async function query(bacteriaName: string) {
  let phageRecords = await fetch(
    `https://sodaviz.org/data/vibesBacteria/${bacteriaName}`
  )
    .then((response) => response.text())
    .then((text) => <vs.VibesBacteriaAnnotationRecord[]>JSON.parse(text))
    .then((records) =>
      records.sort((a, b) => (a.bacteria_start > b.bacteria_start ? 1 : -1))
    );

  let geneRecords = await fetch(
    `https://sodaviz.org/data/vibesBacteriaGenes/${bacteriaName}`
  )
    .then((response) => response.text())
    .then((text) => <vs.VibesBacteriaGeneAnnotationRecord[]>JSON.parse(text));

  let phageAnnotations: vs.VibesBacteriaAnnotation[] = phageRecords.map((r) => {
    let start, end;
    if (r.bacteria_end > r.bacteria_start) {
      start = r.bacteria_start;
      end = r.bacteria_end;
    } else {
      start = r.bacteria_end;
      end = r.bacteria_start;
    }
    return {
      id: soda.generateId("phage"),
      start,
      end,
      row: 0,
      virusName: r.virus_name,
      virusEnd: r.virus_end,
      virusStart: r.virus_start,
      evalue: r.evalue,
      strand: r.strand,
    };
  });

  let geneAnnotations: vs.VibesBacteriaGeneAnnotation[] = geneRecords.map(
    (r) => {
      return {
        ...r,
      };
    }
  );

  let phageNames = phageRecords
    .map((r) => r.virus_name)
    .filter((value, idx, self) => self.indexOf(value) === idx);

  let occurrencesRenderParamsList: vs.VibesOccurrenceChartRenderParams[] = [];

  for (const phageName of phageNames) {
    const response = await fetch(
      `https://sodaviz.org/data/vibesProphage/${phageName}/`
    );
    const data = await response.text();
    let record: vs.VibesVirusPlotRecord = JSON.parse(data)[0];

    let occurrences = {
      id: soda.generateId("occurrences"),
      start: 0,
      end: record.occurrences.length,
      row: 0,
      values: record.occurrences,
    };

    let annotations: vs.VibesVirusAnnotation[] = record.annotations.map((r) => {
      return {
        id: soda.generateId("virus"),
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
    });
    annotations.sort((a, b) => (a.start > b.start ? 1 : -1));

    occurrencesRenderParamsList.push({
      annotations,
      occurrences,
      name: phageName,
      start: occurrences.start,
      end: occurrences.end,
      rowCount: container.occurrenceRows,
      virusStart: 0,
      virusEnd: 0,
    });
  }

  container.render({
    phageAnnotations,
    geneAnnotations,
    occurrencesRenderParamsList,
  });
}

getBacteriaNames().then((records) =>
  dropdown.populate(records.map((r) => r.bacteria_name))
);

let collapsibleElements = document.getElementsByClassName("collapsible");
for (let i = 0; i < collapsibleElements.length; i++) {
  collapsibleElements[i].addEventListener("click", function (this: any) {
    this.classList.toggle("active");
    let content = this.nextElementSibling;
    if (content.style.maxHeight) {
      content.style.maxHeight = null;
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
    }
  });
}
