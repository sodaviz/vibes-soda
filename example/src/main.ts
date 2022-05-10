import * as autocomplete from "autocompleter";
import {Spinner} from "spin.js";
import * as vs from "@sodaviz/vibes-soda";

let container = new vs.VibesContainer({selector: "#charts"});

class BacteriaNameItem {
  label: string;
  group: string;

  constructor(record: vs.VibesBacteriaNameRecord) {
    this.label = record.bacteria_name;
    this.group = "Bacteria";
  }
}

function populateBacteriaList(records: vs.VibesBacteriaNameRecord[]) {
  const bacteria: BacteriaNameItem[] = records.map(
    (r) => new BacteriaNameItem(r)
  );
  let inputForm = <HTMLInputElement>(
    document.getElementById("bacteria-selection")
  );

  //@ts-ignore
  autocomplete<BacteriaNameItem>({
    input: inputForm,
    emptyMsg: "No items found",
    minLength: 1,
    onSelect: (item: BacteriaNameItem, input: HTMLInputElement) => {
      // this function is called when the user clicks on an element in the autocomplete list
      input.value = item.label;
      let spinner = new Spinner({
        color: "cadetblue",
        position: "relative",
        top: `${container.radialBacteriaChart.calculateContainerHeight()/2}px`
      });
      spinner.spin(document.querySelector<HTMLDivElement>("#vibes-mid")!);
      container.query(item.label).then(() => spinner.stop());
    },
    fetch: (text: string, update: Function) => {
      // this function is called everytime there is a change in the form we have bound the autocompleter to
      text = text.toLowerCase();
      let suggestions = bacteria.filter(
        (i: BacteriaNameItem) => i.label.toLowerCase().indexOf(text) !== -1
      );
      update(suggestions);
    },
  });
}

async function getBacteriaNames(): Promise<vs.VibesBacteriaNameRecord[]> {
  const response = await fetch("https://sodaviz.org/data/vibesBacteriaNames/");
  const data = await response.text();
  return JSON.parse(data);
}

getBacteriaNames().then((records) => populateBacteriaList(records));

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
