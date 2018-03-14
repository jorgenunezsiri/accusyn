import csv

infile = open('../files/Bnapus_genes_v3.1.gff3', 'r')

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

csvArray = []
for i in range(len(chromosomes)):
    csvArray.append([chromosomes[i], mRNA[i], start[i], end[i]])

print(len(csvArray))

csvArray.insert(0, ['chrom', 'gene', 'start', 'end'])
myFile = open('../files/gff.csv', 'w')
with myFile:
    writer = csv.writer(myFile)
    writer.writerows(csvArray)
