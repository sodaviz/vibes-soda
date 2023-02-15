import * as vs from "@sodaviz/vibes-soda";
import {
  bacteriaNames,
  bacteriaLengths,
  phageNames,
  phageLengths,
  integrationAnnotations,
  bacteriaGeneAnnotations,
  virusGeneAnnotations,
} from "./out";

let container = new vs.VibesContainer({
  selector: "#charts",
  bacteriaNames,
  bacteriaLengths,
  phageNames,
  phageLengths,
  integrationAnnotations,
  bacteriaGeneAnnotations,
  virusGeneAnnotations,
});

let dropdown = new vs.VibesDropdown({
  selector: "#dropdown",
  selectCallback: (bacteriaName: string) => {
    container.render({ bacteriaName: bacteriaName });
  },
});

dropdown.populate(bacteriaNames);
