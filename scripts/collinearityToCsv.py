import csv

infile = open('../files/Bnapus.collinearity', 'r')

block = []
connection = []
source = []
target = []

for line in infile:
    line = line.rstrip()
    if line[0] != '#':
        currentLine = line.split()
        number = "".join(currentLine)
        block.append(number.split(':')[0].split('-')[0])
        connection.append(number.split(':')[0].split('-')[1])
        if len(currentLine) == 5:
            source.append(currentLine[2])
            target.append(currentLine[3])
        elif len(currentLine) == 4:
            source.append(currentLine[1])
            target.append(currentLine[2])

csvArray = []
for i in range(len(block)):
    csvArray.append([block[i], connection[i], source[i], target[i]])

print(len(csvArray))

csvArray.insert(0, ['block', 'connection', 'source', 'target'])
myFile = open('../files/collinearity.csv', 'w')
with myFile:
    writer = csv.writer(myFile)
    writer.writerows(csvArray)
