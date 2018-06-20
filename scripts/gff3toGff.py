import csv

infile = open('../build/files/Bnapus_genes_v3.1.gff3', 'r')

chromosomes = []
mRNA = []
start = []
end = []
for line in infile:
    line = line.rstrip()
    currentLine = line.split()
    if currentLine[2] == 'mRNA':
        chromosomes.append(currentLine[0])
        start.append(currentLine[3])
        end.append(currentLine[4])
        mRNA.append(currentLine[8].split(';')[0].split('=')[1])

tsvArray = []
for i in range(len(chromosomes)):
    tsvArray.append([chromosomes[i], mRNA[i], start[i], end[i]])

print(len(tsvArray))

# tsvArray.insert(0, ['chrom', 'gene', 'start', 'end'])
with open('../build/files/bnapus.gff', 'w') as myFile:
    writer = csv.writer(myFile, delimiter='\t')
    writer.writerows(tsvArray)
