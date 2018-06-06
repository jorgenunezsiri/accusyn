import csv

infile = open('../files/bnapus.collinearity', 'r')

block = []
connection = []
source = []
target = []

score = 0
eValue = 0
isFlipped = 'no'

scoreArray = []
eValueArray = []
isFlippedArray = []

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
        scoreArray.append(score)
        eValueArray.append(eValue)
        isFlippedArray.append(isFlipped)
    elif line[0] == '#' and line[1] == '#' and line[2] == ' ':
        currentLine = line.split()
        score = currentLine[3].split('=')[1]
        eValue = currentLine[4].split('=')[1]
        # plus means not flipped, and minus means flipped
        if currentLine[len(currentLine) - 1] == 'plus':
            isFlipped = 'no'
        elif currentLine[len(currentLine) - 1] == 'minus':
            isFlipped = 'yes'

csvArray = []
for i in range(len(block)):
    csvArray.append([block[i], connection[i], source[i], target[i], scoreArray[i], eValueArray[i], isFlippedArray[i]])

print(len(csvArray))

csvArray.insert(0, ['block', 'connection', 'source', 'target', 'score', 'eValue', 'isFlipped'])
myFile = open('../files/collinearity.csv', 'w')
with myFile:
    writer = csv.writer(myFile)
    writer.writerows(csvArray)
