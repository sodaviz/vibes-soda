import { Annotation } from "@sodaviz/soda";

export interface VibesBacteriaAnnotation extends Annotation {
  virusName: string;
  virusStart: number;
  virusEnd: number;
  strand: string;
  evalue: number;
}

export interface VibesBacteriaGeneAnnotation extends Annotation {
  alias: string;
  strand: string;
}

export interface VibesVirusAnnotation extends Annotation {
  name: string;
  geneStart: number;
  geneEnd: number;
  geneLength: number;
  genomeStrand: string;
  geneStrand: string;
  evalue: number;
}
