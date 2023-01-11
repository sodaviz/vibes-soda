import * as d3 from "d3";

export interface VibesDropdownConfig {
  selector: string;
  selectCallback: (t: string) => void;
}

export class VibesDropdown {
  selector: string;
  selectCallback: (t: string) => void;
  expanded: boolean = false;
  divSelection: d3.Selection<any, any, any, any>;
  selectedText: string;
  buttonSelection: d3.Selection<any, any, any, any>;
  labelSelection: d3.Selection<any, any, any, any>;
  expandableSelection: d3.Selection<any, any, any, any>;
  innerExpandableSelection: d3.Selection<any, any, any, any>;
  searchInputSelection: d3.Selection<any, any, any, any>;
  entrySelection: d3.Selection<any, any, any, any>;
  names: string[] = [];
  matchedNames: string[] = [];
  matchCount: number = Infinity;

  public constructor(config: VibesDropdownConfig) {
    this.selector = config.selector;
    this.selectCallback = config.selectCallback;

    this.divSelection = d3
      .select(config.selector)
      .append("div")
      .style("position", "absolute")
      .style("overflow-y", "hidden");

    this.buttonSelection = this.divSelection
      .append("div")
      .on("mouseover", function () {
        d3.select(this).style("background-color", "#CCC");
      })
      .on("mouseout", function () {
        d3.select(this).style("background-color", "#EEE");
      })
      .on("mousedown", () => {
        if (this.expanded) {
          this.close();
        } else {
          this.open();
        }
      })
      .style("padding", "10px")
      .style("background-color", "#EEE");

    this.labelSelection = this.buttonSelection
      .append("span")
      .style("-webkit-user-select", "none")
      .style("-moz-user-select", "none")
      .style("-ms-user-select", "none")
      .style("user-sklect", "none");

    this.expandableSelection = this.divSelection
      .append("div")
      .style("height", "0px")
      .style("width", `${this.width}px`)
      .style("background-color", "white")
      .style("overflow", "hidden");

    this.innerExpandableSelection = this.expandableSelection
      .append("div")
      .style("position", "relative")
      .style("left", "1px")
      .style("top", "1px")
      .style("height", "698px")
      .style("width", `${this.width - 2}px`)
      .style("outline", "1px solid black");

    const self = this;
    this.searchInputSelection = this.innerExpandableSelection
      .append("input")
      .style("width", "98%")
      .style("margin-top", "2px")
      .style("margin-left", "2px")
      .style("margin-bottom", "5px")
      .attr("placeholder", "search")
      .on("input", function () {
        let text = d3.select(this).property("value");
        self.search(text);
      });

    this.entrySelection = this.innerExpandableSelection
      .append("div")
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("height", "675px")
      .style("overflow-y", "scroll")
      .style("overflow-x", "hidden");

    // d3.select("body").on("mousedown", () => {
    //   if (d3.event.target !== this.buttonSelection.node()) {
    //     this.close();
    //   }
    // });
    this.selectedText = "";
  }

  get width(): number {
    return d3
      .select<HTMLElement, any>(this.selector)
      .node()!
      .getBoundingClientRect().width;
  }

  get entryHeight(): number {
    let maybeEntryNode = this.entrySelection.select<HTMLElement>("span").node();

    if (maybeEntryNode !== null) {
      return maybeEntryNode.getBoundingClientRect().height;
    } else {
      return 20;
    }
  }

  get expandableHeight(): number {
    let maybeExpandableNode = this.expandableSelection.node();

    if (maybeExpandableNode !== null) {
      return maybeExpandableNode.getBoundingClientRect().height;
    } else {
      return 0;
    }
  }

  public open() {
    this.expandableSelection
      .transition()
      .duration(500)
      .style("height", () => {
        let h = Math.min(700, this.entryHeight * (this.matchCount + 2));
        return `${h}px`;
      });
    this.expanded = true;
  }

  public close() {
    this.expandableSelection.transition().duration(500).style("height", "0px");
    this.expanded = false;
  }

  public search(text: string) {
    let matchedNames = [];

    if (text == "") {
      matchedNames = this.names;
    } else {
      for (const name of this.names) {
        if (name.includes(text)) {
          matchedNames.push(name);
        }
      }
    }
    this.matchCount = matchedNames.length;

    this.entrySelection.selectAll("span").remove();

    const self = this;

    this.entrySelection
      .selectAll("span")
      .data(matchedNames)
      .enter()
      .append("span")
      .attr("class", (d) => d)
      .style("margin-top", "2px")
      .style("margin-left", "2px")
      .style("-webkit-user-select", "none")
      .style("-moz-user-select", "none")
      .style("-ms-user-select", "none")
      .style("user-select", "none")
      .text((d) => d)
      .style("font-weight", (d) => {
        if (d == this.selectedText) {
          return "bold";
        } else {
          return "normal";
        }
      })
      .on("mousedown", function () {
        self.select(d3.select(this).text());
      })
      .on("mouseover", function () {
        d3.select(this).style("background-color", "gainsboro");
      })
      .on("mouseout", function () {
        d3.select(this).style("background-color", null);
      });

    this.expandableSelection.style("height", () => {
      let h = Math.min(700, this.entryHeight * (this.matchCount + 2));
      return `${h}px`;
    });

    this.innerExpandableSelection.style(
      "height",
      `${this.expandableHeight - 2}px`
    );
  }

  public select(text: string, close = true) {
    this.entrySelection.selectAll("span").style("font-weight", "normal");
    this.entrySelection.selectAll(`.${text}`).style("font-weight", "bold");
    this.selectedText = text;
    this.labelSelection.text(text);
    this.selectCallback(text);
    if (close) {
      this.close();
    }
  }

  public populate(names: string[]) {
    this.names = names;
    this.select(this.names[0], true);
    this.search("");
  }
}
