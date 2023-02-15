import { Annotation } from "@sodaviz/soda";

export interface IntegrationAnnotation extends Annotation {
  phageName: string;
  phageStart: number;
  phageEnd: number;
  strand: string;
  evalue: number;
}

export interface BacteriaGeneAnnotation extends Annotation {
  strand: string;
  name: string;
}

export interface VirusGeneAnnotation extends Annotation {
  name: string;
  modelStart: number;
  modelEnd: number;
  modelLength: number;
  strand: string;
  evalue: number;
}
