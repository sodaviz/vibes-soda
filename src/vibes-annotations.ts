import { Annotation, AnnotationConfig } from "@sodaviz/soda";

export interface VibesBacteriaAnnotationConfig extends AnnotationConfig {
  virusName: string;
  virusStart: number;
  virusEnd: number;
  strand: string;
  evalue: number;
}

export class VibesBacteriaAnnotation extends Annotation {
  virusName: string;
  virusStart: number;
  virusEnd: number;
  strand: string;
  evalue: number;

  constructor(config: VibesBacteriaAnnotationConfig) {
    super(config);
    this.virusName = config.virusName;
    this.strand = config.strand;
    this.virusStart = config.virusStart;
    this.virusEnd = config.virusEnd;
    this.evalue = config.evalue;
  }
}

export interface VibesBacteriaGeneAnnotationConfig extends AnnotationConfig {
  alias: string;
  strand: string;
}

export class VibesBacteriaGeneAnnotation extends Annotation {
  alias: string;
  strand: string;

  constructor(config: VibesBacteriaGeneAnnotationConfig) {
    super(config);
    this.alias = config.alias;
    this.strand = config.strand;
  }
}

export interface VibesVirusAnnotationConfig extends AnnotationConfig {
  name: string;
  geneStart: number;
  geneEnd: number;
  geneLength: number;
  genomeStrand: string;
  geneStrand: string;
  evalue: number;
}

export class VibesVirusAnnotation extends Annotation {
  name: string;
  geneStart: number;
  geneEnd: number;
  geneLength: number;
  genomeStrand: string;
  geneStrand: string;
  evalue: number;

  constructor(config: VibesVirusAnnotationConfig) {
    super(config);
    this.name = config.name;
    this.evalue = config.evalue;
    this.geneStart = config.geneStart;
    this.geneEnd = config.geneEnd;
    this.geneLength = config.geneLength;
    this.genomeStrand = config.genomeStrand;
    this.geneStrand = config.geneStrand;
  }
}
