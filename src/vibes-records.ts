export interface VibesBacteriaNameRecord {
    bacteria_name: string;
}

export interface VibesProphageNameRecord {
    prophageName: string;
}

export interface VibesBacteriaAnnotationRecord {
    virus_name: string;
    evalue: number;
    full_length: number;
    virus_start: number;
    virus_end: number;
    virus_length: number;
    att_flank: string;
    bacteria_name: string;
    bacteria_start: number;
    bacteria_end: number;
    bacteria_length: number;
    strand: string;
}

export interface VibesBacteriaGeneAnnotationRecord {
    bacteriaName: string;
    alias: string;
    id: string;
    start: number;
    end: number;
    strand: string;
}

export interface VibesVirusAnnotationRecord {
    name: string;
    id: string;
    genomeStart: number;
    genomeEnd: number;
    geneStart: number;
    geneEnd: number;
    geneLength: number;
    genomeStrand: string;
    geneStrand: string;
    evalue: number;
    desc: string;
}

export interface VibesVirusPlotRecord {
    prophageName: string;
    occurrences: number[];
    annotations: VibesVirusAnnotationRecord[];
}
