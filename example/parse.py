import glob
import json

prefix_cnt = {}


def new_id(prefix: str) -> str:
    global prefix_cnt
    if prefix in prefix_cnt:
        id_cnt = prefix_cnt[prefix]
        prefix_cnt[prefix] += 1
    else:
        prefix_cnt[prefix] = 1
        id_cnt = 0

    return f'"{prefix}-{id_cnt}"'


def quote_str(string: str) -> str:
    return f'"{string}"'


def name_from_path(path: str) -> str:
    path_tokens = path.split("/")
    name_tokens = path_tokens[-1].split(".")
    # just in case the file name has any "." in it
    name = ".".join(name_tokens[:-1])

    return name


class VsData:
    def __init__(self):
        # these are the names of the strain, i.e. the file name
        self.bacteria_names = []

        # these are the names of the sequences in the fasta headers
        self.bacteria_seq_names = {}

        # these are the lengths of the sequences in the fastas
        self.bacteria_lengths = {}

        self.virus_names = []
        self.virus_lengths = {}

        self.integrations = {}
        self.bacterial_genes = {}
        self.viral_genes = {}

    def parse_integration_tsv(self, path: str):
        bacteria_name = name_from_path(path)
        if bacteria_name not in self.integrations:
            self.integrations[bacteria_name] = {}

        bacteria_dict = self.integrations[bacteria_name]

        with open(path, "r") as f:
            lines = f.readlines()
            for line in lines[1:]:
                tokens = line.split("\t")

                start = int(tokens[10])
                end = int(tokens[11])

                if start > end:
                    tmp = start
                    start = end
                    end = tmp

                query_name = tokens[0]
                # accession = tokens[2]
                evalue = float(tokens[3])
                # full_length = bool(tokens[4])
                query_start = int(tokens[5])
                query_end = int(tokens[6])
                # query_length = int(tokens[7])
                target_name = tokens[9]
                target_start = start
                target_end = end
                target_length = int(tokens[12])
                strand = tokens[13]

                if target_name not in bacteria_dict:
                    self.bacteria_lengths[target_name] = target_length
                    bacteria_dict[target_name] = {
                        "starts": [],
                        "ends": [],
                        "virus_names": [],
                        "virus_starts": [],
                        "virus_ends": [],
                        "strands": [],
                        "evalues": [],
                    }

                target_dict = bacteria_dict[target_name]
                target_dict["starts"].append(target_start)
                target_dict["ends"].append(target_end)
                target_dict["virus_names"].append(query_name)
                target_dict["virus_starts"].append(query_start)
                target_dict["virus_ends"].append(query_end)
                target_dict["strands"].append(strand)
                target_dict["evalues"].append(evalue)

    def parse_viral_gene_tsv(self, path: str):
        virus_name = name_from_path(path)
        if virus_name not in self.viral_genes:
            self.viral_genes[virus_name] = {
                "starts": [],
                "ends": [],
                "model_starts": [],
                "model_ends": [],
                "model_lengths": [],
                "labels": [],
                "strands": [],
                "evalues": [],
            }

        virus_dict = self.viral_genes[virus_name]

        with open(path, "r") as f:
            lines = f.readlines()
            for line in lines[1:]:
                tokens = line.split("\t")

                start = int(tokens[10])
                end = int(tokens[11])

                if start > end:
                    tmp = start
                    start = end
                    end = tmp

                query_name = tokens[0]
                # accession = tokens[2]
                evalue = float(tokens[3])
                # full_length = bool(tokens[4])
                query_start = int(tokens[5])
                query_end = int(tokens[6])
                query_length = int(tokens[7])
                # target_name = tokens[9]
                target_start = start
                target_end = end
                target_length = int(tokens[12])
                strand = tokens[13]

                self.virus_lengths[virus_name] = target_length

                virus_dict["starts"].append(target_start)
                virus_dict["ends"].append(target_end)
                virus_dict["model_starts"].append(query_start)
                virus_dict["model_ends"].append(query_end)
                virus_dict["model_lengths"].append(query_length)
                virus_dict["labels"].append(query_name)
                virus_dict["strands"].append(strand)
                virus_dict["evalues"].append(evalue)

    def parse_bacterial_gene_gff3(self, path: str):
        bacteria_name = name_from_path(path)
        if bacteria_name not in self.bacterial_genes:
            self.bacterial_genes[bacteria_name] = {}

        bacteria_dict = self.bacterial_genes[bacteria_name]

        with open(path, "r") as f:
            lines = f.readlines()
            for line in lines[1:]:

                if line.startswith("#"):
                    continue
                elif line.startswith(">"):
                    return

                tokens = line.split("\t")

                if tokens[2] != "CDS":
                    continue

                tokens = line.split("\t")

                meta_dict = {}
                meta_tokens = tokens[8].split(";")
                for meta_token in meta_tokens:
                    [key, val] = meta_token.split("=")
                    meta_dict[key] = val

                # gnl|Prokka|NDHMLNHN_1
                # Prodigal:002006
                # CDS
                # 1
                # 1371
                # .
                # +
                # 0
                #   ID=NDHMLNHN_00001;
                #   Parent=NDHMLNHN_00001_gene;
                #   eC_number=3.6.-.-;
                #   Name=mnmE;
                #   db_xref=COG:COG0486;
                #   gene=mnmE;
                #   inference=ab initio prediction:Prodigal:002006,similar to AA sequence:UniProtKB:P25522;
                #   locus_tag=NDHMLNHN_00001;
                #   product=tRNA modification GTPase MnmE;
                #   protein_id=gnl|Prokka|NDHMLNHN_00001

                start = int(tokens[3])
                end = int(tokens[4])

                if start > end:
                    tmp = start
                    start = end
                    end = tmp

                target_name = tokens[0]
                target_start = start
                target_end = end
                strand = tokens[6]
                id = meta_dict["locus_tag"]

                if "gene" in meta_dict:
                    query_name = meta_dict["gene"]
                elif "Name" in meta_dict:
                    query_name = meta_dict["Name"]
                else:
                    query_name = id

                if target_name not in bacteria_dict:
                    bacteria_dict[target_name] = {
                        "starts": [],
                        "ends": [],
                        "labels": [],
                        "strands": [],
                        "evalues": [],
                    }

                target_dict = bacteria_dict[target_name]

                target_dict["starts"].append(target_start)
                target_dict["ends"].append(target_end)
                target_dict["labels"].append(query_name)
                target_dict["strands"].append(strand)
                # target_dict["evalues"].append(evalue)


data = VsData()

bacterial_gene_paths = glob.glob("./output/gff/*.gff")
integrations_paths = glob.glob("./output/tsv/bacterial_integrations/*.tsv")
viral_gene_paths = glob.glob("./output/tsv/viral_gene_annotations/*.tsv")

bacterial_gene_paths.sort()
integrations_paths.sort()
viral_gene_paths.sort()

integration_ann = {}
viral_gene_ann = {}
bacterial_gene_ann = []

for path in integrations_paths:
    data.parse_integration_tsv(path)

for path in viral_gene_paths:
    data.parse_viral_gene_tsv(path)

for path in bacterial_gene_paths:
    data.parse_bacterial_gene_gff3(path)


with open("data.js", "w") as out:
    out.write('let bacteriaLengths = [')
    for seq_name in data.bacteria_lengths:
        seq_len = data.bacteria_lengths[seq_name]
        out.write('{},'.format(seq_len))
    out.write('];\n')

    out.write('let virusLengths = [')
    for seq_name in data.virus_lengths:
        seq_len = data.virus_lengths[seq_name]
        out.write('{},'.format(seq_len))
    out.write('];\n')

    out.write('let integrationsData = {};\n'.format(
        json.dumps(data.integrations)))
    out.write('let viralGenesData = {};\n'.format(
        json.dumps(data.viral_genes)))
    out.write('let bacterialGenesData = {};\n;'.format(
        json.dumps(data.bacterial_genes)))

